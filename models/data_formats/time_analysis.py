"""
Time analysis of a student's submission logs: how they spent their time on a set of
assignments (typically an exam's assignment group).

The analysis is built from the timestamps of the student's SubmissionLog events:

* Consecutive events that are close together (within the *idle threshold*) are treated as
  continuous work, and the time between them is credited as **active** time to the
  assignment of the earlier event.
* Stretches longer than the threshold with no events at all are **idle gaps**; we cannot
  know what the student was doing then (thinking, away from the keyboard, or working in
  another window), so they are reported separately rather than credited.
* Reading pages report how long until their next "read" ping is due, so a quiet stretch
  covered by such a ping is not an idle gap.
* Runs of continuous work separated by idle gaps are **sessions**.

Everything here is pure Python over already-loaded rows, except `load_time_analysis_events`.
The page itself lives in controllers/endpoints/courses.py (`time_analysis`).
"""
import json
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Dict, List, Optional

from sqlalchemy import func

from models.generics.models import db
from models.log_tables import SubmissionLog

DEFAULT_IDLE_MINUTES = 5.0
MIN_IDLE_MINUTES = 0.5
MAX_IDLE_MINUTES = 24 * 60
# Reading pings say when the next ping is due; allow a little slack for network delays
READING_PING_SLACK_SECONDS = 30
# Only the start of a log message is needed for the analysis (reading pings, LMS scores, ...)
MESSAGE_PREVIEW_LENGTH = 300
# Runs of quiet (event-less but not idle) minutes longer than this collapse into one row
QUIET_RUN_COLLAPSE = 3

# Events that are caused by graders/the system rather than the student; they are shown in
# the minute log as flags but never count as student activity.
NON_STUDENT_EVENTS = {"X-View.Submission", "extend_time"}

KIND_LABELS = {  # (singular, plural)
    "edit": ("edit", "edits"),
    "create": ("file created", "files created"),
    "run": ("run", "runs"),
    "compile": ("compile", "compiles"),
    "syntax_error": ("syntax error", "syntax errors"),
    "feedback": ("feedback", "feedback"),
    "reading": ("reading ping", "reading pings"),
    "visibility": ("tab change", "tab changes"),
    "session": ("session opened", "sessions opened"),
    "grade": ("grade sync", "grade syncs"),
    "paste": ("paste", "pastes"),
    "ip": ("IP change", "IP changes"),
    "timer": ("timer event", "timer events"),
    "fullscreen": ("fullscreen event", "fullscreen events"),
    "view": ("editor switch", "editor switches"),
    "reset": ("reset", "resets"),
    "instructor": ("grader action", "grader actions"),
    "error": ("error", "errors"),
    "other": ("other event", "other events"),
}
# The kinds worth spelling out in the per-minute summary, in display order
SUMMARY_KINDS = ["edit", "run", "syntax_error", "feedback", "reading", "paste", "reset", "create", "other"]
# Flags that deserve attention during an exam
WARNING_FLAGS = {"Tab hidden", "Pasted text", "IP address changed", "Fullscreen exited",
                 "Timer expired"}


@dataclass
class LogEvent:
    """ The slice of a SubmissionLog row that the analysis needs. """
    id: int
    when: datetime
    assignment_id: int
    submission_id: Optional[int]
    event_type: str
    category: str = ""
    label: str = ""
    message: str = ""
    message_length: int = 0
    client_timezone: str = ""
    kind: str = field(init=False)
    flag: Optional[str] = field(init=False)

    def __post_init__(self):
        self.kind, self.flag = classify_event(self.event_type, self.category,
                                              self.label, self.message)

    @property
    def is_student_action(self) -> bool:
        return self.event_type not in NON_STUDENT_EVENTS

    @property
    def reading_delay_seconds(self) -> Optional[float]:
        """ How long a reading "read" ping said it would be until the next ping, if any. """
        if self.event_type != "Resource.View" or self.label != "read":
            return None
        try:
            data = json.loads(self.message or "{}")
        except ValueError:
            return None
        if not isinstance(data, dict):
            return None
        delay = data.get("delay")
        if isinstance(delay, (int, float)) and delay > 0:
            return delay / 1000
        return None


