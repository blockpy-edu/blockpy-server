import json
from typing import Optional, TYPE_CHECKING

from sqlalchemy.orm import Mapped, mapped_column, defer, selectinload
from sqlalchemy import Column, String, Integer, ForeignKey, Text, or_, Boolean, Enum, Index, exists, and_, select
from marshmallow import fields
from werkzeug.utils import secure_filename

import models
from common.maybe import maybe_int
from common.text import make_flavored_uuid_generator
from models.enums import CourseVisibility, CourseKind, CourseService, CourseLogEvent
from models.generics.models import db, ma
from models.generics.base import EnhancedBase, Base, VersionedBase
from common.dates import datetime_to_string, string_to_datetime
from common.databases import get_enum_values
from models.enums import GradingStatuses

if TYPE_CHECKING:
    from models import *


class CourseHasSubmissions(ValueError):
    """ Raised by Course.remove when student work would be destroyed without remove_linked. """
    def __init__(self, course_id, count):
        super().__init__(f"Course {course_id} has {count} submission(s); archive it instead of deleting it, "
                         f"or delete it from the command line with --remove-linked.")
        self.course_id = course_id
        self.count = count


class Course(Base):
    __tablename__ = "course"

    name: Mapped[str] = mapped_column(String(255))
    url: Mapped[Optional[str]] = mapped_column(String(255),
                                               default=make_flavored_uuid_generator("course"),
                                               nullable=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey('user.id'))

    kind: Mapped[CourseKind] = mapped_column(Enum(CourseKind, values_callable=get_enum_values), default=CourseKind.DEFAULT)
    service: Mapped[CourseService] = mapped_column(Enum(CourseService, values_callable=get_enum_values), default=CourseService.NATIVE)
    external_id: Mapped[str] = mapped_column(String(255), default="")
    lms_id: Mapped[Optional[int]] = mapped_column(Integer(), default=None, nullable=True)
    endpoint: Mapped[str] = mapped_column(Text(), default="")
    version: Mapped[int] = mapped_column(Integer(), default=0)

    visibility: Mapped[CourseVisibility] = mapped_column(Enum(CourseVisibility, values_callable=get_enum_values), default=CourseVisibility.PRIVATE)
    term: Mapped[str] = mapped_column(String(255), default="")
    settings: Mapped[str] = mapped_column(Text(), default="")
    locked: Mapped[bool] = mapped_column(Boolean(), default=False, nullable=False)

    owner: Mapped["User"] = db.relationship(back_populates="courses")
    roles: Mapped[list["Role"]] = db.relationship(back_populates="course")
    assignments: Mapped[list["Assignment"]] = db.relationship(back_populates="course")
    assignment_groups: Mapped[list["AssignmentGroup"]] = db.relationship(back_populates="course")
    tags: Mapped[list["AssignmentTag"]] = db.relationship(back_populates="course")
    course_logs: Mapped[list["CourseLog"]] = db.relationship(back_populates="course", passive_deletes=True,
                                                            primaryjoin="foreign(CourseLog.course_id) == Course.id")
    role_logs: Mapped[list["RoleLog"]] = db.relationship(back_populates="course", passive_deletes=True,
                                                        primaryjoin="foreign(RoleLog.course_id) == Course.id")
    assignment_logs: Mapped[list["AssignmentLog"]] = db.relationship(back_populates="course", passive_deletes=True,
                                                                    primaryjoin="foreign(AssignmentLog.course_id) == Course.id")
    submission_logs: Mapped[list["SubmissionLog"]] = db.relationship(back_populates="course")
    submissions: Mapped[list["Submission"]] = db.relationship(back_populates="course")
    invites: Mapped[list["Invite"]] = db.relationship(back_populates="course")
    reports: Mapped[list["Report"]] = db.relationship(back_populates="course")

    __table_args__ = (Index('course_url_index', "url"),)

    def encode_json(self):
        user = models.User.query.get(self.owner_id)
        return {'_schema_version': 3,
                'name': self.name,
                'url': self.url,
                'owner_id': self.owner_id,
                'owner_id__email': user.email if user else '',
                'service': self.service,
                'external_id': self.external_id,
                'endpoint': self.endpoint,
                'visibility': self.visibility,
                'settings': self.settings,
                'term': self.term,
                'id': self.id,
                'date_modified': datetime_to_string(self.date_modified),
                'date_created': datetime_to_string(self.date_created)}

    SCHEMA_V1_IGNORE_COLUMNS = EnhancedBase.SCHEMA_V1_IGNORE_COLUMNS + ('owner_id__email',)
    SCHEMA_V2_IGNORE_COLUMNS = EnhancedBase.SCHEMA_V2_IGNORE_COLUMNS + ('owner_id__email',)
    SCHEMA_V3_IGNORE_COLUMNS = SCHEMA_V2_IGNORE_COLUMNS


    @staticmethod
    def export(course_id):
        course_id = maybe_int(course_id)
        course = Course.query.get(course_id)
        # Get all course's assignments
        course_assignments = models.Assignment.by_course(course_id, False)
        # Get all course's assignment groups
        groups = course.get_assignment_groups()
        # Get all assignment groups' memberships
        memberships = models.AssignmentGroupMembership.by_course(course_id)
        # Get all assignment groups' assignments in one join, instead of one
        # query per group
        group_ids = [g.id for g in groups]
        grouped_assignments = []
        if group_ids:
            grouped_assignments = (models.Assignment.query
                .join(models.AssignmentGroupMembership,
                      models.AssignmentGroupMembership.assignment_id == models.Assignment.id)
                .filter(models.AssignmentGroupMembership.assignment_group_id.in_(group_ids))
                .all())
        groups_assignments = set(grouped_assignments)
        groups_assignments.update(course_assignments)
        # Preload each assignment's tags and sample submissions in two batched
        # queries, rather than two lazy loads per assignment during encoding
        assignment_ids = [a.id for a in groups_assignments]
        if assignment_ids:
            (models.Assignment.query
             .options(selectinload(models.Assignment.tags),
                      selectinload(models.Assignment.sample_submissions))
             .filter(models.Assignment.id.in_(assignment_ids))
             .all())
        # Load every owner in one query; the per-object User.query.get calls in
        # the encoders then resolve from the session's identity map without SQL
        owner_ids = {course.owner_id}
        owner_ids.update(g.owner_id for g in groups)
        for a in groups_assignments:
            owner_ids.add(a.owner_id)
            owner_ids.update(tag.owner_id for tag in a.tags)
            owner_ids.update(sample.owner_id for sample in a.sample_submissions)
        owner_ids.discard(None)
        # Hold the loaded owners in a local so the identity map (weak
        # references) keeps them until encoding is done
        _owners = (models.User.query.filter(models.User.id.in_(owner_ids)).all()
                   if owner_ids else [])

        assignment_groups = [a.encode_json() for a in groups]
        assignment_memberships = [a.encode_json() for a in memberships]
        assignments = [a.encode_json() for a in groups_assignments]
        assignments.sort(key=lambda a: a['name'])
        return {
            'course': course.encode_json(),
            'assignments': assignments,
            'assignment_groups': assignment_groups,
            'assignment_memberships': assignment_memberships
        }

    def __str__(self):
        return '<Course {}>'.format(self.id)

    @staticmethod
    def get_default():
        return Course.by_url('default')

    def get_url_or_id(self):
        return self.url or str(self.id)

    @staticmethod
    def get_public():
        return Course.query.filter_by(visibility=CourseVisibility.PUBLIC).all()

    @staticmethod
    def count_submissions_blocking_removal(course_id) -> int:
        """
        Submissions that removing this course would destroy: those made in the course, and
        those made anywhere to assignments the course owns (adopted or forked-from elsewhere).
        """
        course_id = maybe_int(course_id)
        owned = db.session.query(models.Assignment.id).filter(models.Assignment.course_id == course_id)
        return (models.Submission.query
                .filter(or_(models.Submission.course_id == course_id,
                            models.Submission.assignment_id.in_(owned)))
                .count())

    @staticmethod
    def remove(course_id, remove_linked=False):
        """
        Delete a course and everything that belongs to it: roles, invites, tags, groups,
        memberships and assignments; reports are unlinked. Audit rows are kept.

        Student work is only destroyed when `remove_linked` is set. Without it, a course
        that has submissions (its own, or to assignments it owns) raises CourseHasSubmissions
        and nothing is deleted; the web interface archives such courses instead.
        """
        course_id = maybe_int(course_id)
        blocking = Course.count_submissions_blocking_removal(course_id)
        if blocking and not remove_linked:
            raise CourseHasSubmissions(course_id, blocking)
        owned_assignments = db.session.query(models.Assignment.id).filter(models.Assignment.course_id == course_id)
        owned_groups = db.session.query(models.AssignmentGroup.id).filter(models.AssignmentGroup.course_id == course_id)
        quietly = dict(synchronize_session=False)
        # Student work first (only reached with remove_linked, or when there is none)
        doomed = db.session.query(models.Submission.id).filter(
            or_(models.Submission.course_id == course_id, models.Submission.assignment_id.in_(owned_assignments)))
        models.SubmissionCounts.query.filter(models.SubmissionCounts.submission_id.in_(doomed)).delete(**quietly)
        models.GradeHistory.query.filter(models.GradeHistory.submission_id.in_(doomed)).delete(**quietly)
        models.Review.query.filter(models.Review.submission_id.in_(doomed)).delete(**quietly)
        (models.SampleSubmission.query.filter(models.SampleSubmission.forked_id.in_(doomed))
         .update({"forked_id": None}, **quietly))
        models.SubmissionLog.query.filter(or_(models.SubmissionLog.submission_id.in_(doomed),
                                              models.SubmissionLog.course_id == course_id)).delete(**quietly)
        models.Submission.query.filter(models.Submission.id.in_(doomed)).delete(**quietly)
        # Assignments the course owns, and what hangs off them
        models.AssignmentGroupMembership.query.filter(or_(
            models.AssignmentGroupMembership.assignment_id.in_(owned_assignments),
            models.AssignmentGroupMembership.assignment_group_id.in_(owned_groups))).delete(**quietly)
        db.session.execute(models.assignment_tag_membership.delete().where(
            models.assignment_tag_membership.c.assignment_id.in_(owned_assignments)))
        models.SampleSubmission.query.filter(models.SampleSubmission.assignment_id.in_(owned_assignments)).delete(**quietly)
        models.Report.query.filter(models.Report.assignment_id.in_(owned_assignments)).update({"assignment_id": None}, **quietly)
        models.Assignment.query.filter(models.Assignment.forked_id.in_(owned_assignments)).update({"forked_id": None}, **quietly)
        models.Assignment.query.filter(models.Assignment.course_id == course_id).delete(**quietly)
        models.AssignmentGroup.query.filter(models.AssignmentGroup.forked_id.in_(owned_groups)).update({"forked_id": None}, **quietly)
        models.AssignmentGroup.query.filter(models.AssignmentGroup.course_id == course_id).delete(**quietly)
        # The course's own rows
        models.AssignmentTag.query.filter(models.AssignmentTag.course_id == course_id).delete(**quietly)
        models.Invite.query.filter(models.Invite.course_id == course_id).delete(**quietly)
        models.Report.query.filter(models.Report.course_id == course_id).update({"course_id": None}, **quietly)
        models.Role.query.filter(models.Role.course_id == course_id).delete(**quietly)
        Course.query.filter_by(id=course_id).delete(**quietly)
        db.session.commit()

    @staticmethod
    def parse_visibility(visibility) -> Optional[CourseVisibility]:
        """ Turn user input like "Public" into a CourseVisibility, or None if it is not one. """
        try:
            return CourseVisibility(visibility.lower())
        except (ValueError, AttributeError):
            return None

    @staticmethod
    def change_course_visibility(course_id, visibility, subject_id):
        course = Course.query.filter_by(id=course_id).first()
        visibility = Course.parse_visibility(visibility)
        if course and visibility is not None:
            course.visibility = visibility
            db.session.commit()
            models.CourseLog.new(course.id, subject_id, CourseLogEvent.EDIT,
                                 field="visibility", value=str(course.visibility))
            return True
        return False

    def get_users(self, roles=None):
        if roles is None:
            return (db.session.query(models.Role, models.User)
                    .filter(models.Role.course_id == self.id)
                    .filter(models.Role.user_id == models.User.id).all())
        else:
            return (db.session.query(models.Role, models.User)
                    .filter(models.Role.course_id == self.id)
                    .filter(models.Role.user_id == models.User.id)
                    .filter(models.Role.name.in_(roles)).all())

    def get_students(self, sort_order=None):
        students = (db.session.query(models.Role, models.User)
                               .filter(models.Role.course_id == self.id)
                               .filter(models.Role.user_id == models.User.id))
        if sort_order == 'last_name':
            students = students.order_by(models.User.last_name)
        elif sort_order == 'first_name':
            students = students.order_by(models.User.first_name)
        elif sort_order == 'email':
            students = students.order_by(models.User.email)
        return [x[1] for x in students.distinct()]

    def get_assignments(self):
        return (db.session.query(models.Assignment, models.AssignmentGroupMembership)
                .filter(models.Assignment.course_id == self.id,
                        models.AssignmentGroupMembership.assignment_id == models.Assignment.id)
                .all())

    def get_submitted_assignments(self):
        assignments = (models.Submission.query.with_entities(models.Submission.assignment_id)
                                        .filter_by(course_id=self.id)
                                        .distinct().subquery())
        return (db.session.query(models.Assignment)
                .filter(models.Assignment.id.in_(assignments))
                .distinct())

    def get_users_submitted_assignments(self, user_ids=None, limit=None, offset=None):
        # Defer the large Text columns (student code, feedback, assignment bodies)
        # since callers only need metadata, and preload reviews for full_score().
        query = (db.session.query(models.Submission, models.User, models.Assignment)
                .join(models.Submission,
                      models.Submission.assignment_id == models.Assignment.id)
                .join(models.User,
                      models.Submission.user_id == models.User.id)
                .options(defer(models.Submission.code),
                         defer(models.Submission.extra_files),
                         defer(models.Submission.feedback),
                         selectinload(models.Submission.reviews),
                         defer(models.Assignment.instructions),
                         defer(models.Assignment.on_run),
                         defer(models.Assignment.on_change),
                         defer(models.Assignment.on_eval),
                         defer(models.Assignment.starting_code),
                         defer(models.Assignment.extra_instructor_files),
                         defer(models.Assignment.extra_starting_files))
                .filter(models.Submission.course_id==self.id))
        if user_ids is not None:
            query = query.filter(models.User.id.in_(user_ids))
        if offset is not None:
            query = query.offset(offset)
        if limit is not None:
            query = query.limit(limit)
        return query.all()

    def get_users_submitted_assignments_grouped(self, user_id):
        return (db.session.query(models.Submission, models.Assignment, models.AssignmentGroup)
                .join(models.Submission,
                      models.Submission.assignment_id == models.Assignment.id)
                .join(models.AssignmentGroupMembership,
                      models.AssignmentGroupMembership.assignment_id == models.Assignment.id, isouter=True)
                .join(models.AssignmentGroup,
                      models.AssignmentGroupMembership.assignment_group_id == models.AssignmentGroup.id, isouter=True)
                .filter(models.Submission.course_id==self.id,
                        models.Submission.user_id==user_id)
                .order_by(models.Assignment.name) # , models.AssignmentGroupMembership.position)
                .distinct())

    def get_submitted_assignments_grouped(self, by_type=None):
        # https://docs.sqlalchemy.org/en/20/changelog/migration_20.html#using-distinct-with-additional-columns-but-only-select-the-entity
        # No longer sorting based on AssignmentGroupMembership.position due to the above
        # This feature was never actually used anyway
        sub_exists = exists().where(and_(
            models.Submission.course_id == self.id,
            models.Submission.assignment_id == models.Assignment.id,
        ))
        #assignments = (models.Submission.query.with_entities(models.Submission.assignment_id)
        #               .filter_by(course_id=self.id)
        #               .distinct().subquery())
        query = (db.session.query(models.Assignment, models.AssignmentGroup)
                 .join(models.AssignmentGroupMembership,
                       models.AssignmentGroupMembership.assignment_id == models.Assignment.id, isouter=True)
                 .join(models.AssignmentGroup,
                       models.AssignmentGroupMembership.assignment_group_id == models.AssignmentGroup.id, isouter=True)
                 .filter(sub_exists)
                 .filter(#models.Assignment.id.in_(assignments),
                         or_(models.AssignmentGroup.course_id == self.id,
                             models.AssignmentGroup.course_id == models.Assignment.course_id,
                             models.AssignmentGroup.id.is_(None))))
        if by_type is not None:
            query = query.filter(models.Assignment.type == by_type)
        return (query.order_by(models.Assignment.name) # , models.AssignmentGroupMembership.position)
                     .distinct()
                )

    def get_assignments_grouped(self):
        return (db.session.query(models.Assignment, models.AssignmentGroup)
                .join(models.AssignmentGroupMembership,
                      models.AssignmentGroupMembership.assignment_id == models.Assignment.id, isouter=True)
                .join(models.AssignmentGroup,
                      models.AssignmentGroupMembership.assignment_group_id == models.AssignmentGroup.id, isouter=True)
                .filter(models.Assignment.course_id == self.id,
                        or_(models.AssignmentGroup.course_id == self.id,
                            models.AssignmentGroup.course_id == models.Assignment.course_id,
                            models.AssignmentGroup.id.is_(None)))
                .order_by(models.Assignment.name) #, models.AssignmentGroupMembership.position)
                .distinct())

    def get_submissions(self, assignments=None):
        query = (db.session.query(models.Submission)
                           .filter(models.Submission.course_id == self.id))
        if assignments is not None:
            if isinstance(assignments, str):
                assignments = [int(assignments)]
            elif isinstance(assignments, int):
                assignments = [assignments]
            query = query.filter(models.Submission.assignment_id.in_(assignments))
        return query.all()

    def get_grading_failures(self):
        return (db.session.query(models.Submission, models.User, models.Assignment, models.Role)
                .filter(models.Submission.course_id == self.id)
                .filter(models.Submission.grading_status == GradingStatuses.FAILED)
                .filter(models.Submission.user_id == models.User.id)
                .filter(models.Submission.assignment_id == models.Assignment.id)
                .filter(models.Role.course_id == self.id)
                .filter(models.Role.user_id == models.User.id)
                .filter(models.Role.name.ilike("%learner%"))
                .all())

    def get_assignment_groups(self):
        return (db.session.query(models.AssignmentGroup)
                .filter(models.AssignmentGroup.course_id == self.id)
                .order_by(models.AssignmentGroup.name)
                .all())

    def update_endpoint(self, endpoint):
        self.endpoint = endpoint
        db.session.commit()

    @staticmethod
    def get_all_groups(menu='embed'):
        courses = Course.query.all()
        return [{'id': course.id,
                 'name': course.name,
                 'url': course.url,
                 'date_created': course.date_created,
                 'groups': [{'id': group.id,
                             'name': group.name,
                             'url': group.url,
                             'select_url': group.get_select_url(menu),
                             'link': group.get_select_url(menu)}
                            for group in models.AssignmentGroup.by_course(course.id)]
                 }
                for course in courses]

    @staticmethod
    def rename(course_id, name, subject_id):
        course = Course.by_id(course_id)
        course.name = name
        db.session.commit()
        models.CourseLog.new(course.id, subject_id, CourseLogEvent.RENAME, value=name)
        return course

    def edit(self, subject_id, name=None, url=None, visibility=None, term=None, settings=None):
        """
        Update any of the given fields that actually differ from their current value,
        logging one EDIT row per changed field. Returns whether anything changed.
        """
        changes = {}
        for field, value in (("name", name), ("url", url), ("visibility", visibility),
                             ("term", term), ("settings", settings)):
            if value is not None and getattr(self, field) != value:
                setattr(self, field, value)
                changes[field] = value
        if not changes:
            return False
        db.session.commit()
        for field, value in changes.items():
            models.CourseLog.new(self.id, subject_id, CourseLogEvent.EDIT,
                                 field=field, value=str(value))
        return True

    @staticmethod
    def new(name, owner_id, visibility, term, url):
        visibility = Course.parse_visibility(visibility) or CourseVisibility.PRIVATE
        if url:
            existing_course = Course.by_url(url)
            if existing_course:
                return None
        new_course = Course(name=name, owner_id=owner_id, visibility=visibility, term=term, url=url)
        db.session.add(new_course)
        db.session.flush()
        models.CourseLog.new(new_course.id, owner_id, CourseLogEvent.CREATE)
        models.Role.new(name='instructor', user_id=owner_id, course_id=new_course.id,
                        authorizer_id=owner_id)
        return new_course

    @staticmethod
    def new_lti_course(service, external_id, name, user_id, endpoint=""):
        new_course = Course(name=name, owner_id=user_id,
                            service=service, external_id=external_id,
                            endpoint=endpoint)
        db.session.add(new_course)
        db.session.commit()
        models.CourseLog.new(new_course.id, user_id, CourseLogEvent.CREATE)
        return new_course

    @staticmethod
    def by_url(course_url):
        return Course.query.filter_by(url=course_url).first()

    @staticmethod
    def by_id_or_url(course_id_or_url):
        return (Course.query.filter_by(id=course_id_or_url).first() or
                Course.query.filter_by(url=course_id_or_url).first())

    @staticmethod
    def from_lti(service, lti_context_id, name, user_id, endpoint=""):
        lti_course = Course.query.filter_by(external_id=lti_context_id).first()
        if lti_course is None:
            return Course.new_lti_course(service=service,
                                         external_id=lti_context_id,
                                         name=name,
                                         user_id=user_id,
                                         endpoint=endpoint)
        else:
            # Update endpoint if it changes
            if endpoint != "" and lti_course.endpoint != endpoint:
                lti_course.endpoint = endpoint
                db.session.commit()
                models.CourseLog.new(lti_course.id, user_id, CourseLogEvent.EDIT,
                                     field="endpoint", value=endpoint)
            return lti_course

    def grading_grid(self):
        # Return a list of lists of assignments/students/submissions
        assignments = []
        submissions = []
        return assignments, submissions

    def get_default_assignment(self):
        """
        For now, the default assignment URL is just the course URL appended with "_default"

        If the assignment does not exist already, it will be created.

        If there is no course url, then no assignment is created.

        :return:
        """
        if not self.url:
            return None
        default_assignment_url = self.url+"_default"
        default_assignment = models.Assignment.by_url(default_assignment_url)
        if not default_assignment:
            default_assignment = self.make_default_assignment(default_assignment_url)
        return default_assignment

    def make_default_assignment(self, default_assignment_url):
        new_assignment = models.Assignment(name="Default Scratchpad", url=default_assignment_url,
                                           type="blockpy", instructions="You may write whatever you want here. It will not be graded.",
                                           reviewed=False, hidden=False, public=self.visibility == CourseVisibility.PUBLIC,
                                           settings='{"disable_feedback": true}', owner_id=self.owner_id, course_id=self.id, )
        db.session.add(new_assignment)
        db.session.commit()
        return new_assignment

    def get_filename(self):
        if self.url:
            return secure_filename(self.url) + ".json"
        else:
            return secure_filename(self.name) + ".json"

    def get_setting(self, key, default_value):
        try:
            result = json.loads(self.settings)
            if not isinstance(result, dict):
                return default_value
            return result.get(key, default_value)
        except (TypeError, json.JSONDecodeError) as e:
            return default_value

    def get_all_settings(self):
        try:
            result = json.loads(self.settings)
            if isinstance(result, dict):
                return result
            else:
                return {}
        except (TypeError, json.JSONDecodeError) as e:
            return {}

    def set_setting(self, key, value, user_id: int):
        """
        Set one key of the course's JSON settings, on behalf of the given user.
        If the existing settings cannot be parsed, they are logged as CORRUPTED and reset.
        """
        try:
            result = json.loads(self.settings)
        except (TypeError, json.JSONDecodeError):
            result = None
        if not isinstance(result, dict):
            if self.settings:
                models.CourseLog.new(self.id, user_id, CourseLogEvent.CORRUPTED,
                                     field="settings", value=self.settings)
            result = {}
        result[key] = value
        self.settings = json.dumps(result)
        db.session.commit()
        models.CourseLog.new(self.id, user_id, CourseLogEvent.EDIT,
                             field="settings", value=json.dumps({key: value}))
        return True

    def get_textbooks(self):
        textbook_urls = self.get_setting('textbooks', [])
        associated_textbooks = (db.session.query(models.Assignment)
                                .filter(models.Assignment.url.in_(textbook_urls))
                                .all())
        course_textbooks = (db.session.query(models.Assignment)
                             .filter(models.Assignment.course_id == self.id, models.Assignment.type == 'textbook')
                             .all())
        course_textbooks.extend(associated_textbooks)
        return course_textbooks

    def do_textbook_action(self, action, textbook_url, user_id) -> str:
        if action == 'add':
            textbook_urls = self.get_setting('textbooks', [])
            textbook_urls.append(textbook_url)
            self.set_setting('textbooks', textbook_urls, user_id)
            return f"Added textbook '{textbook_url}' to course '{self.url}'"
        if action == 'remove':
            textbook_urls = self.get_setting('textbooks', [])
            if textbook_url in textbook_urls:
                textbook_urls.remove(textbook_url)
                self.set_setting('textbooks', textbook_urls, user_id)
                return f"Removed textbook '{textbook_url}' from course '{self.url}'"
            else:
                return f"Textbook '{textbook_url}' not found in course '{self.url}'"
        return f"Invalid action '{action}' for textbook '{textbook_url}'. No action taken."

    def get_filtered_submissions(self, assignment_ids, assignment_group_ids, student_ids, role_names):
        subs = models.Submission.query.filter(models.Submission.course_id==self.id)
        if assignment_ids:
            subs = subs.filter(models.Submission.assignment_id.in_(assignment_ids))
        if assignment_group_ids:
            subs = subs.filter(models.Submission.assignment_group_id.in_(assignment_group_ids))
        if student_ids:
            subs = subs.filter(models.Submission.user_id.in_(student_ids))
        if role_names:
            user_ids = [user.id for role, user in self.get_users(role_names)]
            subs = subs.filter(models.Submission.user_id.in_(user_ids))
        return subs

    def find_all_linked_resources(self) -> dict[str, list[Base]]:
        # Get any assignments that are forked from this one
        resources = {
            "Role": self.roles,
            "Assignment": self.assignments,
            "AssignmentGroup": self.assignment_groups,
            "AssignmentTag": self.tags,
            "SubmissionLog": self.submission_logs,
            "AssignmentLog": self.assignment_logs,
            "RoleLog": self.role_logs,
            "CourseLog": self.course_logs,
            "Submission": self.submissions,
            "Invite": self.invites,
            "Report": self.reports
        }
        return resources

    @staticmethod
    def check_url_is_unique(course_url, course_id):
        return Course.query.filter_by(url=course_url).filter(Course.id != course_id).first() is None

    def get_submission_counts(self):
        submission_ids = (db.session.query(models.Submission.id)
                                  .filter(models.Submission.course_id == self.id)
                                  .subquery())
        # Plain column tuples (submission_id, metric, value) — skips ORM entity
        # hydration, which matters at tens of thousands of count rows.
        stmt = (select(models.SubmissionCounts.submission_id,
                       models.SubmissionCounts.metric,
                       models.SubmissionCounts.value)
                .filter(models.SubmissionCounts.submission_id.in_(submission_ids)))
        counts = db.session.execute(stmt).all()
        return counts
