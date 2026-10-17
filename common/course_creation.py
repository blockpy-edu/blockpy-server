"""
Anti-spam policy for self-serve (non-LMS) course creation.

Pure functions over a `CreatorStanding` snapshot, so the rules can be unit-tested without a database.
`User.course_creation_standing()` builds the snapshot; the course routes apply the verdicts.
"""
from dataclasses import dataclass
from datetime import timedelta
from typing import Mapping, Optional, Tuple

DEFAULT_SETTINGS = {
    # An account younger than this is "new" and limited to COURSE_CREATION_NEW_ACCOUNT_LIMIT courses in total.
    'COURSE_CREATION_NEW_ACCOUNT_HOURS': 24,
    'COURSE_CREATION_NEW_ACCOUNT_LIMIT': 1,
    # Everyone who is not exempt may create at most this many courses per rolling 24 hours.
    'COURSE_CREATION_DAILY_LIMIT': 5,
    # Only accounts at least this old (or confirmed, or exempt) may make a course public.
    'COURSE_CREATION_PUBLIC_AFTER_DAYS': 7,
}

PUBLIC = 'public'
PRIVATE = 'private'


@dataclass(frozen=True)
class CreatorStanding:
    exempt: bool                        # admins and LMS-linked staff: no quota, any visibility
    confirmed: bool                     # email confirmed (Flask-Security confirmed_at)
    account_age: Optional[timedelta]    # None when unknown; treated as an old account
    courses_owned: int                  # all courses this user owns
    courses_last_day: int               # courses this user created in the last 24 hours


def _setting(settings: Optional[Mapping], key: str):
    if settings is not None and settings.get(key) is not None:
        return settings[key]
    return DEFAULT_SETTINGS[key]


def is_new_account(standing: CreatorStanding, settings: Optional[Mapping] = None) -> bool:
    hours = _setting(settings, 'COURSE_CREATION_NEW_ACCOUNT_HOURS')
    return standing.account_age is not None and standing.account_age < timedelta(hours=hours)


def is_established(standing: CreatorStanding, settings: Optional[Mapping] = None) -> bool:
    """ Established accounts may publish courses publicly. """
    if standing.exempt or standing.confirmed or standing.account_age is None:
        return True
    days = _setting(settings, 'COURSE_CREATION_PUBLIC_AFTER_DAYS')
    return standing.account_age >= timedelta(days=days)


def creation_block_reason(standing: CreatorStanding, settings: Optional[Mapping] = None) -> Optional[str]:
    """
    Returns a user-facing message explaining why this account may not create another course right now,
    or None when creation is allowed. A limit of 0 disables that rule.
    """
    if standing.exempt:
        return None
    if is_new_account(standing, settings):
        limit = _setting(settings, 'COURSE_CREATION_NEW_ACCOUNT_LIMIT')
        hours = _setting(settings, 'COURSE_CREATION_NEW_ACCOUNT_HOURS')
        if limit and standing.courses_owned >= limit:
            plural = '' if limit == 1 else 's'
            return (f"New accounts may only create {limit} course{plural} during their first {hours} hours. "
                    f"Please try again later, or contact the administrator if you need more courses right away.")
    daily = _setting(settings, 'COURSE_CREATION_DAILY_LIMIT')
    if daily and standing.courses_last_day >= daily:
        return (f"You have created {standing.courses_last_day} courses in the last 24 hours, which is the limit. "
                f"Please try again tomorrow, or contact the administrator.")
    return None


def allowed_visibility(standing: CreatorStanding, requested: Optional[str],
                       settings: Optional[Mapping] = None) -> Tuple[Optional[str], Optional[str]]:
    """
    Downgrades a requested 'public' visibility to 'private' for accounts that are not yet established.
    Returns (visibility_to_apply, user_facing_note_or_None).
    """
    normalized = (requested or '').strip().lower()
    if normalized != PUBLIC or is_established(standing, settings):
        return requested, None
    days = _setting(settings, 'COURSE_CREATION_PUBLIC_AFTER_DAYS')
    return PRIVATE, (f"Only accounts older than {days} days (or linked to an LMS course) can make a course public, "
                     f"so the course has been kept private. You can make it public later from the course settings.")