def describe_grade(message: str) -> str:
    """ X-Submission.LMS messages look like "0.59|10.0" (score fraction | points possible). """
    try:
        fraction, points = (message or "").split("|", 1)
        fraction, points = float(fraction), float(points)
    except ValueError:
        return "Grade synced"
    return f"Grade synced: {round(fraction * 100)}% ({round(fraction * points, 2):g}/{points:g})"


def pluralize(kind: str, count: int) -> str:
    singular, plural = KIND_LABELS.get(kind, KIND_LABELS["other"])
    return singular if count == 1 else plural


def flag_family(flag: str) -> str:
    """ Group flags that only differ in their details (e.g., each grade sync's score). """
    if flag.startswith("Grade synced"):
        return "Grade synced"
    if flag.startswith("Switched editor"):
        return "Switched editor"
    return flag


def classify_event(event_type: str, category: str, label: str, message: str):
    """ Sort an event into a coarse kind, and produce a human-readable flag when the event
        marks something instructors should notice in the timeline. """
    event_type = event_type or ""
    if event_type == "File.Edit":
        return "edit", None
    if event_type == "File.Create":
        return "create", None
    if event_type in ("Run.Program", "X-Evaluate.Program"):
        return "run", None
    if event_type == "Compile":
        return "compile", None
    if event_type == "Compile.Error":
        return "syntax_error", None
    if event_type == "Intervention":
        return "feedback", None
    if event_type == "Resource.View":
        if label == "visibility":
            return "visibility", ("Tab hidden" if message == "hidden" else "Tab visible")
        return "reading", None
    if event_type == "Session.Start":
        return "session", "Opened assignment"
    if event_type == "X-Submission.LMS":
        return "grade", describe_grade(message)
    if event_type == "X-Submission.LMS.Failure":
        return "grade", "Grade sync failed"
    if event_type == "X-Editor.Paste":
        return "paste", "Pasted text"
    if event_type == "X-IP.Change":
        return "ip", "IP address changed"
    if event_type == "start_timer":
        return "timer", "Timer started"
    if event_type == "timer_cleared":
        return "timer", "Timer cleared"
    if event_type == "timer_expired":
        return "timer", "Timer expired"
    if event_type == "extend_time":
        return "timer", "Time limit changed by instructor"
    if event_type.startswith("X-Display.Fullscreen"):
        state = event_type.rsplit(".", 1)[-1]
        return "fullscreen", {"Request": "Fullscreen requested", "Success": "Fullscreen entered",
                              "Exit": "Fullscreen exited"}.get(state, f"Fullscreen {state.lower()}")
    if event_type == "X-View.Change":
        return "view", f"Switched editor to {message}" if message else "Switched editor"
    if event_type == "X-File.Reset":
        return "reset", "Reset code"
    if event_type == "X-View.Submission":
        return "instructor", "Submission viewed by a grader"
    if event_type in ("X-System.Error", "error", "timer_error"):
        return "error", None
    return "other", None


@dataclass
class Gap:
    start: datetime
    end: datetime
    seconds: float
    before_assignment_id: int
    after_assignment_id: int
    before_kind: str


@dataclass
class Session:
    index: int
    start: datetime
    end: datetime
    events: int = 0
    assignment_ids: List[int] = field(default_factory=list)

    @property
    def seconds(self) -> float:
        return (self.end - self.start).total_seconds()


@dataclass
class AssignmentSummary:
    assignment_id: int
    name: str
    active_seconds: float = 0.0
    events: int = 0
    counts: Counter = field(default_factory=Counter)
    first: Optional[datetime] = None
    last: Optional[datetime] = None


@dataclass
class AssignmentMinute:
    assignment_id: int
    name: str
    counts: Counter = field(default_factory=Counter)
    last_feedback: Optional[str] = None
    code_length: Optional[int] = None

    def summary(self) -> str:
        parts = []
        for kind in SUMMARY_KINDS:
            count = self.counts.get(kind)
            if count:
                parts.append(f"{count} {pluralize(kind, count)}")
        if not parts:
            other = sum(self.counts.values())
            parts.append(f"{other} event{'' if other == 1 else 's'}")
        if self.last_feedback:
            parts.append(f"feedback: {self.last_feedback}")
        if self.code_length is not None:
            parts.append(f"code: {self.code_length} chars")
        return ", ".join(parts)


