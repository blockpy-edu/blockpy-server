from models.generics.models import ma
from models.role import Role
from models.user import User
from models.course import Course
from models.assignment import Assignment
from models.assignment_tag import AssignmentTag
from models.assignment_tag_membership import assignment_tag_membership
from models.assignment_group import AssignmentGroup
from models.assignment_group_membership import AssignmentGroupMembership
from models.authentication import Authentication
from models.review import Review
from models.submission import Submission
from models.sample_submission import SampleSubmission
from models.invite import Invite
from models.report import Report
from models.grade_history import GradeHistory
from models.log_tables import RoleLog, AccessLog, ErrorLog, CourseLog, AssignmentLog, SubmissionLog
from models.counters import SubmissionCounts

class BaseSchema:
    id = ma.auto_field(required=True)
    date_created = ma.auto_field(required=True)
    date_modified = ma.auto_field(required=True)

class VersionedSchema(BaseSchema):
    version = ma.auto_field(required=True)

class EnhancedSchema(VersionedSchema):
    url = ma.auto_field(required=True)


class UserSchema(ma.SQLAlchemyAutoSchema, BaseSchema):
    class Meta:
        model = User
        include_fk = True
        #load_instance = True

class AssignmentSchema(ma.SQLAlchemyAutoSchema, EnhancedSchema):
    class Meta:
        model = Assignment
        include_fk = True

class GroupSchema(ma.SQLAlchemyAutoSchema, EnhancedSchema):
    class Meta:
        model = AssignmentGroup
        include_fk = True


class AssignmentGroupMembershipSchema(ma.SQLAlchemyAutoSchema, BaseSchema):
    class Meta:
        model = AssignmentGroupMembership
        include_fk = True


class AssignmentTagSchema(ma.SQLAlchemyAutoSchema, BaseSchema):
    class Meta:
        model = AssignmentTag
        include_fk = True


"""
# Can't easily setup association tables in marshmallow?
class AssignmentTagMembershipSchema(ma.SQLAlchemyAutoSchema):
    class Meta:
        model = assignment_tag_membership
        include_fk = True
"""

class AuthenticationSchema(ma.SQLAlchemyAutoSchema, BaseSchema):
    class Meta:
        model = Authentication
        include_fk = True

class CourseSchema(ma.SQLAlchemyAutoSchema, EnhancedSchema):
    class Meta:
        model = Course
        include_fk = True

class InviteSchema(ma.SQLAlchemyAutoSchema, BaseSchema):
    class Meta:
        model = Invite
        include_fk = True


class ReportSchema(ma.SQLAlchemyAutoSchema, BaseSchema):
    class Meta:
        model = Report
        include_fk = True


class ReviewSchema(ma.SQLAlchemyAutoSchema, BaseSchema):
    class Meta:
        model = Review
        include_fk = True


class RoleSchema(ma.SQLAlchemyAutoSchema, BaseSchema):
    class Meta:
        model = Role
        include_fk = True

class SampleSubmissionSchema(ma.SQLAlchemyAutoSchema, BaseSchema):
    class Meta:
        model = SampleSubmission
        include_fk = True


class SubmissionSchema(ma.SQLAlchemyAutoSchema, EnhancedSchema):
    class Meta:
        model = Submission
        include_fk = True


class GradeHistorySchema(ma.SQLAlchemyAutoSchema, BaseSchema):
    class Meta:
        model = GradeHistory
        include_fk = True

class RoleLogSchema(ma.SQLAlchemyAutoSchema, BaseSchema):
    class Meta:
        model = RoleLog
        include_fk = True


class AccessLogSchema(ma.SQLAlchemyAutoSchema, BaseSchema):
    class Meta:
        model = AccessLog
        include_fk = True


class ErrorLogSchema(ma.SQLAlchemyAutoSchema, BaseSchema):
    class Meta:
        model = ErrorLog
        include_fk = True


class AssignmentLogSchema(ma.SQLAlchemyAutoSchema, BaseSchema):
    class Meta:
        model = AssignmentLog
        include_fk = True


class SubmissionLogSchema(ma.SQLAlchemyAutoSchema, BaseSchema):
    class Meta:
        model = SubmissionLog
        include_fk = True


class CourseLogSchema(ma.SQLAlchemyAutoSchema, BaseSchema):
    class Meta:
        model = CourseLog
        include_fk = True


class SubmissionCountsSchema(ma.SQLAlchemyAutoSchema, BaseSchema):
    class Meta:
        model = SubmissionCounts
        include_fk = True