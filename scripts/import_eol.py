"""
Import an "EOL" research data dump (ProgSnap2-style SQLite database, as produced by
the BlockPy end-of-line export/cleaning pipeline) back into a BlockPy server database.

This effectively inverts the mapping in `models/data_formats/progsnap2.py`, creating
a simulated development database (e.g., `instance/main.db`) populated with the
courses, assignments, users, submissions, and submission logs reconstructed from
the dump.

Usage (from the repo root):

    python manage.py import_eol --source path/to/eol.db

Useful options:

    --target instance/main.db   Where to write the new database (default)
    --students 100              Randomly sample N students instead of importing all
    --no-logs                   Skip the submission_log table (much faster/smaller)
    --limit 100000              Only process the first N events (for testing)
    --replace                   Overwrite the target file if it already exists

Every imported user is given the same password (default: "password") so that you
can log in as any of them locally. An admin account is also created from the
ADMIN_EMAIL/ADMIN_PASSWORD configuration values (or admin@example.com/password).

Data in the dump with no home in the server schema (LinkDemographic, LinkSurvey,
LinkGrade) is intentionally skipped.
"""
import json
import os
import re
import sqlite3
import uuid
from datetime import datetime, timedelta, timezone

import click
from sqlalchemy import create_engine, event as sqla_event
from tqdm import tqdm

from models import db
from scripts.setup import cli

# Event types whose ProgSnap2 rows carry their code state as the log message
# (see CODE_STATE_UPDATE_EVENT_TYPES in models/data_formats/progsnap2.py)
CODE_EDIT_EVENT_TYPES = {"File.Edit", "X-File.Add", "X-Instructor.File.Edit", "File.Create"}

MAIN_FILENAME = "answer.py"
LOG_BATCH_SIZE = 10000
SUBMISSION_BATCH_SIZE = 2000

EPOCH = datetime(1970, 1, 1, tzinfo=timezone.utc)


def parse_timestamp(value):
    """Parse an ISO-ish timestamp from the dump into an aware UTC datetime (or None)."""
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)


def format_timestamp(value):
    """Format an aware datetime the way SQLAlchemy stores DateTime on SQLite."""
    if value is None:
        return None
    return value.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M:%S.%f")


def iso_to_blockpy_timestamp(value):
    """Invert blockpy_timestamp_to_iso8601: ISO local time -> millisecond epoch string."""
    if not value:
        return ""
    try:
        # The export used naive local time (datetime.fromtimestamp), so parse it back the same way
        return str(int(datetime.fromisoformat(value).timestamp() * 1000))
    except (ValueError, OSError, OverflowError):
        return ""


def parse_score(value):
    """Parse a ProgSnap2 Score field into (group_total, subscore).

    For X-Submission.LMS events the production message (and therefore the dump's
    Score column) is f"{total_score}|{submission_score}" — the 0-1 grade for the
    whole assignment group that was posted to the LMS, then THIS submission's
    earned points (submission.full_score()). See Report.handle_transmission_result.
    """
    if value in (None, ""):
        return None, None
    group_total, _, subscore = str(value).partition("|")
    try:
        group_total = float(group_total)
    except ValueError:
        group_total = None
    try:
        subscore = float(subscore) if subscore else None
    except ValueError:
        subscore = None
    return group_total, subscore


def clean_text(value):
    """Coerce a dump value into TEXT-safe str (SQLite tolerates most things, but not NUL)."""
    if value is None:
        return ""
    return str(value).replace("\x00", "")


def split_subject_name(subject_id):
    """Split a human-hashed SubjectID like 'BrightAmethystDeer' into first/last names."""
    parts = re.findall(r"[A-Z][a-z0-9]*|[a-z0-9]+", str(subject_id))
    if len(parts) >= 2:
        return parts[0], "".join(parts[1:])
    return str(subject_id), ""


def load_course_map(path):
    """Load a production-course-id -> (url, name) mapping from a CSV/TSV file.

    Expected columns: id, url, name (header row optional). Used to give real
    identities to courses the dump only knows by number (e.g. template courses).
    """
    import csv
    course_map = {}
    with open(path, encoding="utf-8", newline="") as map_file:
        sample = map_file.read(4096)
        map_file.seek(0)
        delimiter = "\t" if "\t" in sample else ","
        for row in csv.reader(map_file, delimiter=delimiter):
            row = [cell.strip() for cell in row if cell.strip()]
            if len(row) < 2 or not row[0].isdigit():  # skips the header row too
                continue
            course_map[row[0]] = (row[1], row[2] if len(row) > 2 else row[1])
    return course_map