@dataclass
class MinuteRow:
    kind: str  # "minute", "quiet", or "gap"
    start: datetime
    end: datetime
    elapsed_seconds: float
    seconds: float = 0.0
    events: int = 0
    assignments: List[AssignmentMinute] = field(default_factory=list)
    flags: List[str] = field(default_factory=list)
    gap: Optional[Gap] = None

    @property
    def has_warning(self) -> bool:
        return any(flag in WARNING_FLAGS for flag in self.flags)


@dataclass
class TimeAnalysis:
    idle_threshold_seconds: float
    events: int = 0
    student_events: int = 0
    first: Optional[datetime] = None
    last: Optional[datetime] = None
    span_seconds: float = 0.0
    active_seconds: float = 0.0
    idle_seconds: float = 0.0
    sessions: List[Session] = field(default_factory=list)
    gaps: List[Gap] = field(default_factory=list)
    assignments: List[AssignmentSummary] = field(default_factory=list)
    counts: Counter = field(default_factory=Counter)
    flag_counts: Counter = field(default_factory=Counter)
    minutes: List[MinuteRow] = field(default_factory=list)
    timer_started: Optional[datetime] = None
    timer_ended: Optional[datetime] = None
    timer_ended_how: Optional[str] = None
    # Active time that fell between the timer starting and it ending (or the last event)
    timer_active_seconds: float = 0.0
    events_after_timer: int = 0
    client_timezone: Optional[str] = None

    @property
    def longest_gap(self) -> Optional[Gap]:
        return max(self.gaps, key=lambda gap: gap.seconds) if self.gaps else None

    @property
    def active_fraction(self) -> float:
        return self.active_seconds / self.span_seconds if self.span_seconds else 0.0


def overlap_seconds(start: datetime, end: datetime, window_start: datetime, window_end: datetime) -> float:
    """ How much of [start, end] falls inside [window_start, window_end]. """
    latest_start = max(start, window_start)
    earliest_end = min(end, window_end)
    return max(0.0, (earliest_end - latest_start).total_seconds())


def floor_minute(when: datetime) -> datetime:
    return when.replace(second=0, microsecond=0)


def format_duration(seconds: Optional[float]) -> str:
    """ 3725 -> "1h 2m 5s"; None -> "" """
    if seconds is None:
        return ""
    seconds = int(round(seconds))
    if seconds < 60:
        return f"{seconds}s"
    hours, remainder = divmod(seconds, 3600)
    minutes, seconds = divmod(remainder, 60)
    parts = []
    if hours:
        parts.append(f"{hours}h")
    parts.append(f"{minutes}m")
    if seconds and not hours:
        parts.append(f"{seconds}s")
    return " ".join(parts)


def format_client_timezone(offset_minutes: str) -> Optional[str]:
    """ The client's `getTimezoneOffset()` (minutes *behind* UTC) as "UTC-05:00". """
    try:
        offset = int(offset_minutes)
    except (TypeError, ValueError):
        return None
    sign = "-" if offset > 0 else "+"
    hours, minutes = divmod(abs(offset), 60)
    return f"UTC{sign}{hours:02d}:{minutes:02d}"


def parse_idle_minutes(value, default=DEFAULT_IDLE_MINUTES) -> float:
    try:
        minutes = float(value)
    except (TypeError, ValueError):
        return default
    return min(MAX_IDLE_MINUTES, max(MIN_IDLE_MINUTES, minutes))


