import sqlite3
from datetime import datetime
import io
import time
import json

from natsort import natsorted
from tqdm import tqdm

from models.assignment_group import AssignmentGroup
from models.course import Course
from models.data_formats.progsnap2 import to_progsnap_event, HEADERS, LINK_SUBJECT_HEADERS, get_course_users, \
    get_all_assignments_and_groups, LINK_ASSIGNMENT_GROUP_HEADERS, LINK_ASSIGNMENT_HEADERS
from models.log import Log
from models.user import User

try:
    profile
except:
    def profile(f):
        return f


def generate_readme(cursor, connection):
    cursor.execute("CREATE TABLE Readme(text)")
    cursor.execute("INSERT INTO Readme (text) VALUES (?)", ("Generated from BlockPy",))
    connection.commit()
    return "Readme.txt"

def generate_metadata(cursor, connection):
    cursor.execute("CREATE TABLE DatasetMetadata(Property, Value)")
    cursor.executemany("INSERT INTO DatasetMetadata (Property, Value) VALUES (?, ?)", [
        ("Version", "6"),
        ("IsEventOrderingConsistent", "false"),
        ("CodeStateRepresentation", "Directory")
    ])
    connection.commit()
    return "DatasetMetadata.csv"


class CodeStates:
    def __init__(self, cursor, connection):
        self.cursor = cursor
        self.connection = connection
        self._temp_connection = sqlite3.connect("")
        self._temp_cursor = self._temp_connection.cursor()
        self._temp_cursor.execute("CREATE TABLE TempCodeState (Hashed, ID)")
        self._temp_cursor.execute("CREATE INDEX TempCodeStateHashed ON TempCodeState (Hashed)")
        self._latest = None
        self._latest_key = None
        self._id = 0

    @profile
    def __getitem__(self, key):
        str_key = json.dumps(key)
        if self._latest_key == str_key:
            return self._latest[0]
        self._latest = self._temp_cursor.execute("SELECT ID FROM TempCodeState WHERE Hashed=?",
                                           (str_key,)).fetchone()
        if not self._latest:
            raise IndexError(f"Item missing from database: {str_key}")
        return self._latest[0]

    @profile
    def __setitem__(self, key, value):
        str_key = json.dumps(key)
        if value != self._id:
            raise ValueError(f"Inserting item out of order: {value} should be {self._id}")
        self._temp_cursor.execute("INSERT INTO TempCodeState (Hashed, ID) VALUES (?, ?)",
                            (str_key, value))
        self._temp_connection.commit()
        self._id += 1

    @profile
    def __contains__(self, key):
        str_key = json.dumps(key)
        self._latest = self._temp_cursor.execute("SELECT ID FROM TempCodeState WHERE Hashed=?",
                                           (str_key, )).fetchone()
        return bool(self._latest)

    def __len__(self):
        return self._id

    @profile
    def finish(self):
        self.cursor.execute("CREATE TABLE CodeState (ID, Filename, Contents)")
        self.connection.commit()
        rows = self._temp_cursor.execute("SELECT Hashed, ID FROM TempCodeState")
        for hashed, ID in rows.fetchall():
            original = json.loads(hashed)
            for filename, contents in original:
                self.cursor.execute("INSERT INTO CodeState (ID, Filename, Contents) "
                                    "VALUES (?, ?, ?)",
                                    (ID, filename, contents))
        self.connection.commit()
        self.cursor.execute("CREATE UNIQUE INDEX CodeStateIndex ON CodeState (ID, Filename)")
        self.connection.commit()
        self._temp_cursor.close()
        self._temp_connection.close()

@profile
def generate_maintable(cursor, connection, course_id, assignment_group_ids, user_ids, exclude):
    code_states = CodeStates(cursor, connection)
    latest_code_states, scores = {}, {}
    query = Log.query.filter_by(course_id=course_id)
    if assignment_group_ids is not None:
        assignment_ids = [assignment.id
                          for group_id in assignment_group_ids
                          for assignment in AssignmentGroup.by_id(group_id).get_assignments()]
        query = query.filter(Log.assignment_id.in_(assignment_ids))
    if exclude is not None:
        assignment_ids = [assignment.id
                          for group_id in exclude
                          for assignment in AssignmentGroup.by_id(group_id).get_assignments()]
        query = query.filter(Log.assignment_id.notin_(assignment_ids))
    if user_ids is not None:
        query = query.filter(Log.subject_id.in_(user_ids))
    estimated_size = query.count()
    logs = query.order_by(Log.date_created.asc()).yield_per(100)
    headers = ", ".join(map(repr, HEADERS))
    spots = ", ".join("?" for h in HEADERS)
    cursor.execute(f"CREATE TABLE MainTable ({headers})")
    connection.commit()
    order_id = 0
    for log in tqdm(logs, total=estimated_size):
        cursor.execute(f"INSERT INTO MainTable ({headers}) VALUES ({spots})",
                       to_progsnap_event(log, order_id, code_states, latest_code_states, scores))
        order_id += 1
    cursor.execute("CREATE UNIQUE INDEX MainTableIndex ON MainTable (EventID)")
    connection.commit()
    yield "MainTable.csv"
    code_states.finish()
    yield "CodeState.csv"


