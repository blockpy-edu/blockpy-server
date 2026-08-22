"""
Submission search: parsing, evaluating, and encoding for the criteria-search
interfaces (View Submissions' `submissions_filter` and the course analytics
dashboard). Extracted from `controllers/endpoints/courses.py`; the routes stay
there and call into this module.

Searchable fields live in `SEARCH_FIELD_REGISTRY`, split into four namespaces:

- **submission** (unprefixed): columns on the submission itself (`score`,
  `correct`, `code`, `date_modified`, ...). Exactly the original View
  Submissions set, so existing saved criteria keep working.
- **metric**: every `SubmissionMetrics` value plus the derived rates, compared
  numerically against a per-submission metrics dict (pivoted from
  `submission_counts`) that the caller passes to the evaluators. A metric with
  no row is *absent*, and an absent metric never matches — "no data" is not 0.
- **user** (`user.*`): text comparison against the submission's user.
- **assignment** (`assignment.*`): the submission's assignment.

Each endpoint passes the subset of fields it accepts to
`parse_submission_search`, so an endpoint's accepted set never grows silently
when new fields are registered. The user/assignment evaluators read
relationship attributes, so callers should `prefetch_search_relations` before
the evaluation loop (and hold the result in a local — the identity map is
weakly referenced).
"""
import json
import re
from dataclasses import dataclass
from datetime import datetime
from typing import Callable

from sqlalchemy.orm import defer

from common.dates import datetime_to_string
from models.assignment import Assignment
from models.assignment_group import AssignmentGroup
from models.enums.metrics import SubmissionMetrics
from models.submission import Submission
from models.user import User


def encode_submission_for_filter(submission):
    """ A lightweight encoding of a submission for the submissions filter table:
    skips the heavyweight text fields (code, feedback) but includes the
    server-computed human-readable statuses. """
    return {
        "id": submission.id,
        "user_id": submission.user_id,
        "assignment_id": submission.assignment_id,
        "assignment_group_id": submission.assignment_group_id,
        "course_id": submission.course_id,
        # The raw 0-100 score column, exactly what the old table rendered
        # (as_float_score's 0-1 scale is for LMS grade passback, not display)
        "score": submission.score,
        "correct": submission.correct,
        "submission_status": submission.submission_status,
        "grading_status": submission.grading_status,
        "version": submission.version,
        "date_created": datetime_to_string(submission.date_created),
        "date_modified": datetime_to_string(submission.date_modified),
        "human_submission_status": submission.human_submission_status(),
        "human_grading_status": submission.human_grading_status(),
    }


def _search_compare_numbers(actual, operator, value):
    try:
        target = float(value)
    except (TypeError, ValueError):
        return False
    actual = actual if actual is not None else 0
    return {"eq": actual == target, "ne": actual != target,
            "lt": actual < target, "le": actual <= target,
            "gt": actual > target, "ge": actual >= target}.get(operator, False)


def _search_compare_text(text, operator, value):
    text = text or ""
    value = value or ""
    if operator == "contains":
        return value in text
    elif operator == "icontains":
        return value.lower() in text.lower()
    elif operator == "regex":
        try:
            return re.search(value, text) is not None
        except re.error:
            return False
    return False


def _search_compare_date(actual, operator, value):
    if actual is None:
        return False
    try:
        target = datetime.strptime(str(value), "%Y-%m-%d").date()
    except (TypeError, ValueError):
        return False
    if operator == "before":
        return actual.date() < target
    elif operator == "on":
        return actual.date() == target
    elif operator == "after":
        return actual.date() > target
    return False


def _search_compare_boolean(actual, value):
    return bool(actual) == (str(value).lower() == "true")


@dataclass(frozen=True)
class SearchField:
    """ One searchable field: the namespace it belongs to, and how to evaluate
    it against a submission (plus its pivoted metrics dict, for metric fields). """
    category: str  # "submission" | "metric" | "user" | "assignment"
    evaluate: Callable  # (submission, operator, value, metrics) -> bool


def _submission_field(evaluate_against_submission):
    return SearchField("submission",
                       lambda submission, operator, value, metrics:
                       evaluate_against_submission(submission, operator, value))