class EolSource:
    """Read-only wrapper around an EOL-style SQLite dump, tolerant of schema variations."""

    def __init__(self, path):
        self.path = path
        self.connection = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
        self.connection.row_factory = sqlite3.Row
        self.connection.text_factory = lambda data: data.decode("utf-8", "replace")
        self.tables = {name.lower(): name for (name,) in self.connection.execute(
            "SELECT name FROM sqlite_master WHERE type='table'")}

    def has_table(self, name):
        return name.lower() in self.tables

    def columns(self, table):
        real_name = self.tables[table.lower()]
        return {row[1] for row in self.connection.execute(f"PRAGMA table_info([{real_name}])")}

    def rows(self, table, where="", params=()):
        if not self.has_table(table):
            return []
        real_name = self.tables[table.lower()]
        return self.connection.execute(f"SELECT * FROM [{real_name}] {where}", params)

    def distinct(self, table, column):
        return [row[0] for row in self.connection.execute(
            f"SELECT DISTINCT [{column}] FROM [{self.tables[table.lower()]}]")]

    def close(self):
        self.connection.close()


class Submission:
    """Accumulated state for one (student, assignment, course) submission being rebuilt."""
    __slots__ = ("pk", "user_id", "assignment_id", "course_id", "group_id",
                 "date_started", "date_last", "date_submitted", "last_code_state",
                 "score", "correct", "subscore", "edits", "attempts")

    def __init__(self, pk, user_id, assignment_id, course_id, group_id, timestamp):
        self.pk = pk
        self.user_id = user_id
        self.assignment_id = assignment_id
        self.course_id = course_id
        self.group_id = group_id
        self.date_started = timestamp
        self.date_last = timestamp
        self.date_submitted = None
        self.last_code_state = None
        self.score = 0
        self.correct = False
        self.subscore = None
        self.edits = 0
        self.attempts = 0


