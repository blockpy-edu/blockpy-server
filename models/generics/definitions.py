from dataclasses import dataclass
import math


@dataclass
class LatePolicy:
    allowed: bool
    interval: str
    amount: float
    rounding: callable
    max_penalty: float
    invalid: bool = False
    NORMAL_INTERVALS = {
        "hours": "hours", "hour": "hours",
        "days": "days", "day": "days",
        "minutes": "minutes", "minute": "minutes",
        "weeks": "weeks", "week": "weeks"
    }

    def __init__(self, allowed, interval, amount, rounding, max_penalty):
        self.allowed = allowed
        self.max_penalty = self._convert_amount(max_penalty)
        self.amount = self._convert_amount(amount)
        self.interval, invalid_interval = self._normalize_interval(interval)
        self.rounding, invalid_rounding = self._normalize_rounding(rounding)
        self.invalid = invalid_interval or invalid_rounding

    @staticmethod
    def _normalize_interval(interval) -> tuple[str, bool]:
        if interval in LatePolicy.NORMAL_INTERVALS:
            return LatePolicy.NORMAL_INTERVALS[interval], False
        return interval, True

    @staticmethod
    def _convert_amount(amount) -> float:
        if isinstance(amount, str):
            if amount.endswith("%"):
                # Ignore negatives and positives, always interpret as a negative
                return float(amount.strip("%-+")) / 100
            return float(amount.strip("-+"))
        return amount

    @staticmethod
    def _normalize_rounding(rounding) -> tuple[callable, bool]:
        if isinstance(rounding, str):
            rounding = rounding.lower()
            if rounding in ("floor", "down"):
                return math.floor, False
            elif rounding in ("ceil", "up"):
                return math.ceil, False
            elif rounding == "round":
                return round, False
            elif rounding == "none":
                return lambda x: x, False
            else:
                return lambda x: x, True
        else:
            return rounding, False

    def _get_gap(self, submitted, due) -> float:
        if self.interval == "minutes":
            return (submitted - due).total_seconds() / 60
        elif self.interval == "hours":
            return (submitted - due).total_seconds() / 60 / 60
        elif self.interval == "days":
            return (submitted - due).total_seconds() / 60 / 60 / 24
        elif self.interval == "weeks":
            return (submitted - due).total_seconds() / 60 / 60 / 24 / 7
        else:
            return 0

    def get_lateness_penalty(self, submitted, due) -> float:
        if self.invalid:
            return 0
        if not submitted or not due:
            return 0
        gap = self.rounding(self._get_gap(submitted, due))
        if gap <= 0:
            return 0
        result = gap * self.amount
        return min(result, self.max_penalty)

class LogEventType:
    LMS_SUBMISSION = "X-Submission.LMS"
    LMS_UNCHANGED = "X-Unchanged.LMS"
    LMS_FAILURE = "X-Submission.LMS.Failure"
    QUIZ_GRADE_FAILURE = "X-Quiz.Grade.Failure"
    IP_ADDRESS_BLOCKED = "X-IP.Blocked"
    SUBMIT = "Submit"