def _metric_field(metric_name):
    def evaluate(submission, operator, value, metrics):
        # Absent metric = no data, and no data never matches (it is not 0)
        if not metrics or metric_name not in metrics:
            return False
        return _search_compare_numbers(metrics[metric_name], operator, value)
    return SearchField("metric", evaluate)


def _derived_rate_field(numerator, denominator):
    def evaluate(submission, operator, value, metrics):
        if not metrics:
            return False
        top, bottom = metrics.get(numerator), metrics.get(denominator)
        if top is None or not bottom:
            return False
        return _search_compare_numbers(top / bottom, operator, value)
    return SearchField("metric", evaluate)


def _user_field(get_text):
    def evaluate(submission, operator, value, metrics):
        user = submission.user
        if user is None:
            return False
        return _search_compare_text(get_text(user), operator, value)
    return SearchField("user", evaluate)


def _assignment_field(evaluate_against_assignment):
    def evaluate(submission, operator, value, metrics):
        assignment = submission.assignment
        if assignment is None:
            return False
        return evaluate_against_assignment(assignment, operator, value)
    return SearchField("assignment", evaluate)


def _evaluate_assignment_group(submission, operator, value, metrics):
    group = submission.assignment_group
    if group is None:
        return False
    return _search_compare_text(group.name, operator, value)


# The derived rates searchable alongside the raw metrics, as (numerator,
# denominator) pairs over the pivoted metrics dict. All are 0-1 fractions.
DERIVED_METRIC_RATES = {
    "syntax_error_rate": (SubmissionMetrics.feedback_syntax_errors.value,
                          SubmissionMetrics.feedback_total.value),
    "runtime_error_rate": (SubmissionMetrics.feedback_runtime_errors.value,
                           SubmissionMetrics.feedback_total.value),
    "assertion_success_rate": (SubmissionMetrics.feedback_assertion_successes.value,
                               SubmissionMetrics.feedback_assertion_counts.value),
}


SEARCH_FIELD_REGISTRY = {
    # Submission columns: exactly the original View Submissions field set
    "score": _submission_field(
        # Compare on the 0-100 scale the interface presents
        lambda s, op, v: _search_compare_numbers(s.score, op, v)),
    "correct": _submission_field(
        lambda s, op, v: _search_compare_boolean(s.correct, v)),
    "submission_status": _submission_field(
        lambda s, op, v: s.submission_status == v),
    "grading_status": _submission_field(
        lambda s, op, v: s.grading_status == v),
    "version": _submission_field(
        lambda s, op, v: _search_compare_numbers(s.version or 0, op, v)),
    "code": _submission_field(
        lambda s, op, v: _search_compare_text(s.code, op, v)),
    "feedback": _submission_field(
        lambda s, op, v: _search_compare_text(s.feedback, op, v)),
    "code_length": _submission_field(
        lambda s, op, v: _search_compare_numbers(len(s.code or ""), op, v)),
    "date_created": _submission_field(
        lambda s, op, v: _search_compare_date(s.date_created, op, v)),
    "date_modified": _submission_field(
        lambda s, op, v: _search_compare_date(s.date_modified, op, v)),
    # Student fields
    "user.name": _user_field(lambda user: user.name()),
    "user.email": _user_field(lambda user: user.email),
    # Assignment fields
    "assignment.name": _assignment_field(
        lambda a, op, v: _search_compare_text(a.name, op, v)),
    "assignment.url": _assignment_field(
        lambda a, op, v: _search_compare_text(a.url, op, v)),
    "assignment.type": _assignment_field(
        lambda a, op, v: (a.type or "") == v),
    "assignment.reviewed": _assignment_field(
        lambda a, op, v: _search_compare_boolean(a.reviewed, v)),
    "assignment.hidden": _assignment_field(
        lambda a, op, v: _search_compare_boolean(a.hidden, v)),
    "assignment.group": SearchField("assignment", _evaluate_assignment_group),
}
SEARCH_FIELD_REGISTRY.update({metric.value: _metric_field(metric.value)
                              for metric in SubmissionMetrics})
SEARCH_FIELD_REGISTRY.update({name: _derived_rate_field(numerator, denominator)
                              for name, (numerator, denominator) in DERIVED_METRIC_RATES.items()})


def search_fields_for(*categories):
    """ The registry field names belonging to the given namespaces. """
    return frozenset(name for name, spec in SEARCH_FIELD_REGISTRY.items()
                     if spec.category in categories)


