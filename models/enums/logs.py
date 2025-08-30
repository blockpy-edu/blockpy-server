import enum
from strenum import StrEnum

class AssignmentLogEvent(StrEnum):
    CREATE = "create"
    DELETE = "delete"
    EDIT = "edit"
    RENAME = "rename"
    FORK = "fork"
    UNFORK = "unfork"
    ARCHIVE = "archive"
    CORRUPTED = "corrupted"


class CourseLogEvent(StrEnum):
    CREATE = "create"
    DELETE = "delete"
    # Edit events
    # Give to a new Owner
    TRANSFER = "transfer"
    RENAME = "rename"
    EDIT = "edit"
    ARCHIVE = "archive"
    CORRUPTED = "corrupted"


class RoleLogEvent(StrEnum):
    GIVEN = "given"
    REMOVED = "removed"
    CHANGED = "changed"


class SubmissionLogEvent(StrEnum):
    UNKNOWN = "unknown"
    CREATE = "create"
    DELETE = "delete"
    EDIT = "edit"
    SUBMIT = "submit"
    VIEW = "view"
    FEEDBACK = "feedback"
    COMPILE = "compile"
    RUN = "run"
    DEBUG = "debug"
    ERROR = "error"
    WARNING = "warning"
    INFO = "info"
    COMPLETE = "complete"
    TRANSFER = "transfer"
    CANVAS = "canvas"
    EXTEND_TIME = "extend_time"
    START_TIMER = "start_timer"
    RESET_START_DATE = "reset_start_date"