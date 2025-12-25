"""
The models and database connections
"""
from quart import Quart

from models.generics.models import db, migrate, ma
from models.role import Role
from models.user import User
from models.course import Course
from models.assignment import Assignment
from models.assignment_tag import AssignmentTag
from models.assignment_tag_membership import assignment_tag_membership
from models.assignment_group import AssignmentGroup
from models.assignment_group_membership import AssignmentGroupMembership
from models.authentication import Authentication
from models.log_tables import AccessLog, ErrorLog, CourseLog, RoleLog, AssignmentLog, SubmissionLog
from models.review import Review
from models.submission import Submission
from models.sample_submission import SampleSubmission
from models.invite import Invite
from models.report import Report
from models.grade_history import GradeHistory


from models.generics.schemas import (UserSchema, RoleSchema, CourseSchema, AssignmentSchema, AssignmentTagSchema,
                                     #AssignmentTagMembershipSchema,
                                     GroupSchema, AssignmentGroupMembershipSchema,
                                     AuthenticationSchema, ReviewSchema, SubmissionSchema,
                                     SampleSubmissionSchema, InviteSchema, ReportSchema,
                                     GradeHistorySchema, RoleLogSchema, AccessLogSchema, ErrorLogSchema,
                                     CourseLogSchema, AssignmentLogSchema, SubmissionLogSchema)


def init_database(app: Quart) -> Quart:
    """
    Initialize the database.

    :param app: The main Quart application
    :return: The same (modified) Quart application
    """
    db.init_app(app)

    migrate.init_app(app, db)
    ma.init_app(app)

    return app


#: A listing of all the tables
ALL_TABLES = (
    Assignment, AssignmentGroup, AssignmentGroupMembership,
    AssignmentTag, assignment_tag_membership,
    Course, Invite,
    Submission, Review, SampleSubmission,
    User, Role, Authentication,
    Report, GradeHistory,
    AccessLog, ErrorLog, CourseLog, RoleLog, AssignmentLog, SubmissionLog
)
