import enum
from strenum import StrEnum

class CourseVisibility(StrEnum):
    """
    The visibility of a course, controlling whether users can see the course and its resources.

    Attributes:
        PUBLIC: The course is visible to all users
        PRIVATE: The course is only visible to the owner and users who are in the course somehow
        STUDENTS: The course is visible to students, but not to anonymous users
        ARCHIVED: The course is not visible to anyone except the owner
    """
    PUBLIC = 'public'
    PRIVATE = 'private'
    STUDENTS = 'students'
    ARCHIVED = 'archived'

    @classmethod
    def parse(cls, value) -> 'CourseVisibility | None':
        """ The visibility named by a user-supplied string (case-insensitive), or None if unknown. """
        if value is None:
            return None
        try:
            return cls(str(value).strip().lower())
        except ValueError:
            return None

class CourseService(StrEnum):
    """
    The service that a course is using to manage its assignments.

    Attributes:
        NATIVE: The course is using the native Prism assignment system
        LTI: The course is using an LTI connection to an external service
    """
    NATIVE = 'native'
    CANVAS = 'canvas'
    LTI = 'lti'


class CourseKind(StrEnum):
    """
    The kind of course.

    Attributes:
        TEMPLATE: The course is not meant to have students, but as a general curriculum
        OFFERING: The course is a live course with students
        DEFAULT: The special default course, which nothing should really belong to.
    """
    TEMPLATE = 'template'
    OFFERING = 'offering'
    DEFAULT = 'default'