class EolImporter:
    def __init__(self, source: EolSource, target_path, include_logs=True,
                 include_edit_code=True, students=0, seed=108,
                 shared_password="password", admin_email=None, admin_password=None,
                 event_limit=None, course_map=None):
        self.source = source
        self.target_path = target_path
        self.include_logs = include_logs
        self.include_edit_code = include_edit_code
        self.students = students
        self.seed = seed
        self.shared_password = shared_password
        self.admin_email = admin_email
        self.admin_password = admin_password
        self.event_limit = event_limit
        # Production course id -> (url, name), for courses whose identity is not
        # in the dump (chiefly the template courses that own the assignments)
        self.course_map = course_map or {}

        self.now = datetime.now(timezone.utc)
        self.counters = {}
        # Mappings from dump identifiers to new database ids
        self.users = {}                # SubjectID (or synthetic key) -> user id
        self.courses = {}              # course key (BlockPyCourseID or section) -> course id
        self.course_by_section = {}    # dump CourseID string -> course id
        self.course_terms = {}         # course key -> term
        self.assignments = {}          # AssignmentID (url) -> assignment id
        self.assignment_groups = {}    # AssignmentGroupID (url) -> group id
        self.assignment_group_of = {}  # assignment id -> group id
        self.due_dates = {}            # (course id, group id) -> (due, locked)
        self.roles = set()             # (user_id, course_id, role name) already granted
        self.submissions = {}          # submission key -> Submission
        self.assignment_points = {}    # assignment id -> max observed subscore (earned points)
        self.seen_events = set()       # fingerprints, to drop duplicated dump rows
        self.stats = {"events": 0, "skipped_events": 0, "duplicate_events": 0}

    def next_id(self, table):
        self.counters[table] = self.counters.get(table, 0) + 1
        return self.counters[table]

    # -------------------------------------------------------------------------
    # Phase 1: schema + metadata (users, courses, assignments, groups, roles)
    # -------------------------------------------------------------------------

    def create_schema(self):
        engine = create_engine(f"sqlite:///{self.target_path.replace(os.sep, '/')}")

        @sqla_event.listens_for(engine, "connect")
        def set_pragmas(dbapi_connection, _record):
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA journal_mode=MEMORY")
            cursor.execute("PRAGMA synchronous=OFF")
            cursor.close()

        db.metadata.create_all(bind=engine)
        engine.dispose()
        self.stamp_alembic()
        # From here on out we use a raw connection: we control every inserted value,
        # and executemany is much faster than the ORM for tens of millions of rows.
        connection = sqlite3.connect(self.target_path)
        connection.execute("PRAGMA journal_mode=MEMORY")
        connection.execute("PRAGMA synchronous=OFF")
        connection.execute("PRAGMA cache_size=-100000")
        return connection

    def stamp_alembic(self):
        """Mark the new database as being at the latest migration revision."""
        try:
            from alembic.script import ScriptDirectory
            head = ScriptDirectory("migrations").get_current_head()
        except Exception:
            return
        if not head:
            return
        connection = sqlite3.connect(self.target_path)
        connection.execute("CREATE TABLE IF NOT EXISTS alembic_version "
                           "(version_num VARCHAR(32) NOT NULL, "
                           "CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num))")
        connection.execute("DELETE FROM alembic_version")
        connection.execute("INSERT INTO alembic_version (version_num) VALUES (?)", (head,))
        connection.commit()
        connection.close()

    def insert(self, connection, table, rows):
        if not rows:
            return
        columns = list(rows[0].keys())
        placeholders = ",".join("?" for _ in columns)
        sql = f"INSERT INTO [{table}] ({','.join(columns)}) VALUES ({placeholders})"
        connection.executemany(sql, [[row[column] for column in columns] for row in rows])
        connection.commit()

    def base_columns(self, when=None):
        stamp = format_timestamp(when or self.now)
        return {"date_created": stamp, "date_modified": stamp}

    def make_user(self, first_name, last_name, email, password, admin=False):
        user_id = self.next_id("user")
        row = {
            "id": user_id, **self.base_columns(),
            "first_name": first_name, "last_name": last_name, "email": email,
            "proof": "", "password": password, "active": 1, "anonymous": 0,
            "confirmed_at": format_timestamp(self.now), "banned": 0,
            "fs_uniquifier": uuid.uuid4().hex,
            "last_login_at": None, "current_login_at": None,
            "last_login_ip": None, "current_login_ip": None, "login_count": 0,
        }
        return user_id, row

    def make_role(self, name, user_id, course_id):
        if (user_id, course_id, name) in self.roles:
            return None
        self.roles.add((user_id, course_id, name))
        return {
            "id": self.next_id("role"), **self.base_columns(),
            "name": name, "subname": "", "user_id": user_id, "course_id": course_id,
            "external_id": None, "description": "Imported from EOL dump",
        }

    def make_course(self, name, url, term, kind, owner_id, external_id="",
                    service=None, visibility="private"):
        course_id = self.next_id("course")
        row = {
            "id": course_id, **self.base_columns(),
            "name": name, "url": url, "owner_id": owner_id,
            "kind": kind,
            "service": service or ("lti" if kind == "offering" else "native"),
            "external_id": str(external_id or ""), "lms_id": None, "endpoint": "",
            "version": 0, "visibility": visibility, "term": term, "settings": "",
            "locked": 0,
        }
        return course_id, row

    def import_metadata(self, connection):
        from flask_security.utils import hash_password

        source = self.source
        click.echo("Importing users, courses, assignments, and groups...")
        # Hash once and share: every imported account gets the same password.
        shared_hash = hash_password(self.shared_password)

        user_rows, course_rows, role_rows = [], [], []

        # --- Admin user
        admin_id, admin_row = self.make_user("Admin", "User", self.admin_email,
                                             hash_password(self.admin_password))
        user_rows.append(admin_row)
        self.admin_id = admin_id
        role_rows.append(self.make_role("admin", admin_id, None))
        role_rows.append(self.make_role("instructor", admin_id, None))

        # --- The special default course (mirrors populate_db; Course.get_default()
        # finds it by url='default', so it must exist)
        default_id, default_row = self.make_course("Default Course", "default", "",
                                                   "default", admin_id,
                                                   service="native", visibility="public")
        course_rows.append(default_row)
        role_rows.append(self.make_role("instructor", admin_id, default_id))

        # --- Subjects (students/TAs)
        subject_roles = {}
        for row in source.rows("LinkSubject"):
            subject_roles[row["SubjectID"]] = (row["Roles"] or "learner").strip() or "learner"
        all_subjects = sorted(set(source.distinct("MainTable", "SubjectID"))
                              | set(subject_roles))
        if self.students and self.students < len(all_subjects):
            import random
            all_subjects = sorted(random.Random(self.seed).sample(all_subjects, self.students))
            click.echo(f"  Sampled {len(all_subjects)} of {len(subject_roles)} subjects "
                       f"(seed={self.seed})")
        self.sampled_subjects = set(all_subjects)
        for subject in all_subjects:
            first_name, last_name = split_subject_name(subject)
            user_id, row = self.make_user(first_name, last_name,
                                          f"{str(subject).lower()}@eol.example.com",
                                          shared_hash)
            self.users[subject] = user_id
            user_rows.append(row)

        # --- Offering courses, merged by BlockPyCourseID (sections share a course)
        offerings = {}
        for row in source.rows("LinkCourse"):
            blockpy_id = str(row["BlockPyCourseID"] or "").strip()
            key = blockpy_id if blockpy_id not in ("", "?", "None") \
                else f"section-{row['CourseID']}"
            info = offerings.setdefault(key, {
                "course": row["Course"], "term": row["Term"],
                "sections": [], "instructors": set(), "canvas": row["CanvasCourseID"],
            })
            info["sections"].append(row["CourseID"])
            instructor = str(row["Instructor"] or "").strip()
            if instructor and instructor != "?":
                info["instructors"].add(instructor)

        # Any sections that appear in events but not in LinkCourse get their own course
        for section in source.distinct("MainTable", "CourseID"):
            if not any(section in info["sections"] for info in offerings.values()):
                offerings.setdefault(f"section-{section}", {
                    "course": section, "term": "", "sections": [section],
                    "instructors": set(), "canvas": "",
                })

        instructor_users = {}
        for key, info in sorted(offerings.items()):
            # Retain the dump's real course identity: the URL is the first section's
            # CourseID (e.g. "24F-CISC106-080"), and the name keeps the course,
            # term, section numbers, and instructor(s).
            sections = sorted(info["sections"])
            url = sections[0]
            suffix = f" ({'/'.join(sorted(info['instructors']))})" if info["instructors"] else ""
            if info["term"]:
                section_codes = "/".join(s.rsplit("-", 1)[-1] for s in sections)
                name = f"{info['course']} {info['term']} {section_codes}{suffix}"
            else:
                name = f"{info['course']}{suffix}"
            if key in self.course_map:
                url, name = self.course_map[key]
            course_id, row = self.make_course(name, url, info["term"], "offering",
                                              admin_id, info["canvas"])
            course_rows.append(row)
            self.courses[key] = course_id
            self.course_terms[key] = info["term"]
            for section in info["sections"]:
                self.course_by_section[section] = course_id
            role_rows.append(self.make_role("instructor", admin_id, course_id))
            for instructor in sorted(info["instructors"]):
                if instructor not in instructor_users:
                    user_id, user_row = self.make_user(instructor, "Instructor",
                                                       f"{instructor.lower()}@eol.example.com",
                                                       shared_hash)
                    instructor_users[instructor] = user_id
                    user_rows.append(user_row)
                role_rows.append(self.make_role("instructor",
                                                instructor_users[instructor], course_id))

        # --- Template ("curriculum") courses that own the assignments
        owning_course_ids = set()
        content_owners = set()
        for table in ("LinkAssignment", "LinkAssignmentGroup"):
            if not source.has_table(table):
                continue
            columns = source.columns(table)
            for row in source.rows(table):
                if "OwningCourseID" in columns and row["OwningCourseID"] is not None:
                    owning_course_ids.add(str(row["OwningCourseID"]))
                if "OwnerID" in columns and row["OwnerID"] is not None:
                    content_owners.add(str(row["OwnerID"]))
        owner_users = {}
        for owner in sorted(content_owners):
            user_id, row = self.make_user("Author", str(owner),
                                          f"author{owner}@eol.example.com", shared_hash)
            owner_users[owner] = user_id
            user_rows.append(row)
        for owning_id in sorted(owning_course_ids):
            if owning_id in self.courses:
                continue
            url, name = self.course_map.get(
                owning_id, (f"eol-curriculum-{owning_id}", f"Curriculum #{owning_id}"))
            course_id, row = self.make_course(name, url, "", "template", admin_id)
            course_rows.append(row)
            self.courses[owning_id] = course_id
            role_rows.append(self.make_role("instructor", admin_id, course_id))

        def resolve_owner(row, columns):
            if "OwnerID" in columns and row["OwnerID"] is not None:
                return owner_users.get(str(row["OwnerID"]), admin_id)
            return admin_id

        def resolve_owning_course(row, columns):
            if "OwningCourseID" in columns and row["OwningCourseID"] is not None:
                return self.courses.get(str(row["OwningCourseID"]))
            return None

        for owner in sorted(content_owners):
            # Give authors instructor access to the curriculum courses
            for owning_id in sorted(owning_course_ids):
                role_rows.append(self.make_role("instructor", owner_users[owner],
                                                self.courses[owning_id]))

        # --- Assignment groups
        group_rows = []
        default_course_id = None
        if source.has_table("LinkAssignmentGroup"):
            columns = source.columns("LinkAssignmentGroup")
            for position, row in enumerate(source.rows(
                    "LinkAssignmentGroup", "ORDER BY AssignmentGroupID")):
                group_id = self.next_id("assignment_group")
                self.assignment_groups[row["AssignmentGroupID"]] = group_id
                group_rows.append({
                    "id": group_id, **self.base_columns(),
                    "name": clean_text(row["Name"]) or row["AssignmentGroupID"],
                    "url": row["AssignmentGroupID"], "forked_id": None,
                    "category": "none",
                    "forked_version": None, "owner_id": resolve_owner(row, columns),
                    "course_id": resolve_owning_course(row, columns) or self.default_course(
                        connection, course_rows, role_rows),
                    "position": position, "version": row["Version"] or 0,
                })

        # --- Assignments + group memberships
        assignment_rows, membership_rows = [], []
        valid_types = {"reading", "quiz", "textbook", "maze", "python", "java",
                       "typescript", "explanation", "explain", "blockpy"}
        known_assignments = set()
        if source.has_table("LinkAssignment"):
            columns = source.columns("LinkAssignment")
            group_positions = {}
            for row in source.rows("LinkAssignment", "ORDER BY AssignmentID"):
                assignment_id = self.next_id("assignment")
                url = row["AssignmentID"]
                known_assignments.add(url)
                self.assignments[url] = assignment_id
                assignment_type = (row["Type"] or "blockpy").strip().lower()
                if assignment_type not in valid_types:
                    assignment_type = "blockpy"
                assignment_rows.append({
                    "id": assignment_id, **self.base_columns(),
                    "name": clean_text(row["Name"]) or url, "url": url,
                    "status": "published", "type": assignment_type,
                    "instructions": clean_text(row["Instructions"]),
                    "reviewed": 1 if row["Reviewed"] else 0,
                    "hidden": 1 if row["Hidden"] else 0,
                    "public": 0, "subordinate": 0, "ip_ranges": "", "points": 1,
                    "settings": clean_text(row["Settings"]),
                    "on_run": clean_text(row["CodeOnRun"]),
                    "on_change": clean_text(row["CodeOnChange"]),
                    "on_eval": clean_text(row["CodeOnEval"]),
                    "starting_code": clean_text(row["CodeStarting"]),
                    "extra_instructor_files": clean_text(row["CodeExtraInstructor"]),
                    "extra_starting_files": clean_text(row["CodeExtraStarting"]),
                    "forked_id": None, "forked_version": None,
                    "owner_id": resolve_owner(row, columns),
                    "course_id": resolve_owning_course(row, columns) or self.default_course(
                        connection, course_rows, role_rows),
                    "version": row["Version"] or 0,
                })
                group_url = row["AssignmentGroupID"] if "AssignmentGroupID" in columns else None
                group_id = self.assignment_groups.get(group_url)
                if group_id:
                    self.assignment_group_of[assignment_id] = group_id
                    position = group_positions[group_id] = group_positions.get(group_id, -1) + 1
                    membership_rows.append({
                        "id": self.next_id("assignment_group_membership"),
                        **self.base_columns(),
                        "assignment_group_id": group_id, "assignment_id": assignment_id,
                        "position": position, "policy": "{}",
                    })

        # Stubs for assignments that appear in events but have no LinkAssignment row
        for url in sorted(set(source.distinct("MainTable", "AssignmentID")) - known_assignments):
            assignment_id = self.next_id("assignment")
            self.assignments[url] = assignment_id
            assignment_rows.append({
                "id": assignment_id, **self.base_columns(),
                "name": url, "url": url, "status": "published", "type": "blockpy",
                "instructions": "(Not included in the EOL dump)",
                "reviewed": 0, "hidden": 1, "public": 0, "subordinate": 0,
                "ip_ranges": "", "points": 1, "settings": "",
                "on_run": "", "on_change": "", "on_eval": "", "starting_code": "",
                "extra_instructor_files": "", "extra_starting_files": "",
                "forked_id": None, "forked_version": None,
                "owner_id": admin_id,
                "course_id": self.default_course(connection, course_rows, role_rows),
                "version": 0,
            })

        # --- Student roles from LinkCourseSubject (fallbacks added during the event pass)
        if source.has_table("LinkCourseSubject"):
            for row in source.rows("LinkCourseSubject"):
                user_id = self.users.get(row["SubjectID"])
                course_id = self.course_by_section.get(row["CourseID"])
                if user_id and course_id:
                    role_name = subject_roles.get(row["SubjectID"], "learner")
                    if role_name not in ("learner", "teachingassistant"):
                        role_name = "learner"
                    role_rows.append(self.make_role(role_name, user_id, course_id))

        # --- Due dates, applied to submissions later
        if source.has_table("LinkCourseAssignmentGroup"):
            columns = source.columns("LinkCourseAssignmentGroup")
            lock_column = "Lock" if "Lock" in columns else "Locked"
            for row in source.rows("LinkCourseAssignmentGroup"):
                course_id = self.course_by_section.get(row["CourseID"])
                group_id = self.assignment_groups.get(row["AssignmentGroupID"])
                if not course_id or not group_id:
                    continue
                due = parse_timestamp(row["Due"])
                locked = parse_timestamp(row[lock_column] if lock_column in columns else None)
                end_of_day = timedelta(hours=23, minutes=59)
                self.due_dates.setdefault((course_id, group_id), (
                    due + end_of_day if due else None,
                    locked + end_of_day if locked else None))

        self.insert(connection, "user", user_rows)
        self.insert(connection, "course", course_rows)
        self.insert(connection, "assignment_group", group_rows)
        self.insert(connection, "assignment", assignment_rows)
        self.insert(connection, "assignment_group_membership", membership_rows)
        self.insert(connection, "role", [row for row in role_rows if row])
        self.stats.update(users=len(user_rows), courses=len(course_rows),
                          assignments=len(assignment_rows), groups=len(group_rows),
                          memberships=len(membership_rows),
                          roles=len([row for row in role_rows if row]))

    def default_course(self, connection, course_rows, role_rows):
        """A catch-all template course for content with no known owning course."""
        if "_default" not in self.courses:
            course_id, row = self.make_course("EOL Imported Content", "eol-imported",
                                              "", "template", self.admin_id)
            course_rows.append(row)
            role_rows.append(self.make_role("instructor", self.admin_id, course_id))
            self.courses["_default"] = course_id
        return self.courses["_default"]

    # -------------------------------------------------------------------------
    # Phase 2: events (submission logs) + submission reconstruction
    # -------------------------------------------------------------------------

    def lookup_code(self, code_state_id, filename):
        if code_state_id in (None, ""):
            return ""
        row = self.source.connection.execute(
            "SELECT Contents FROM CodeState WHERE CodeStateID=? AND Filename=?",
            (code_state_id, filename)).fetchone()
        return clean_text(row[0]) if row else ""

    def invert_event(self, row, columns):
        """Invert to_progsnap_event: recover (event_type, category, label, message)."""

        def get(column):
            return clean_text(row[column]) if column in columns else ""

        event_type = get("EventType")
        category, label, message = "", "", ""
        if event_type in CODE_EDIT_EVENT_TYPES:
            if self.include_edit_code:
                message = self.lookup_code(row["CodeStateID"], get("CodeStateSection"))
        elif event_type == "Compile.Error":
            # The export re-labeled runtime errors; restore the original encoding
            event_type, category = "Run.Program", "ProgramErrorOutput"
            message = get("CompileMessageData")
        elif event_type == "Run.Program":
            if get("ExecutionResult") == "Error":
                event_type = "Compile.Error"
                message = get("ProgramErrorOutput")
            else:
                program_input, program_output = get("ProgramInput"), get("ProgramOutput")
                if program_input or program_output:
                    message = json.dumps({"inputs": program_input, "outputs": program_output})
        elif event_type == "Intervention":
            category, _, label = get("InterventionType").partition("|")
            message = get("InterventionMessage")
        elif event_type == "Resource.View":
            category = get("InterventionCategory")
            label = get("InterventionType")
            message = get("InterventionMessage")
        elif event_type == "X-Submission.LMS":
            message = get("Score")
        return event_type, category, label, message

    def import_events(self, connection):
        source = self.source
        columns = source.columns("MainTable")
        has_submission_id = "SubmissionID" in columns
        sampling = self.students and hasattr(self, "sampled_subjects")

        if sampling and len(self.sampled_subjects) < 500:
            total = None
            cursors = (source.rows("MainTable", "WHERE SubjectID=? ORDER BY EventID", (subject,))
                       for subject in sorted(self.sampled_subjects))
            events = (row for cursor in cursors for row in cursor)
        else:
            total = source.connection.execute(
                "SELECT COUNT(*) FROM MainTable").fetchone()[0]
            events = source.rows("MainTable")

        log_sql = """
            INSERT INTO submission_log (date_created, date_modified,
                submission_id, submission_version, assignment_id, assignment_version,
                course_id, subject_id, event_type, file_path, category, label,
                message, extended, client_timestamp, client_timezone)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)"""
        log_batch = []
        extra_roles = []

        click.echo("Importing events and reconstructing submissions...")
        for row in tqdm(events, total=total, unit="events", unit_scale=True):
            subject = row["SubjectID"]
            if sampling and subject not in self.sampled_subjects:
                continue
            user_id = self.users.get(subject)
            assignment_id = self.assignments.get(row["AssignmentID"])
            course_id = self.course_by_section.get(row["CourseID"])
            if not (user_id and assignment_id and course_id):
                self.stats["skipped_events"] += 1
                continue
            self.stats["events"] += 1
            if self.event_limit and self.stats["events"] > self.event_limit:
                break
            timestamp = parse_timestamp(row["ServerTimestamp"]) or self.now

            # Track the submission this event belongs to
            key = row["SubmissionID"] if has_submission_id and row["SubmissionID"] not in (
                None, "", -1, "-1") else (user_id, assignment_id, course_id)

            # Dumps merged from overlapping exports can contain the same production
            # event twice (with different EventIDs); keep only the first copy.
            fingerprint = hash((
                str(key), row["EventType"], row["ServerTimestamp"], str(row["CodeStateID"]),
                row["CodeStateSection"] if "CodeStateSection" in columns else "",
                row["Score"] if "Score" in columns else "",
                row["ClientTimestamp"] if "ClientTimestamp" in columns else ""))
            if fingerprint in self.seen_events:
                self.stats["duplicate_events"] += 1
                continue
            self.seen_events.add(fingerprint)

            submission = self.submissions.get(key)
            if submission is None:
                submission = Submission(self.next_id("submission"), user_id, assignment_id,
                                        course_id, self.assignment_group_of.get(assignment_id),
                                        timestamp)
                self.submissions[key] = submission
                if (user_id, course_id, "learner") not in self.roles \
                        and (user_id, course_id, "teachingassistant") not in self.roles:
                    extra_roles.append(self.make_role("learner", user_id, course_id))
            if timestamp < submission.date_started:
                submission.date_started = timestamp
            if timestamp >= submission.date_last:
                submission.date_last = timestamp
                if row["CodeStateID"] not in (None, ""):
                    submission.last_code_state = row["CodeStateID"]

            event_type, category, label, message = self.invert_event(row, columns)
            if event_type == "Intervention" and category.lower() == "complete":
                # "Complete" feedback is what marks a submission correct in production.
                # (The dump's Score column misses these: the exporter compared the
                # category against "Complete", but production uses lowercase.)
                submission.correct = True
                submission.score = max(submission.score, 100)
            if event_type in CODE_EDIT_EVENT_TYPES:
                submission.edits += 1
            elif event_type in ("Run.Program", "Compile.Error"):
                submission.attempts += 1
            elif event_type == "X-Submission.LMS":
                if submission.date_submitted is None or timestamp >= submission.date_submitted:
                    submission.date_submitted = timestamp
                    _, subscore = parse_score(row["Score"] if "Score" in columns else "")
                    if subscore is not None:
                        submission.subscore = subscore
                        previous = self.assignment_points.get(assignment_id, 0)
                        self.assignment_points[assignment_id] = max(previous, subscore)

            if self.include_logs:
                stamp = format_timestamp(timestamp)
                log_batch.append((
                    stamp, stamp, submission.pk, submission.edits,
                    assignment_id, 0, course_id, user_id,
                    event_type, clean_text(row["CodeStateSection"]) if "CodeStateSection"
                    in columns else "", category, label, message, 0,
                    iso_to_blockpy_timestamp(row["ClientTimestamp"]
                                             if "ClientTimestamp" in columns else ""),
                    clean_text(row["ClientTimezone"]) if "ClientTimezone" in columns else "",
                ))
                if len(log_batch) >= LOG_BATCH_SIZE:
                    connection.executemany(log_sql, log_batch)
                    connection.commit()
                    log_batch.clear()

        if log_batch:
            connection.executemany(log_sql, log_batch)
        self.insert(connection, "role", [row for row in extra_roles if row])
        self.stats["roles"] += len([row for row in extra_roles if row])
        connection.commit()

    def finalize_submissions(self, connection):
        import math
        # Infer each assignment's point value: a submission's LMS subscore is its
        # earned points, so the max anyone earned approximates the points possible.
        # (Assignments nobody finished will underestimate; that is the best we have.)
        inferred_points = {assignment_id: max(1, int(math.ceil(max_subscore - 1e-9)))
                           for assignment_id, max_subscore in self.assignment_points.items()}
        connection.executemany("UPDATE assignment SET points=? WHERE id=?",
                               [(points, assignment_id)
                                for assignment_id, points in inferred_points.items()])
        connection.commit()

        for submission in self.submissions.values():
            if submission.subscore is not None:
                points = inferred_points.get(submission.assignment_id, 1)
                ratio = min(submission.subscore / points, 1.0)
                submission.score = max(submission.score, int(round(ratio * 100)))
                if ratio >= 1:
                    submission.correct = True

        click.echo(f"Writing {len(self.submissions)} submissions "
                   "(with final code states)...")
        submission_sql = """
            INSERT INTO submission (id, date_created, date_modified,
                code, extra_files, url, endpoint, score, correct,
                submission_status, grading_status, feedback, time_limit,
                date_started, date_submitted, date_graded, date_due, date_locked,
                assignment_id, assignment_group_id, course_id, user_id,
                assignment_version, version, attempts)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)"""
        batch = []
        for submission in tqdm(self.submissions.values(), unit="submissions"):
            code, extra_files = self.final_code_for(submission)
            due, locked = self.due_dates.get(
                (submission.course_id, submission.group_id), (None, None))
            if submission.correct:
                status, grading = "Completed", "FullyGraded"
            elif submission.date_submitted:
                status, grading = "Submitted", "FullyGraded"
            else:
                status, grading = "inProgress", "NotReady"
            batch.append((
                submission.pk,
                format_timestamp(submission.date_started),
                format_timestamp(submission.date_last),
                code, extra_files, f"submission_url-{uuid.uuid4()}", "",
                submission.score, 1 if submission.correct else 0,
                status, grading, "", "",
                format_timestamp(submission.date_started),
                format_timestamp(submission.date_submitted),
                format_timestamp(submission.date_submitted),
                format_timestamp(due), format_timestamp(locked),
                submission.assignment_id, submission.group_id,
                submission.course_id, submission.user_id,
                0, submission.edits, submission.attempts,
            ))
            if len(batch) >= SUBMISSION_BATCH_SIZE:
                connection.executemany(submission_sql, batch)
                connection.commit()
                batch.clear()
        if batch:
            connection.executemany(submission_sql, batch)
        connection.commit()
        self.stats["submissions"] = len(self.submissions)

    def final_code_for(self, submission):
        """Fetch the final code state of a submission: (code, extra_files JSON)."""
        if submission.last_code_state in (None, ""):
            return "", ""
        files = {}
        for filename, contents in self.source.connection.execute(
                "SELECT Filename, Contents FROM CodeState WHERE CodeStateID=?",
                (submission.last_code_state,)):
            files[str(filename)] = clean_text(contents)
        code = files.pop(MAIN_FILENAME, "")
        if not code:
            # Readings concatenate sections as answer.py#1, answer.py#2, ...
            sections = sorted((name for name in files if name.startswith(MAIN_FILENAME + "#")),
                              key=lambda name: (len(name), name))
            code = "\n".join(files.pop(name) for name in sections)
        extra = [{"filename": name, "contents": contents}
                 for name, contents in sorted(files.items())
                 if not name.startswith(MAIN_FILENAME + "#")]
        return code, json.dumps(extra) if extra else ""

    def run(self):
        connection = self.create_schema()
        try:
            self.import_metadata(connection)
            self.import_events(connection)
            self.finalize_submissions(connection)
        finally:
            connection.close()
        return self.stats