def load_time_analysis_events(course_id: int, user_id: int, assignment_ids: List[int]) -> List[LogEvent]:
    """ Load the student's events for these assignments in this course, oldest first.
        Only a preview of each message is fetched, since File.Edit messages hold whole programs. """
    if not assignment_ids:
        return []
    rows = (db.session.query(SubmissionLog.id, SubmissionLog.date_created,
                             SubmissionLog.assignment_id, SubmissionLog.submission_id,
                             SubmissionLog.event_type, SubmissionLog.category, SubmissionLog.label,
                             func.substr(SubmissionLog.message, 1, MESSAGE_PREVIEW_LENGTH),
                             func.length(SubmissionLog.message),
                             SubmissionLog.client_timezone)
            .filter(SubmissionLog.course_id == course_id,
                    SubmissionLog.subject_id == user_id,
                    SubmissionLog.assignment_id.in_(assignment_ids))
            .order_by(SubmissionLog.date_created.asc(), SubmissionLog.id.asc())
            .all())
    return [LogEvent(id=row[0], when=row[1], assignment_id=row[2], submission_id=row[3],
                     event_type=row[4] or "", category=row[5] or "", label=row[6] or "",
                     message=row[7] or "", message_length=row[8] or 0,
                     client_timezone=row[9] or "")
            for row in rows if row[1] is not None]


def analyze_time(events: List[LogEvent], idle_threshold_seconds: float,
                 assignment_names: Dict[int, str]) -> TimeAnalysis:
    """ Run the whole analysis over the student's events (any order; they are sorted here). """
    events = sorted(events, key=lambda event: (event.when, event.id))
    analysis = TimeAnalysis(idle_threshold_seconds=idle_threshold_seconds, events=len(events))
    student_events = [event for event in events if event.is_student_action]
    analysis.student_events = len(student_events)
    for event in events:
        analysis.counts[event.kind] += 1
        if event.flag:
            analysis.flag_counts[flag_family(event.flag)] += 1
    timezones = Counter(event.client_timezone for event in events if event.client_timezone)
    if timezones:
        analysis.client_timezone = format_client_timezone(timezones.most_common(1)[0][0])
    _find_timer_events(events, analysis)
    if not student_events:
        return analysis

    def name_of(assignment_id):
        return assignment_names.get(assignment_id, f"Assignment {assignment_id}")

    summaries: Dict[int, AssignmentSummary] = {}

    def summary_for(assignment_id) -> AssignmentSummary:
        if assignment_id not in summaries:
            summaries[assignment_id] = AssignmentSummary(assignment_id, name_of(assignment_id))
        return summaries[assignment_id]

    analysis.first = student_events[0].when
    analysis.last = student_events[-1].when
    analysis.span_seconds = (analysis.last - analysis.first).total_seconds()
    timer_window = None
    if analysis.timer_started is not None:
        timer_window = (analysis.timer_started, analysis.timer_ended or analysis.last)
        analysis.events_after_timer = sum(1 for event in student_events
                                          if event.when > timer_window[1])
    session = Session(index=1, start=student_events[0].when, end=student_events[0].when)
    analysis.sessions.append(session)
    for index, event in enumerate(student_events):
        summary = summary_for(event.assignment_id)
        summary.events += 1
        summary.counts[event.kind] += 1
        summary.first = summary.first or event.when
        summary.last = event.when
        session.events += 1
        session.end = event.when
        if event.assignment_id not in session.assignment_ids:
            session.assignment_ids.append(event.assignment_id)
        if index + 1 >= len(student_events):
            break
        following = student_events[index + 1]
        gap_seconds = (following.when - event.when).total_seconds()
        covered = idle_threshold_seconds
        reading_delay = event.reading_delay_seconds
        if reading_delay is not None:
            covered = max(covered, reading_delay + READING_PING_SLACK_SECONDS)
        if gap_seconds > covered:
            analysis.gaps.append(Gap(start=event.when, end=following.when, seconds=gap_seconds,
                                     before_assignment_id=event.assignment_id,
                                     after_assignment_id=following.assignment_id,
                                     before_kind=event.kind))
            analysis.idle_seconds += gap_seconds
            session = Session(index=len(analysis.sessions) + 1,
                              start=following.when, end=following.when)
            analysis.sessions.append(session)
        else:
            analysis.active_seconds += gap_seconds
            summary.active_seconds += gap_seconds
            if timer_window is not None:
                analysis.timer_active_seconds += overlap_seconds(
                    event.when, following.when, timer_window[0], timer_window[1])
    analysis.assignments = sorted(summaries.values(), key=lambda summary: summary.first)
    analysis.minutes = build_minute_rows(events, analysis.gaps, analysis.first, name_of)
    return analysis


