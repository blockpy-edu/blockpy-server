import enum
from strenum import StrEnum

class ValidChoicesMixin:
    @classmethod
    def choices(cls):
        return [choice.value for choice in cls._member_map_.values()]

class SubmissionStatuses(ValidChoicesMixin, StrEnum):
    # Not yet begun - the value if the submission does not exist
    INITIALIZED = "Initialized"
    NOT_READY = "NotReady"
    # Started -> not yet run
    STARTED = "Started"
    # inProgress -> Run, but not yet marked formally as "submitted"
    IN_PROGRESS = "inProgress"
    # Submitted -> formally marked
    SUBMITTED = "Submitted"
    # Completed -> Either formally Submitted and FullyGraded, or auto graded as "correct"
    COMPLETED = "Completed"

class GradingStatuses(ValidChoicesMixin, StrEnum):
    FULLY_GRADED = 'FullyGraded'
    PENDING = 'Pending'
    PENDING_MANUAL = 'PendingManual'
    FAILED = 'Failed'
    NOT_READY = 'NotReady'