@cli.command("import_eol")
@click.option("--source", "-s", "source_path", required=True,
              type=click.Path(exists=True, dir_okay=False),
              help="The EOL-style SQLite dump to import.")
@click.option("--target", "-t", "target_path", default=os.path.join("instance", "main.db"),
              help="The BlockPy SQLite database file to create.")
@click.option("--students", "-n", default=0, type=int,
              help="Randomly sample this many students (0 imports everyone).")
@click.option("--seed", default=108, type=int, help="Random seed for student sampling.")
@click.option("--logs/--no-logs", "include_logs", default=True,
              help="Whether to import events into the submission_log table.")
@click.option("--edit-code/--no-edit-code", "include_edit_code", default=True,
              help="Whether File.Edit log messages include the full file contents "
                   "(matches production, but is by far the largest part of the import).")
@click.option("--limit", "event_limit", default=None, type=int,
              help="Stop after this many events (for testing).")
@click.option("--replace", "-f", is_flag=True, default=False,
              help="Overwrite the target database if it exists.")
@click.option("--user-password", default="password",
              help="The password that every imported user account gets.")
@click.option("--course-map", "course_map_path", default=None,
              type=click.Path(exists=True, dir_okay=False),
              help="CSV/TSV of production course id, url, name — gives real identities "
                   "to courses the dump only knows by number (e.g. template courses).")
