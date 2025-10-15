import enum
from strenum import StrEnum

SYS_ROLE_PREFIX = "urn:lti:sysrole:ims/lis/"
INST_ROLE_PREFIX = "urn:lti:instrole:ims/lis/"
CONTEXT_ROLE_PREFIX = "urn:lti:role:ims/lis/"


def clean_role(role: str) -> (str, str):
    """
    Removes any LTI prefixes from a role string and returns the primary and sub roles.
    Works fine if the LTI string has no prefix.

    Args:
        role: The role string to clean
    Returns:
        A tuple of the primary role and the sub role
    """
    if role.startswith(SYS_ROLE_PREFIX):
        return role[len(SYS_ROLE_PREFIX):].lower(), "sys"
    elif role.startswith(INST_ROLE_PREFIX):
        return role[len(INST_ROLE_PREFIX):].lower(), "inst"
    elif role.startswith(CONTEXT_ROLE_PREFIX):
        role = role[len(CONTEXT_ROLE_PREFIX):]
        if "/" in role:
            primary, sub = role.lower().split("/")
            return primary, sub
        else:
            return role.lower(), ""
    else:
        return role.lower(), ""

class UserRoles(StrEnum):
    """
    The roles that a user can have.

    Attributes:
        ADMIN: Has full control over the entire system
        INSTRUCTOR: Has full control over a specific course
        LEARNER: Can view and submit assignments, receive feedback, but only for themselves
        TA: Can grade and provide feedback on assignments, see all submissions, for a specific course, except for hidden assignments.
        ADOPTER: An additional role for teachers who have been given access to use assignments in their course
        PROCTOR: A role for proctors to allow them to change the IP address settings for an assignment.
        NONE: A role that is used to indicate that the user has no role in the course
    """
    ADMIN = 'admin'
    INSTRUCTOR = 'instructor'
    LEARNER = 'learner'
    TA = 'teachingassistant'
    ADOPTER = 'adopter'
    PROCTOR = 'proctor'
    CONTENT_DEVELOPER = "contentdeveloper"
    NONE = "none"
    ADMINISTRATOR = 'administrator' # Not an alias, distinct role for LTI


USER_DISPLAY_ROLES = {
    UserRoles.ADMIN: 'Administrator',
    UserRoles.INSTRUCTOR: 'Instructor',
    UserRoles.LEARNER: 'Learner',
    UserRoles.TA: 'Teaching Assistant',
    UserRoles.ADOPTER: 'Adopter',
    UserRoles.PROCTOR: 'Proctor',
    UserRoles.CONTENT_DEVELOPER: 'Content Developer',
    UserRoles.NONE: 'None',
    UserRoles.ADMINISTRATOR: 'LTI System Administrator',
}


class RolePermissions:
    ALL_ROLES = [UserRoles.ADMIN, UserRoles.INSTRUCTOR, UserRoles.LEARNER,
                 UserRoles.TA, UserRoles.ADOPTER, UserRoles.PROCTOR,
                 UserRoles.CONTENT_DEVELOPER, UserRoles.ADMINISTRATOR]
    LEARNER_ROLES = [UserRoles.ADMIN, UserRoles.LEARNER,]
    GRADER_ROLES = [UserRoles.ADMIN, UserRoles.INSTRUCTOR, UserRoles.TA,]
    STAFF_ROLES = [UserRoles.ADMIN, UserRoles.INSTRUCTOR, UserRoles.TA,
                   UserRoles.CONTENT_DEVELOPER, UserRoles.PROCTOR]
    ADOPTER_ROLES = [UserRoles.ADMIN, UserRoles.INSTRUCTOR,
                     UserRoles.CONTENT_DEVELOPER, UserRoles.ADOPTER]
    EXAM_ROLES = [UserRoles.ADMIN, UserRoles.INSTRUCTOR, UserRoles.PROCTOR]
    DEVELOPER_ROLES = [UserRoles.ADMIN, UserRoles.INSTRUCTOR,
                       UserRoles.CONTENT_DEVELOPER]