# The per-endpoint accepted sets: spelled out here so neither grows silently
# as fields are registered. View Submissions has no metrics dict to evaluate
# against; the analytics detail endpoint pivots one per submission.
VIEW_SUBMISSIONS_SEARCH_FIELDS = search_fields_for("submission", "user", "assignment")
ANALYTICS_SEARCH_FIELDS = search_fields_for("submission", "metric", "user", "assignment")


def parse_submission_search(raw, allowed_fields):
    """ Parse and validate the search JSON from a criteria-search interface,
    against the registry fields this endpoint accepts (`allowed_fields`).
    Returns (combinator, criteria, errors); invalid criteria are dropped with an error. """
    if not raw:
        return "and", [], []
    errors = []
    try:
        data = json.loads(raw)
    except ValueError:
        return "and", [], ["Could not parse the search criteria."]
    combinator = data.get("combinator", "and")
    if combinator not in ("and", "or", "none", "xor"):
        errors.append(f"Unknown search combinator: {combinator!r}; using 'and'.")
        combinator = "and"
    criteria = []
    for criterion in data.get("criteria", []):
        if not isinstance(criterion, dict):
            errors.append("Malformed search criterion was skipped.")
            continue
        field = criterion.get("field")
        if field not in allowed_fields or field not in SEARCH_FIELD_REGISTRY:
            errors.append(f"Unknown search field: {field!r}")
            continue
        if criterion.get("operator") == "regex":
            try:
                re.compile(criterion.get("value", ""))
            except re.error as regex_error:
                errors.append(f"Invalid regular expression {criterion.get('value')!r}: {regex_error}")
                continue
        criteria.append(criterion)
    return combinator, criteria, errors


def evaluate_search_criterion(submission, criterion, metrics=None):
    """ Evaluate one parsed criterion against a submission; `metrics` is the
    submission's pivoted counters dict, required only for metric fields. """
    spec = SEARCH_FIELD_REGISTRY.get(criterion.get("field"))
    if spec is None:
        result = False
    else:
        result = spec.evaluate(submission, criterion.get("operator", ""),
                               criterion.get("value", ""), metrics)
    if criterion.get("negate"):
        result = not result
    return result


def matches_search_criteria(submission, combinator, criteria, metrics=None):
    results = [evaluate_search_criterion(submission, criterion, metrics)
               for criterion in criteria]
    if combinator == "or":
        return any(results)
    elif combinator == "none":
        return not any(results)
    elif combinator == "xor":
        return sum(results) == 1
    return all(results)


def search_load_options(criteria):
    """ Query load options for a submission search: only pull the heavyweight
    text columns when a criterion actually reads them. """
    needs_code = any(c.get("field") in ("code", "code_length") for c in criteria)
    needs_feedback = any(c.get("field") == "feedback" for c in criteria)
    load_options = [defer(Submission.extra_files)]
    if not needs_code:
        load_options.append(defer(Submission.code))
    if not needs_feedback:
        load_options.append(defer(Submission.feedback))
    return load_options


def prefetch_search_relations(submissions, criteria):
    """ Batch-load the relationships that user./assignment. criteria will read
    during the evaluation loop, so evaluation never lazy-loads per submission.
    The caller must hold the returned list in a local until evaluation is done:
    the session's identity map is weakly referenced, and these loaded instances
    are what keep `submission.user` / `submission.assignment` lookups free. """
    loaded = []
    if not submissions:
        return loaded
    categories = {SEARCH_FIELD_REGISTRY[c["field"]].category
                  for c in criteria if c.get("field") in SEARCH_FIELD_REGISTRY}
    if "user" in categories:
        loaded.extend(User.query.filter(
            User.id.in_({s.user_id for s in submissions})).all())
    if "assignment" in categories:
        loaded.extend(Assignment.query.filter(
            Assignment.id.in_({s.assignment_id for s in submissions})).all())
        if any(c.get("field") == "assignment.group" for c in criteria):
            group_ids = {s.assignment_group_id for s in submissions
                         if s.assignment_group_id is not None}
            if group_ids:
                loaded.extend(AssignmentGroup.query.filter(
                    AssignmentGroup.id.in_(group_ids)).all())
    return loaded
