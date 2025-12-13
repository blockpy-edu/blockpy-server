from ipaddress import ip_address, ip_network
from hmac import compare_digest
import json
from typing import Tuple, List, Optional, Any, TYPE_CHECKING
from dataclasses import dataclass

from flask import url_for
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import Column, String, Text, Integer, ForeignKey, UniqueConstraint, Boolean, Enum, Index
from werkzeug.utils import secure_filename
from slugify import slugify

import models
from common.dates import datetime_to_string
from common.databases import optional_encoded_field, make_copy, get_enum_values
from common.maybe import maybe_int
from common.text import make_flavored_uuid_generator
from models.enums import AssignmentStatus, AssignmentTypes, AssignmentLogEvent
from models.generics.definitions import LatePolicy
from models.generics.models import db, ma
from models.generics.base import EnhancedBase, Base
from models.data_formats.textbook import search_textbook_for_key, rehydrate_textbook
from models.assignment_tag_membership import assignment_tag_membership

if TYPE_CHECKING:
    from models import *


class Assignment(EnhancedBase):
    """
    An Assignment is one of the most core tables, representing an individual BlockPy problem.
    They can be accessed by their mostly-unique URL.

    An assignment belongs strongly to a specific course and user (via the `course` and `owner`
    fields). However, an Assignment can be used in a Submission for another Course.
    """
    __tablename__ = "assignment"

    name: Mapped[str] = mapped_column(String(255), default="Untitled")
    url: Mapped[Optional[str]] = mapped_column(String(255),
                                               default=make_flavored_uuid_generator('assignment'),
                                               nullable=True)
    status: Mapped[AssignmentStatus] = mapped_column(Enum(AssignmentStatus, values_callable=get_enum_values), default=AssignmentStatus.DRAFT)

    # Settings
    type: Mapped[AssignmentTypes] = mapped_column(Enum(AssignmentTypes, values_callable=get_enum_values), default=AssignmentTypes.READING)
    instructions: Mapped[str] = mapped_column(Text(), default="")
    # Should we suggest this assignment's submissions be reviewed manually?
    reviewed: Mapped[bool] = mapped_column(Boolean(), default=False)
    # Should we hide the current Complete status for submissions?
    hidden: Mapped[bool] = mapped_column(Boolean(), default=False)
    # Should we allow ANYONE to see this submission?
    public: Mapped[bool] = mapped_column(Boolean(), default=False)
    # Is this assignment meant to be used inside of another one?
    subordinate: Mapped[bool] = mapped_column(Boolean(), default=False)
    # Whitelist or blacklist IP address and address ranges
    ip_ranges: Mapped[str] = mapped_column(Text(), default="")
    # How many points is this assignment worth?
    points: Mapped[int] = mapped_column(Integer(), default=1)
    # Completely open-ended settings, stored as JSON
    settings: Mapped[Optional[str]] = mapped_column(Text())

    # Code columns
    on_run: Mapped[str] = mapped_column(Text(), default="")
    on_change: Mapped[str] = mapped_column(Text(), default="")
    on_eval: Mapped[str] = mapped_column(Text(), default="")
    starting_code: Mapped[str] = mapped_column(Text(), default="")
    extra_instructor_files: Mapped[str] = mapped_column(Text(), default="")
    extra_starting_files: Mapped[str] = mapped_column(Text(), default="")

    # Tracking
    forked_id: Mapped[Optional[int]] = mapped_column(Integer(), ForeignKey('assignment.id'), nullable=True)
    forked_version: Mapped[Optional[int]] = mapped_column(Integer(), nullable=True)
    owner_id: Mapped[int] = mapped_column(Integer(), ForeignKey('user.id'))
    course_id: Mapped[int] = mapped_column(Integer(), ForeignKey('course.id'))
    version: Mapped[int] = mapped_column(Integer(), default=0)

    # Relationships
    forked: Mapped["Assignment"] = db.relationship("Assignment", remote_side="Assignment.id", back_populates="forks",
                                                   viewonly=True)
    forks: Mapped["Assignment"] = db.relationship("Assignment", back_populates="forked", viewonly=True)
    owner: Mapped["User"] = db.relationship(back_populates="assignments")
    course: Mapped["Course"] = db.relationship(back_populates="assignments")
    tags: Mapped[list["AssignmentTag"]] = db.relationship(back_populates="assignments",
                                                          secondary=assignment_tag_membership)
    sample_submissions: Mapped[list["SampleSubmission"]] = db.relationship(back_populates="assignment")
    submission_logs: Mapped[list["SubmissionLog"]] = db.relationship(back_populates="assignment")
    assignment_logs: Mapped[list["AssignmentLog"]] = db.relationship(back_populates="assignment")
    submissions: Mapped[list["Submission"]] = db.relationship(back_populates="assignment")
    memberships: Mapped[list["AssignmentGroupMembership"]] = db.relationship(back_populates="assignment")
    reports: Mapped[list["Report"]] = db.relationship(back_populates="assignment")

    __table_args__ = (Index("assignment_url_index", "url"),
                      Index('assignment_course_index', "course_id"))

    # Override schema settings
    SCHEMA_V1_IGNORE_COLUMNS = EnhancedBase.SCHEMA_V1_IGNORE_COLUMNS + ('owner_id__email',)
    SCHEMA_V2_IGNORE_COLUMNS = EnhancedBase.SCHEMA_V2_IGNORE_COLUMNS + ('owner_id__email',)
    SCHEMA_V1_RENAME_COLUMNS = (("body", "instructions"), ("give_feedback", "on_run"),
                                ("on_step", "on_change"))

    # All the available filenames from BlockPy client
    INSTRUCTOR_FILENAMES = ("!on_run.py", "!on_change.py", "!on_eval.py",
                            "^starting_code.py", "!assignment_settings.blockpy", "!instructions.md",
                            "#extra_instructor_files.blockpy", "#extra_starting_files.blockpy")

    BUILTIN_MODULES = 'Properties,Decisions,Iteration,Calculation,Output,Values,Lists,Dictionaries,Separator,Input,Conversion'.split(
        ',')

    def encode_json(self, use_owner=True) -> dict:
        """
        Create a JSON representation of this object using the most recent schema version.
        :param use_owner:
        :return:
        """
        return {
            # Core identity
            '_schema_version': 2,
            'name': self.name,
            'url': self.url,
            # Major settings
            'type': self.type,
            'instructions': self.instructions,
            'reviewed': self.reviewed,
            'hidden': self.hidden,
            'public': self.public,
            'subordinate': self.subordinate,
            'points': self.points,
            'settings': self.settings,
            'ip_ranges': self.ip_ranges,
            # Code
            'on_run': self.on_run,
            'on_change': self.on_change,
            'on_eval': self.on_eval,
            'starting_code': self.starting_code,
            'extra_instructor_files': self.extra_instructor_files,
            'extra_starting_files': self.extra_starting_files,
            # Meta information
            'forked_id': self.forked_id,
            'forked_version': self.forked_version,
            'owner_id': self.owner_id,
            'owner_id__email': optional_encoded_field(self.owner_id, use_owner, models.User.query.get, 'email'),
            'course_id': self.course_id,
            'version': self.version,
            'id': self.id,
            'date_modified': datetime_to_string(self.date_modified),
            'date_created': datetime_to_string(self.date_created),
            # Heavy references
            'tags': [tag.encode_json(use_owner) for tag in self.tags],
            'sample_submissions': [sample.encode_json(use_owner) for sample in self.sample_submissions],
        }

    def encode_quiz_json(self):
        assignment = self.encode_json()
        assignment['on_run'] = ""
        assignment['on_change'] = ""
        assignment['on_eval'] = ""
        assignment['extra_instructor_files'] = ""
        assignment['extra_starting_files'] = ""
        return assignment

    def to_dict(self) -> dict:
        """
        Create a very simplified version of this assignment, just containing its name,
        ID, instructions, and title.
        :return:
        """
        return {
            'name': self.name,
            'id': self.id,
            'instructions': self.instructions,
            'title': self.title()
        }

    def __str__(self):
        return '<Assignment {} for {} ({})>'.format(self.id, self.course_id, self.url)

    def title(self) -> str:
        """ Create a human-readable version of the assigment's name. """
        if self.type == 'maze':
            return f"Maze {self.name}"
        return self.name if self.name != "Untitled" else "Untitled ({})".format(self.id)

    def slug(self) -> str:
        """ Create a URL-safe version of this assignment's name """
        return slugify(self.name)

    def get_filename(self, extension='.json') -> str:
        """ Create a File System-safe filename from this assignment's URL or name."""
        if self.url:
            return secure_filename(self.url) + extension
        else:
            return secure_filename(self.name) + extension

    def get_select_url(self, menu='embed'):
        # TODO: Refactor web logic outside of model?
        if self.url:
            return url_for('assignments.load', assignment_url=self.url, _external=True, embed=menu == 'embed', _scheme="https")
        return url_for('assignments.load', assignment_id=self.id, _external=True, embed=menu == 'embed', _scheme="https")

    def get_points(self):
        if self.points is None:
            return 1
        return self.points

    @staticmethod
    def get_available() -> 'List[Tuple[models.Assignment, models.AssignmentGroup]]':
        """ Get all the assignments in the course (along with their first Group) """
        assignments = Assignment.query.all()
        return [(assignment, (models.AssignmentGroup.query
                              .filter(models.AssignmentGroup.id == models.AssignmentGroupMembership.assignment_group_id,
                                      assignment.id == models.AssignmentGroupMembership.assignment_id)
                              .first()))
                for assignment in assignments]

    @staticmethod
    def new(owner_id, course_id, type="blockpy", name=None, level=None, url=None) -> 'models.Assignment':
        """ Create a new Assignment for the course and owner. """
        if name is None:
            name = 'Untitled'
        assignment = Assignment(owner_id=owner_id, course_id=maybe_int(course_id),
                                url=url,
                                type=type, name=level if type == 'maze' else name)
        db.session.add(assignment)
        db.session.commit()
        # Log the assignment creation
        models.AssignmentLog.new(assignment.id, assignment.version, assignment.course_id,
                                 owner_id, AssignmentLogEvent.CREATE, "assignment", "",
                                 "", "")
        return assignment

    def move_course(self, new_course_id: int):
        """ Move this assignment to a different course, removing its membership in the old course. """
        self.course_id = maybe_int(new_course_id)
        models.AssignmentGroupMembership.query.filter_by(assignment_id=self.id).delete()
        db.session.commit()

    @staticmethod
    def remove(assignment_id: int):
        """ Delete the assignment with the given ID. """
        # Log the assignment deletion before removing it
        assignment = Assignment.query.get(assignment_id)
        if assignment:
            models.AssignmentLog.new(assignment.id, assignment.version, assignment.course_id,
                                     assignment.owner_id, AssignmentLogEvent.DELETE, "assignment", "",
                                     "", "")
        # TODO: Clear anyone's Fork that is me
        # TODO: Clear assignment tag membership
        # TODO: Clear submission sample
        models.AssignmentGroupMembership.query.filter_by(assignment_id=assignment_id).delete()
        models.Submission.remove_by_assignment(assignment_id)
        models.SubmissionLog.remove_by_assignment(assignment_id)
        Assignment.query.filter_by(id=assignment_id).delete()
        db.session.commit()

    @staticmethod
    def is_in_course(assignment_id: int, course_id: int) -> bool:
        """ Determine if the given assignment belongs to the given course. """
        return Assignment.query.get(assignment_id).course_id == maybe_int(course_id)

    @staticmethod
    def by_course(course_id, exclude_builtins=True) -> 'List[models.Assignment]':
        """ Get all of the assignments that belong to the given course. """
        if exclude_builtins:
            return (Assignment.query.filter_by(course_id=maybe_int(course_id))
                    .filter(Assignment.type != 'maze')
                    .all())
        else:
            return Assignment.query.filter_by(course_id=maybe_int(course_id)).all()

    @staticmethod
    def by_url(assignment_url: Optional[str]) -> 'Optional[models.Assignment]':
        """ Retrieve the assignment by the given URL, or return None if it does not exist. """
        if assignment_url is None:
            return None
        return Assignment.query.filter_by(url=assignment_url).first()

    @staticmethod
    def id_by_url(assignment_url: str) -> Optional[int]:
        possible = Assignment.by_url(assignment_url)
        if possible:
            return possible.id
        return None

    @staticmethod
    def by_builtin(assignment_type: str, name: str, owner_id: int, course_id: int) -> 'models.Assignment':
        """ Retrieves or creates the given built-in assignment. """
        assignment = Assignment.query.filter_by(course_id=maybe_int(course_id),
                                                mode=assignment_type,
                                                name=name).first()
        if not assignment:
            assignment = Assignment.new(owner_id, maybe_int(course_id))
            assignment.mode = assignment_type
            assignment.name = name
            db.session.commit()
        return assignment

    @staticmethod
    def by_id_or_new(assignment_id: int, owner_id: int, course_id: int) -> 'models.Assignment':
        """ Retrieves or creates the given assignment, if it doesn't exist. """
        if assignment_id is None:
            assignment = None
        else:
            assignment = Assignment.query.get(assignment_id)
        if not assignment:
            assignment = Assignment.new(owner_id, maybe_int(course_id))
        return assignment

    def context_is_valid(self, context_id: str) -> bool:
        """ Determines whether or not the given context_id is the same as the assignment's
        course's external_id. Also returns False if the assignment's course is missing."""
        course = models.Course.query.get(self.course_id)
        if course:
            return course.external_id == context_id
        return False

    def load_or_new_submission(self, user_id: int, course_id: int,
                               new_submission_url="", assignment_group_id: int = None,
                               new_due_date='', new_lock_date='') -> 'models.Submission':
        """ Loads the relevant submission for this assignment given the user and course.
        If the Submission does not yet exist, then it is created.
        Potentially updates the new_submission_url and assignment_group_id too. """
        return models.Submission.load_or_new(self, user_id, maybe_int(course_id), new_submission_url, assignment_group_id,
                                             new_due_date, new_lock_date)

    def load(self, user_id: int, course_id: int) -> 'models.Submission':
        """ Loads the given submission """
        return models.Submission.get_submission(self.id, user_id, maybe_int(course_id))

    def for_read_only_editor(self, user_id: int, is_quiz: bool) -> dict:
        """
        Returns a JSON version of this assignment, without any submission data.
        """
        return {
            'assignment': self.encode_json() if not is_quiz else self.encode_quiz_json(),
            'submission': None
        }

    def for_editor(self, user_id: int, course_id: int, is_quiz: bool, with_history=False) -> dict:
        """ Returns a JSON version of this assignment, including the submission. """
        # Trust the user for now that they belong here, and give them a submission
        submission = (None if user_id is None else self.load_or_new_submission(user_id, maybe_int(course_id)))
        result = {
            'assignment': self.encode_json() if not is_quiz else self.encode_quiz_json(),
            'submission': submission.encode_json() if submission else None,
        }
        if with_history and submission:
            result['history'] = [history.encode_json() for history in submission.get_logs()]
        return result

    def save_file(self, filename: str, code: str):
        """
        Update the assignment with the new settings. Modifies the appropriate "file" intelligently
        based on the fields."""
        if filename == "!on_run.py":
            self.on_run = code
        elif filename == "!on_change.py":
            self.on_change = code
        elif filename == "!on_eval.py":
            self.on_eval = code
        elif filename == "^starting_code.py":
            self.starting_code = code
        elif filename == "!assignment_settings.blockpy":
            self.settings = code
        elif filename == "!instructions.md":
            self.instructions = code
        elif filename == "#extra_instructor_files.blockpy":
            self.extra_instructor_files = code
        elif filename == "#extra_starting_files.blockpy":
            self.extra_starting_files = code
        self.version += 1
        db.session.commit()

    @staticmethod
    def check_if_url_exists(url: str) -> bool:
        return Assignment.query.filter_by(url=url).first() is not None

    def fork(self, new_owner_id: int, new_course_id: int, new_name=None, new_url=None):
        assignment = Assignment(name=new_name if new_name is not None else make_copy(self.name),
                                url=new_url if new_url is not None else make_copy(self.url),
                                type=self.type,
                                instructions=self.instructions,
                                reviewed=self.reviewed,
                                hidden=self.hidden,
                                public=self.public,
                                subordinate=self.subordinate,
                                ip_ranges=self.ip_ranges,
                                points=self.points,
                                settings=self.settings,
                                on_run=self.on_run,
                                on_change=self.on_change,
                                on_eval=self.on_eval,
                                starting_code=self.starting_code,
                                extra_starting_files=self.extra_starting_files,
                                extra_instructor_files=self.extra_instructor_files,
                                forked_id=self.id,
                                forked_version=self.version,
                                owner_id=new_owner_id,
                                course_id=new_course_id,
                                version=0)
        # TODO: Copy tags, sample_submissions, submissions, files
        db.session.add(assignment)
        db.session.commit()
        # Log the fork event for the new assignment
        models.AssignmentLog.new(assignment.id, assignment.version, assignment.course_id,
                                 new_owner_id, AssignmentLogEvent.FORK, "forked_id", str(self.id),
                                 "", "")
        return assignment

    def is_allowed(self, ip: str) -> bool:
        """
        Given the IP address, determine if it is allowed to access this assignment.
        If the ip_ranges is blank or null, then any address is allowed.
        Otherwise, a comma separated string can be given.
        Each IP address given in the string is in the whitelist, unless it begins
        with ^ which means it is instantly rejected (blacklist), unless another begins
        with ! which means it will override the blacklist.
        IP Networks are supported, so you could have "192.168.0.0/24" as the ip_ranges
        and then both "192.168.0.0" and "192.168.0.5" would be accepted.

        If the string is non-empty, it is assumed that by default all addresses will be blocked.

        If an invalid `ip` is supplied, then it is blocked. If any of the `ip_ranges` are invalid,
        then they will be skipped.

        :param ip: String of IP Network Ranges or None
        :return: bool
        """
        ranges = self.ip_ranges
        if ranges is None or not ranges.strip():
            return True
        ranges = ranges.split(",")
        try:
            needle = ip_address(ip)
        except ValueError:
            return False
        allowed, blacklisted, whitelisted = False, False, False
        for network in ranges:
            network = network.strip()
            if not network:
                continue
            try:
                if network.startswith("^") and needle in ip_network(network[1:]):
                    blacklisted = True
                if network.startswith("!") and needle in ip_network(network[1:]):
                    whitelisted = True
                elif needle in ip_network(network):
                    allowed = True
            except ValueError:
                continue
        return whitelisted or (not blacklisted and allowed)

    def get_setting(self, key: str, default_value=None) -> Any:
        """ Retrieves the given value from the special `settings` field. """
        # TODO: Handle corrupted settings more elegantly.
        if not self.settings:
            return default_value
        settings = json.loads(self.settings)
        return settings.get(key, default_value)

    def update_setting(self, key: str, value: Any):
        """ Returns whether the given setting was changed """
        if not self.settings:
            self.settings = "{}"
        settings = json.loads(self.settings)
        old_value = settings.get(key)
        settings[key] = value
        self.settings = json.dumps(settings)
        self.version += 1
        db.session.commit()
        return old_value != value

    def update_ip_address(self, new_ip_ranges, is_instructor):
        # if is_instructor:
        #    self.edit(dict(ip_ranges=new_ip_ranges))
        #    return True
        try:
            new_ip_ranges = [network.strip() for network in new_ip_ranges.split(",")]
        except:
            return False
        protected_ip_ranges = self.get_setting('protected_ip_ranges', '')
        try:
            protected_ip_ranges = [network.strip() for network in protected_ip_ranges.split(",")]
        except:
            protected_ip_ranges = []
        for protected_value in protected_ip_ranges:
            if protected_value not in new_ip_ranges:
                new_ip_ranges.insert(0, protected_value)
        new_ip_ranges = ",".join(new_ip_ranges)
        self.edit(dict(ip_ranges=new_ip_ranges))
        return True

    def passcode_fails(self, given_passcode: str) -> bool:
        """
        Determine if the given string matches this assignments' stored passcode, or that
        there is no stored passcode. Uses a proper constant-time string comparison to
        avoid timing attacks.

        :param given_passcode: the user provided passcode (probably via requests.values).
        :return: Whether the passcode failed
        """
        actual_passcode = self.get_setting("passcode", "")
        return actual_passcode and not compare_digest(given_passcode, actual_passcode)

    def has_passcode(self) -> bool:
        """ Identifies whether this assignment has a passcode set. """
        return bool(self.get_setting("passcode", ""))

    @classmethod
    def list_urls(self, partial) -> list[str]:
        all_assignments = (db.session.query(Assignment.url)
                           .filter(Assignment.url.ilike("%" + partial + "%"))
                           .all())
        all_assignments = [a[0] for a in all_assignments]
        all_assignments = sorted(all_assignments,
                                 key=lambda a: (not a.startswith(partial),
                                                not a.lower().startswith(partial.lower()),
                                                a))
        return all_assignments

    @classmethod
    def get_textbooks(cls, user_id=None):
        query = cls.query.filter_by(type='textbook')
        if user_id is None:
            query = query.filter_by(public=True)
        # Also textbooks owned by the user or in a course the user owns
        else:
            query = query.filter((cls.public) |
                                 (cls.owner_id == user_id) |
                                 (cls.course_id.in_(db.session.query(models.Course.id)
                                                    .filter_by(owner_id=user_id))))
        return query.all()

    def load_as_textbook(self):
        try:
            textbook = json.loads(self.instructions)
            reading_urls = list(search_textbook_for_key(textbook, 'reading'))
            group_urls = list(search_textbook_for_key(textbook, 'group'))
            db_readings = {a.url: a for a in db.session.query(Assignment)
            .filter(Assignment.url.in_(reading_urls))
            .all()}
            db_groups = {g.url: g for g in db.session.query(models.AssignmentGroup)
            .filter(models.AssignmentGroup.url.in_(group_urls))
            .all()}
            rehydrate_textbook(textbook, db_readings, db_groups)
            if reading_urls:
                first_page = db_readings[reading_urls[0]]
            else:
                first_page = None
            textbook['success'] = True
            return textbook, first_page
        except Exception as e:
            return {"message": e, "success": False}, 0

    def find_all_linked_resources(self) -> dict[str, list[Base]]:
        # Get any assignments that are forked from this one
        forked = Assignment.query.filter_by(forked_id=self.id).all()
        resources = {
            "Assignment": forked,
            "AssignmentTag": self.tags,
            "SampleSubmission": self.sample_submissions,
            "Memberships": self.memberships,
            "Logs": self.logs,
            "Submission": self.submissions,
            "Report": self.reports
        }
        return resources

    def get_late_policy(self, course_id=None):
        late_policy = None
        # Try getting it from the assignment
        settings = json.loads(self.settings or "{}")
        if 'late_policy' in settings:
            late_policy = settings.get('late_policy')
        # If that fails, try to get it from the course
        if not late_policy:
            if course_id is None:
                course_id = self.course_id
            course = models.Course.query.get(maybe_int(course_id))
            settings = json.loads(course.settings or "{}")
            if 'late_policy' in settings:
                late_policy = settings['late_policy']
            else:
                return None
        # Return whatever we got
        return LatePolicy(late_policy.get('allowed', True),
                          late_policy.get('interval', 'hours'),
                          late_policy.get('amount', "1%"),
                          late_policy.get("rounding", "round"),
                          late_policy.get("max_penalty", "50%"),
                          late_policy.get('disabled', False))

    @classmethod
    def get_timed_assignments(cls):
        """
        Get all assignments that have a time limit set.
        :return: List of assignments with time limits.
        """
        potential_assignments = (cls.query.filter(cls.settings.isnot(None))
                .filter(cls.settings != "")
                .filter(cls.settings.contains('"time_limit"'))
                .all())
        assignments = []
        for potential_assignment in potential_assignments:
            time_limit_settings = potential_assignment.get_setting('time_limit', None)
            if time_limit_settings is not None:
                assignments.append(potential_assignment)
        return assignments