def generate_link_subjects(cursor, connection, course_id, user_ids):
    headers = ", ".join(map(repr, LINK_SUBJECT_HEADERS))
    spots = ", ".join("?" for h in LINK_SUBJECT_HEADERS)
    cursor.execute(f"CREATE TABLE LinkSubject ({headers})")
    connection.commit()
    users, user_roles = get_course_users(course_id, user_ids)

    # Report their information
    for user_id, user in natsorted(users.items(), lambda u: (u[1].last_name, u[1].first_name)):
        roles = user_roles[user_id]
        display_roles = ", ".join(sorted(roles))
        cursor.execute(f"INSERT INTO LinkSubject ({headers}) VALUES ({spots})",
                       [
                            user.id,  # SubjectId
                            bool(User.is_lti_instructor(roles)),  # X-IsStaff
                            display_roles,  # X-Roles
                            user.last_name,  # X-Name.Last
                            user.first_name,  # X-Name.First
                            user.email,  # X-Email
                        ])
    connection.commit()
    return "LinkTables/Subject.csv"


def generate_link_assignments(cursor, connection, course_id, assignment_group_ids, user_ids, exclude):
    headers = ", ".join(map(repr, LINK_ASSIGNMENT_HEADERS))
    spots = ", ".join("?" for h in LINK_ASSIGNMENT_HEADERS)
    cursor.execute(f"CREATE TABLE LinkAssignment ({headers})")
    connection.commit()

    assignments, assignment_groups, all_groups = get_all_assignments_and_groups(course_id, assignment_group_ids, exclude)

    for assignment in natsorted(assignments, key=lambda a: a.name):
        cursor.execute(f"INSERT INTO LinkAssignment ({headers}) VALUES ({spots})",
                       [
                            assignment.id, assignment.version,
                            assignment.name, assignment.url, assignment.instructions,
                            assignment.reviewed, assignment.hidden, assignment.settings, assignment.type,
                            assignment.on_run, assignment.on_change, assignment.on_eval,
                            assignment.starting_code, assignment.extra_instructor_files, assignment.extra_starting_files,
                            assignment.forked_id, assignment.forked_version,
                            assignment.owner_id, assignment.course_id,
                            ", ".join(map(str, (g.id for g in assignment_groups[assignment.id])))
                       ])
    connection.commit()
    yield "LinkTables/Assignment.csv"

    headers = ", ".join(map(repr, LINK_ASSIGNMENT_GROUP_HEADERS))
    spots = ", ".join("?" for h in LINK_ASSIGNMENT_GROUP_HEADERS)
    cursor.execute(f"CREATE TABLE LinkAssignmentGroup ({headers})")
    connection.commit()

    for group in natsorted(all_groups, key=lambda g: g.name):
        cursor.execute(f"INSERT INTO LinkAssignmentGroup ({headers}) VALUES ({spots})", [
            group.id, group.version,
            group.name, group.url,
            group.forked_id, group.forked_version,
            group.owner_id, group.course_id,
        ])
    connection.commit()
    yield "LinkTables/AssignmentGroup.csv"


def generate_link_table(cursor, connection):
    cursor.execute("CREATE TABLE LinkTable (Name)")
    connection.commit()
    cursor.executemany("INSERT INTO LinkTable (Name) VALUES (?)", [
        ("LinkSubject",),
        ("LinkAssignment",),
        ("LinkAssignmentGroup",),
    ])
    connection.commit()
    return "LinkTable.csv"


def dump(output_db, course_id, assignment_group_ids, user_ids, exclude):
    connection = sqlite3.connect(output_db)
    cursor = connection.cursor()
    yield generate_readme(cursor, connection)
    yield generate_metadata(cursor, connection)
    yield from generate_maintable(cursor, connection, course_id, assignment_group_ids, user_ids, exclude)
    yield generate_link_subjects(cursor, connection, course_id, user_ids)
    yield from generate_link_assignments(cursor, connection, course_id, assignment_group_ids, user_ids, exclude)
    yield generate_link_table(cursor, connection)