def import_eol(source_path, target_path, students, seed, include_logs, include_edit_code,
               event_limit, replace, user_password, course_map_path):
    """Create a simulated BlockPy database from an EOL research data dump."""
    from flask import current_app

    target_path = os.path.abspath(target_path)
    if os.path.exists(target_path):
        if not replace and not click.confirm(
                f"{target_path} already exists. Delete it and reimport?"):
            click.echo("Aborting!")
            return
        try:
            os.remove(target_path)
        except PermissionError:
            click.echo(f"Could not delete {target_path}: another process has it open "
                       "(a running dev server, or a database viewer?). Close it and rerun.")
            return

    source = EolSource(source_path)
    if not source.has_table("MainTable"):
        click.echo(f"{source_path} does not look like an EOL dump (no MainTable).")
        source.close()
        return

    admin_email = current_app.config.get("ADMIN_EMAIL", "admin@example.com")
    admin_password = current_app.config.get("ADMIN_PASSWORD", "password")

    started = datetime.now(timezone.utc)
    course_map = load_course_map(course_map_path) if course_map_path else None
    importer = EolImporter(source, target_path, include_logs=include_logs,
                           include_edit_code=include_edit_code, students=students,
                           seed=seed, shared_password=user_password,
                           admin_email=admin_email, admin_password=admin_password,
                           event_limit=event_limit, course_map=course_map)
    try:
        stats = importer.run()
    finally:
        source.close()

    click.echo(f"Finished in {datetime.now(timezone.utc) - started}.")
    for name in ("users", "courses", "assignments", "groups", "memberships",
                 "roles", "submissions", "events", "skipped_events", "duplicate_events"):
        click.echo(f"  {name}: {stats.get(name, 0)}")
    click.echo(f"Admin login: {admin_email} (with the configured ADMIN_PASSWORD)")
    click.echo(f"All other users have the password: {user_password}")
    click.echo("Skipped (no home in the server schema): LinkDemographic, LinkSurvey, "
               "LinkGrade.")
    click.echo("Note: submission_counts were not generated; run "
               "`python manage.py add_missing_counters` if you need dashboards' metrics.")