def _find_timer_events(events: List[LogEvent], analysis: TimeAnalysis):
    """ Note when the exam timer started and (if it did) how it ended. """
    for event in events:
        if event.event_type == "start_timer" and analysis.timer_started is None:
            analysis.timer_started = event.when
        elif event.event_type in ("timer_expired", "timer_cleared"):
            analysis.timer_ended = event.when
            analysis.timer_ended_how = "expired" if event.event_type == "timer_expired" else "cleared"


def build_minute_rows(events: List[LogEvent], gaps: List[Gap], start: datetime, name_of) -> List[MinuteRow]:
    """ One row per minute with events, quiet minutes in between, and one collapsed row per
        idle gap. Rows are emitted in time order and only cover the analysed span. """
    student_events = [event for event in events if event.is_student_action]
    if not student_events:
        return []
    # Elapsed time is measured from the start of the first minute, so the first row is +0:00
    start = floor_minute(start)
    by_minute = defaultdict(list)
    for event in events:
        by_minute[floor_minute(event.when)].append(event)
    gaps_by_start = defaultdict(list)
    for gap in gaps:
        gaps_by_start[floor_minute(gap.start)].append(gap)
    one_minute = timedelta(minutes=1)
    rows: List[MinuteRow] = []
    minute = floor_minute(student_events[0].when)
    last_minute = floor_minute(student_events[-1].when)
    quiet_run: List[datetime] = []

    def flush_quiet():
        if not quiet_run:
            return
        if len(quiet_run) > QUIET_RUN_COLLAPSE:
            rows.append(MinuteRow(kind="quiet", start=quiet_run[0], end=quiet_run[-1] + one_minute,
                                  elapsed_seconds=(quiet_run[0] - start).total_seconds(),
                                  seconds=60.0 * len(quiet_run)))
        else:
            for quiet in quiet_run:
                rows.append(MinuteRow(kind="quiet", start=quiet, end=quiet + one_minute,
                                      elapsed_seconds=(quiet - start).total_seconds(), seconds=60.0))
        quiet_run.clear()

    while minute <= last_minute:
        minute_events = by_minute.get(minute)
        if not minute_events:
            quiet_run.append(minute)
            minute += one_minute
            continue
        flush_quiet()
        rows.append(_minute_row(minute, minute_events, start, name_of))
        starting_gaps = gaps_by_start.get(minute, [])
        for gap in starting_gaps:
            rows.append(MinuteRow(kind="gap", start=gap.start, end=gap.end,
                                  elapsed_seconds=(gap.start - start).total_seconds(),
                                  seconds=gap.seconds, gap=gap))
        if starting_gaps:
            minute = max(minute + one_minute, floor_minute(starting_gaps[-1].end))
        else:
            minute += one_minute
    return rows


def _minute_row(minute: datetime, minute_events: List[LogEvent], start: datetime, name_of) -> MinuteRow:
    row = MinuteRow(kind="minute", start=minute, end=minute + timedelta(minutes=1),
                    elapsed_seconds=(minute - start).total_seconds(), seconds=60.0)
    per_assignment: Dict[int, AssignmentMinute] = {}
    for event in minute_events:
        if event.flag and event.flag not in row.flags:
            row.flags.append(event.flag)
        if not event.is_student_action:
            continue
        row.events += 1
        if event.assignment_id not in per_assignment:
            per_assignment[event.assignment_id] = AssignmentMinute(event.assignment_id,
                                                                   name_of(event.assignment_id))
        part = per_assignment[event.assignment_id]
        part.counts[event.kind] += 1
        if event.kind == "feedback":
            part.last_feedback = event.label or event.category or "feedback"
        if event.kind in ("edit", "create") and event.message_length:
            part.code_length = event.message_length
    row.assignments = list(per_assignment.values())
    return row
