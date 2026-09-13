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
    CLEAR_TIMER = "clear_timer"

    BLOCKPY_RESET = "X-File.Reset"
    BLOCKPY_PASTE = "X-Editor.Paste"
    BLOCKPY_FILE_EDIT = "File.Edit"
    BLOCKPY_FILE_CREATE = "File.Create"
    BLOCKPY_SESSION_START = "Session.Start"

    # Server-side events that used to be bare string literals
    X_SUBMISSION_GET = "X-Submission.Get"
    X_VIEW_SUBMISSION = "X-View.Submission"
    X_IMAGE_SAVE = "X-Image.Save"
    X_GRADE_INSTRUCTOR = "X-Grade.Instructor"
    X_LMS_SUBMISSION = "X-Submission.LMS"
    X_LMS_UNCHANGED = "X-Unchanged.LMS"
    X_LMS_FAILURE = "X-Submission.LMS.Failure"
    X_LMS_RETRY_FAILURE = "X-Submission.LMS.Retry-Failure"
    X_QUIZ_GRADE_FAILURE = "X-Quiz.Grade.Failure"
    X_IP_BLOCKED = "X-IP.Blocked"
    X_SUBMIT = "Submit"
