"""
Score Adjustments (`grading/adjustments`): correct many students' scores on one
assignment at once, across every course the grader teaches that uses it.

A batch is stored with the review inheritance that already exists:

- one **parent review** with no submission, marked `tool = "score_adjustment"`.
  Its `comment` is the text students see; its `extra_data` holds what only
  graders may see (the rule that selected the students, the private note, the
  assignment it belongs to). It is not `generic`, so it never appears in the
  sitewide "Inherit from" list, and it belongs to no course, which is what lets
  one decision cover the same exam in several courses.
- one **child review** per adjusted submission, with `forked_id` pointing at the
  parent and an empty comment, so every student shows the parent's comment.
  A child's `score` is empty when it takes the parent's amount and explicit when
  that student's amount differs (a per-student re-score, or a trimmed amount).

Children are ordinary reviews, so `Submission.full_score`, the reviewing
interface and grade passback all work unchanged. A child that a grader later
edits by hand (its `version` goes up, or it gains its own comment) is treated
as customized and is left alone by batch edits unless asked otherwise.

Applying a batch only writes reviews. Sending the changed grades to the LMS is
a separate step (`send`), one submission per request, through
`post_current_grade`, which posts and does nothing else.

The matching and scoring logic is pure and lives in
`models/data_formats/score_adjustments.py`.
"""
import json
from collections import defaultdict
from datetime import datetime, timezone

from flask import request, render_template
from sqlalchemy import func
from sqlalchemy.orm import joinedload, defer

from controllers.auth import get_user
from controllers.endpoints.grading import blueprint_grading
from controllers.helpers import (ajax_failure, ajax_success, check_resource_exists, client_time_fields,
                                 login_required, maybe_int, require_course_grader,
                                 require_course_instructor)
from controllers.pylti.post_grade import post_current_grade, FailureReasons
from controllers.submission_search import (ADJUSTMENT_SEARCH_FIELDS, matches_search_criteria,
                                           parse_submission_search, prefetch_search_relations)
from models import db
from models.assignment import Assignment
from models.course import Course
from models.data_formats import score_adjustments as adjustments
from models.enums import GradingStatuses, SubmissionLogEvent, UserRoles
from models.enums.roles import RolePermissions
from models.grade_history import GradeHistory
from models.log_tables import SubmissionLog
from models.review import Review
from models.role import Role
from models.submission import Submission
from models.user import User

ADJUSTMENT_TOOL = "score_adjustment"
MAX_COMMENT_LENGTH = 2000


# ---------------------------------------------------------------------------
# Request scope and permissions
# ---------------------------------------------------------------------------

def _payload() -> dict:
    """ Every endpoint takes one JSON document in the `payload` form field. """
    try:
        data = json.loads(request.values.get('payload') or '{}')
    except ValueError:
        return ajax_failure("The request could not be read.")
    if not isinstance(data, dict):
        return ajax_failure("The request could not be read.")
    return data


def _int_list(values) -> list:
    result = []
    for value in values or []:
        number = maybe_int(value)
        if number is not None and number not in result:
            result.append(number)
    return result


def _usable_courses(viewer, assignment) -> list:
    """ Every course with submissions to this assignment where the viewer may
    adjust scores, as [(course, submission count)]: grader anywhere, and
    instructor where the assignment is hidden (typically an exam). """
    course_rows = (db.session.query(Submission.course_id, func.count(Submission.id))
                   .filter(Submission.assignment_id == assignment.id)
                   .group_by(Submission.course_id).all())
    course_ids = [course_id for course_id, _ in course_rows if course_id is not None]
    if not course_ids:
        return []
    # The same role tests as User.is_grader / User.is_instructor, for all the courses at once
    needed = [UserRoles.INSTRUCTOR] if assignment.hidden else RolePermissions.GRADER_ROLES
    allowed = {role.course_id for role in Role.query.filter(
        Role.user_id == viewer.id, Role.course_id.in_(course_ids), Role.name.in_(needed)).all()}
    courses = {course.id: course for course in Course.query.filter(Course.id.in_(allowed)).all()} if allowed else {}
    return sorted(((courses[course_id], count) for course_id, count in course_rows if course_id in courses),
                  key=lambda pair: pair[0].name.lower())


def _load_scope(data):
    """ The viewer, the assignment, and the courses this request covers. Every
    requested course must be one the viewer may adjust scores in. """
    viewer, _ = get_user()
    assignment_id = maybe_int(data.get('assignment_id'))
    assignment = Assignment.by_id(assignment_id)
    check_resource_exists(assignment, "Assignment", assignment_id)
    usable = _usable_courses(viewer, assignment)
    usable_ids = {course.id for course, _ in usable}
    course_ids = _int_list(data.get('course_ids'))
    if not course_ids:
        return ajax_failure("Choose at least one course.")
    refused = [course_id for course_id in course_ids if course_id not in usable_ids]
    if refused:
        return ajax_failure("You can only include courses where this assignment has submissions and you are "
                            + ("an instructor (it is a hidden assignment)." if assignment.hidden else "a grader."))
    return viewer, assignment, course_ids, usable


def _load_submissions(assignment, course_ids) -> list:
    return (Submission.query
            .filter(Submission.assignment_id == assignment.id, Submission.course_id.in_(course_ids))
            .options(joinedload(Submission.user), defer(Submission.extra_files))
            .all())


# ---------------------------------------------------------------------------
# Reviews already on the submissions
# ---------------------------------------------------------------------------

def _parse_extra(review) -> dict:
    try:
        data = json.loads(review.extra_data or "{}")
    except ValueError:
        return {}
    return data if isinstance(data, dict) else {}


def _plain_score(score):
    if score is None:
        return None
    try:
        return float(str(score).replace("%", ""))
    except ValueError:
        return 0.0


class ReviewBook:
    """ The reviews on a set of submissions, with every fork parent loaded in
    bulk, so effective scores and totals cost a fixed number of queries no
    matter how many submissions there are. """

    def __init__(self, submission_ids):
        submission_ids = list(submission_ids)
        self.by_submission = defaultdict(list)
        self.parents = {}
        reviews = []
        for start in range(0, len(submission_ids), 500):
            reviews.extend(Review.query.filter(
                Review.submission_id.in_(submission_ids[start:start + 500])).all())
        for review in reviews:
            self.by_submission[review.submission_id].append(review)
        pending = {review.forked_id for review in reviews if review.forked_id is not None}
        while pending:
            fetched = Review.query.filter(Review.id.in_(pending)).all()
            for parent in fetched:
                self.parents[parent.id] = parent
            pending = {parent.forked_id for parent in fetched
                       if parent.forked_id is not None and parent.forked_id not in self.parents}

    def effective(self, review) -> float:
        """ A review's score, following its fork chain like `Review.get_actual_score`. """
        seen = set()
        while review is not None and review.id not in seen:
            seen.add(review.id)
            score = _plain_score(review.score)
            if score is not None:
                return score
            review = self.parents.get(review.forked_id)
        return 0.0

    def total(self, submission_id) -> float:
        return sum(self.effective(review) for review in self.by_submission.get(submission_id, []))

    def totals(self) -> dict:
        return {submission_id: self.total(submission_id) for submission_id in self.by_submission}

    def adjusted_for(self, question_id, part) -> dict:
        """ {submission_id: batch comment} for submissions that an earlier batch
        already adjusted for this same question (and part). """
        found = {}
        if not question_id:
            return found
        for submission_id, reviews in self.by_submission.items():
            for review in reviews:
                parent = self.parents.get(review.forked_id)
                if parent is None or parent.tool != ADJUSTMENT_TOOL:
                    continue
                rule = _parse_extra(parent).get("rule") or {}
                if rule.get("question_id") == question_id and rule.get("part") == part:
                    found[submission_id] = adjustments.shorten(parent.comment, 50)
        return found


def _is_customized(child) -> bool:
    """ A grader changed this review by hand after the batch wrote it. """
    return (child.version or 0) > 0 or bool((child.comment or "").strip())


# ---------------------------------------------------------------------------
# Describing an assignment and planning
# ---------------------------------------------------------------------------

def _assignment_kind(assignment) -> str:
    return "quiz" if assignment.type == "quiz" else "code"


def _quiz_context(assignment):
    if _assignment_kind(assignment) != "quiz":
        return None
    context, error = adjustments.load_quiz(assignment)
    if context is None:
        return ajax_failure(f"This quiz cannot be read: {error}")
    return context


def _parse_conditions(search):
    raw = json.dumps(search) if isinstance(search, dict) and search.get("criteria") else ""
    return parse_submission_search(raw, ADJUSTMENT_SEARCH_FIELDS)


def _plan(assignment, submissions, data, context):
    """ Run a rule over the loaded submissions. Returns (planned rows, rule,
    amount, search errors). """
    try:
        rule = adjustments.normalize_rule(data.get('rule'))
        amount = adjustments.normalize_amount(data.get('amount'))
    except (ValueError, TypeError) as error:
        return ajax_failure(str(error))
    search = (data.get('rule') or {}).get('search')
    combinator, criteria, search_errors = _parse_conditions(search)
    variations = adjustments.describe_variations(assignment) if context is None else []
    book = ReviewBook([submission.id for submission in submissions])
    # Held in a local so user lookups during evaluation stay in the identity map
    _prefetched = prefetch_search_relations(submissions, criteria)
    passes = (lambda submission: matches_search_criteria(submission, combinator, criteria)) if criteria else None
    if context is not None and rule["question_id"] and rule["question_id"] not in context.questions:
        return ajax_failure("That question is not part of this quiz.")
    try:
        planned = adjustments.plan_adjustments(
            submissions, rule, amount, context=context, variation_count=len(variations),
            review_totals=book.totals(), passes_conditions=passes,
            already_adjusted=book.adjusted_for(rule["question_id"], rule["part"]))
    except ValueError as error:
        return ajax_failure(str(error))
    rule["search"] = {"combinator": combinator, "criteria": criteria} if criteria else None
    return planned, rule, amount, search_errors


def _encode_planned(planned, submissions, courses_by_id, variations) -> list:
    by_id = {submission.id: submission for submission in submissions}
    labels = {variation["index"]: variation["label"] for variation in variations}
    rows = []
    for row in planned:
        submission = by_id[row.submission_id]
        user = submission.user
        course = courses_by_id.get(row.course_id)
        rows.append({
            "submission_id": row.submission_id,
            "user_id": row.user_id,
            "student": user.name() if user is not None else f"User {row.user_id}",
            "email": user.email if user is not None else "",
            "course_id": row.course_id,
            "course": course.name if course is not None else "",
            "answer": row.answer_label,
            "variation": labels.get(row.variation, "") if row.variation is not None else "",
            "now": row.now,
            "delta": row.delta,
            "after": row.after,
            "notes": row.notes,
            "include": row.include,
        })
    rows.sort(key=lambda row: (row["course"].lower(), row["student"].lower()))
    return rows


# ---------------------------------------------------------------------------
# Batches
# ---------------------------------------------------------------------------

def _children_of(parent_ids) -> list:
    """ [(child review, its submission)] for the given parents. """
    if not parent_ids:
        return []
    return (db.session.query(Review, Submission)
            .join(Submission, Review.submission_id == Submission.id)
            .filter(Review.forked_id.in_(list(parent_ids)))
            .options(defer(Submission.code), defer(Submission.feedback), defer(Submission.extra_files))
            .all())


def _lms_states(pairs, book) -> dict:
    """ {submission_id: 'sent' | 'pending' | 'unlinked'}: whether the LMS has
    each submission's current total. The latest grade history row is the last
    grade recorded for the LMS, so a total that differs from it has not been sent. """
    submissions = {submission.id: submission for _, submission in pairs}
    if not submissions:
        return {}
    course_endpoints = dict(db.session.query(Course.id, Course.endpoint).filter(
        Course.id.in_({submission.course_id for submission in submissions.values()})).all())
    points = dict(db.session.query(Assignment.id, Assignment.points).filter(
        Assignment.id.in_({submission.assignment_id for submission in submissions.values()})).all())
    latest = {}
    for submission_id, score in (db.session.query(GradeHistory.submission_id, GradeHistory.score)
                                 .filter(GradeHistory.submission_id.in_(list(submissions)))
                                 .order_by(GradeHistory.id).all()):
        latest[submission_id] = score
    states = {}
    for submission_id, submission in submissions.items():
        if not submission.endpoint or not course_endpoints.get(submission.course_id):
            states[submission_id] = "unlinked"
            continue
        possible = points.get(submission.assignment_id)
        possible = 1 if possible is None else possible
        current = (float(submission.score or 0) + book.total(submission_id)) / 100.0 * possible
        recorded = latest.get(submission_id)
        states[submission_id] = "sent" if recorded is not None and abs(recorded - current) < 1e-6 else "pending"
    return states


def _summarize_batches(parents, viewer_course_ids) -> list:
    """ One summary per batch: counts, the range of amounts, the courses it
    reaches, how many reviews were hand-edited, and how many grades are unsent. """
    parents = list(parents)
    if not parents:
        return []
    pairs = _children_of([parent.id for parent in parents])
    book = ReviewBook({submission.id for _, submission in pairs})
    lms = _lms_states(pairs, book)
    by_parent = defaultdict(list)
    for child, submission in pairs:
        by_parent[child.forked_id].append((child, submission))
    course_ids = {submission.course_id for _, submission in pairs}
    courses = {course.id: course for course in Course.query.filter(Course.id.in_(course_ids)).all()} if course_ids else {}
    authors = {user.id: user for user in User.query.filter(
        User.id.in_({parent.author_id for parent in parents})).all()}
    summaries = []
    for parent in sorted(parents, key=lambda review: review.id, reverse=True):
        children = by_parent.get(parent.id, [])
        extra = _parse_extra(parent)
        amounts = [book.effective(child) for child, _ in children]
        batch_courses = sorted({submission.course_id for _, submission in children})
        author = authors.get(parent.author_id)
        summaries.append({
            "id": parent.id,
            "comment": parent.comment,
            "note": extra.get("note", ""),
            "rule": extra.get("rule_description", ""),
            "amount": extra.get("amount") or {},
            "fixed_amount": _plain_score(parent.score),
            "students": len(children),
            "amount_low": min(amounts) if amounts else None,
            "amount_high": max(amounts) if amounts else None,
            "customized": sum(1 for child, _ in children if _is_customized(child)),
            "pending": sum(1 for _, submission in children if lms.get(submission.id) == "pending"),
            "unlinked": sum(1 for _, submission in children if lms.get(submission.id) == "unlinked"),
            "sent": sum(1 for _, submission in children if lms.get(submission.id) == "sent"),
            "pending_submission_ids": [submission.id for _, submission in children
                                       if lms.get(submission.id) == "pending"],
            "courses": [{"id": course_id, "name": courses[course_id].name if course_id in courses else ""}
                        for course_id in batch_courses],
            "editable": all(course_id in viewer_course_ids for course_id in batch_courses),
            "author": author.name() if author is not None else "",
            "date_created": parent.date_created.isoformat() if parent.date_created else "",
            # Filled in by the caller, which knows the assignment's current version
            "assignment_changed": False,
        })
    return summaries


def _batches_for(assignment, viewer, viewer_course_ids) -> list:
    """ The batches on an assignment that the viewer can see: any with reviews
    in a course they can adjust, plus their own (even with no reviews left). """
    parent_ids = set()
    if viewer_course_ids:
        parent_ids = {forked_id for (forked_id,) in (
            db.session.query(Review.forked_id)
            .join(Submission, Review.submission_id == Submission.id)
            .filter(Submission.assignment_id == assignment.id,
                    Submission.course_id.in_(list(viewer_course_ids)),
                    Review.forked_id.isnot(None))
            .distinct().all())}
    parents = Review.query.filter(Review.id.in_(parent_ids), Review.tool == ADJUSTMENT_TOOL).all() if parent_ids else []
    own = Review.query.filter(Review.tool == ADJUSTMENT_TOOL, Review.submission_id.is_(None),
                              Review.author_id == viewer.id).all()
    known = {parent.id for parent in parents}
    parents += [parent for parent in own if parent.id not in known
                and _parse_extra(parent).get("assignment_id") == assignment.id]
    # Stamp the assignment's current version so the summary can flag a changed quiz
    summaries = _summarize_batches(parents, viewer_course_ids)
    versions = {parent.id: _parse_extra(parent).get("assignment_version") for parent in parents}
    for summary in summaries:
        made_against = versions.get(summary["id"])
        summary["assignment_changed"] = made_against is not None and made_against != assignment.version
    return summaries


def _load_batch(batch_id):
    """ A batch the viewer may change: they must be able to adjust scores in
    every course it reaches. Returns (viewer, parent, assignment, pairs). """
    viewer, _ = get_user()
    parent = Review.by_id(maybe_int(batch_id))
    if parent is None or parent.tool != ADJUSTMENT_TOOL or parent.submission_id is not None:
        return ajax_failure("That adjustment no longer exists.")
    extra = _parse_extra(parent)
    assignment = Assignment.by_id(maybe_int(extra.get("assignment_id")))
    check_resource_exists(assignment, "Assignment", extra.get("assignment_id"))
    pairs = _children_of([parent.id])
    course_ids = {submission.course_id for _, submission in pairs}
    if not course_ids and parent.author_id != viewer.id:
        return ajax_failure("Only the person who made this adjustment can change it.")
    for course_id in course_ids:
        if assignment.hidden:
            require_course_instructor(viewer, course_id)
        else:
            require_course_grader(viewer, course_id)
    return viewer, parent, assignment, pairs


def _log_rows(viewer, pairs, message: dict) -> None:
    """ One grading log entry per touched submission, added to the open transaction. """
    client_timestamp, client_timezone = client_time_fields()
    for child, submission in pairs:
        db.session.add(SubmissionLog(
            submission_id=submission.id, submission_version=submission.version,
            assignment_id=submission.assignment_id, assignment_version=submission.assignment_version,
            course_id=submission.course_id, subject_id=submission.user_id,
            event_type=SubmissionLogEvent.X_GRADE_INSTRUCTOR, file_path='', category='score_adjustment',
            label=str(message.get("action", "")),
            message=json.dumps({**message, "grader_id": viewer.id,
                                "review_id": child.id if child is not None else None}),
            client_timestamp=client_timestamp, client_timezone=client_timezone, extended=False))


def _clean_comment(comment) -> str:
    comment = str(comment or "").strip()
    if not comment:
        return ajax_failure("Write the comment students will see, so they know why their score changed.")
    if len(comment) > MAX_COMMENT_LENGTH:
        return ajax_failure(f"The comment is too long (over {MAX_COMMENT_LENGTH} characters).")
    return comment


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@blueprint_grading.route('/adjustments/', methods=['GET'])
@blueprint_grading.route('/adjustments', methods=['GET'])
@login_required
def score_adjustments():
    """ The Score Adjustments page. Without an assignment it lists the course's
    assignments that have submissions. """
    viewer, _ = get_user()
    course_id = maybe_int(request.values.get('course_id'))
    course = Course.by_id(course_id)
    check_resource_exists(course, "Course", course_id)
    require_course_grader(viewer, course_id)
    assignment_id = maybe_int(request.values.get('assignment_id'))
    assignment = None
    groups = {}
    if assignment_id is not None:
        assignment = Assignment.by_id(assignment_id)
        check_resource_exists(assignment, "Assignment", assignment_id)
        if assignment.hidden:
            require_course_instructor(viewer, course_id)
    else:
        for listed, group in course.get_submitted_assignments_grouped().all():
            groups.setdefault(group, [])
            if listed not in groups[group]:
                groups[group].append(listed)
    return render_template('grading/score_adjustments.html', course=course, course_id=course_id,
                           assignment=assignment, groups=groups,
                           default_comment=adjustments.DEFAULT_COMMENT,
                           is_instructor=viewer.is_instructor(course_id))


@blueprint_grading.route('/adjustments/load', methods=['POST'])
@login_required
def score_adjustments_load():
    """ What the page needs to start: the courses the viewer may include, the
    quiz's questions or the problem's variations, and the existing batches. """
    data = _payload()
    viewer, _ = get_user()
    assignment_id = maybe_int(data.get('assignment_id'))
    assignment = Assignment.by_id(assignment_id)
    check_resource_exists(assignment, "Assignment", assignment_id)
    usable = _usable_courses(viewer, assignment)
    if not usable:
        return ajax_failure("This assignment has no submissions in a course where you can adjust scores"
                            + (" (it is hidden, so that takes an instructor)." if assignment.hidden else "."))
    kind = _assignment_kind(assignment)
    context = _quiz_context(assignment)
    return ajax_success({
        "kind": kind,
        "assignment": {"id": assignment.id, "name": assignment.title(), "hidden": bool(assignment.hidden),
                       "points": assignment.get_points()},
        "courses": [{"id": course.id, "name": course.name, "submissions": count} for course, count in usable],
        "questions": adjustments.describe_questions(context) if context is not None else [],
        "is_survey": bool(context.is_survey) if context is not None else False,
        "variations": adjustments.describe_variations(assignment) if context is None else [],
        "batches": _batches_for(assignment, viewer, {course.id for course, _ in usable}),
        "default_comment": adjustments.DEFAULT_COMMENT,
    })


@blueprint_grading.route('/adjustments/tally', methods=['POST'])
@login_required
def score_adjustments_tally():
    """ The answer table for one question (or part), or the variation counts
    for a coding problem, across the chosen courses. """
    data = _payload()
    viewer, assignment, course_ids, usable = _load_scope(data)
    submissions = _load_submissions(assignment, course_ids)
    context = _quiz_context(assignment)
    if context is None:
        variations = adjustments.describe_variations(assignment)
        counts = defaultdict(int)
        for submission in submissions:
            counts[adjustments.variation_of(submission.id, len(variations))] += 1
        return ajax_success({"submissions": len(submissions),
                             "rows": [{"key": variation["index"], "label": variation["label"],
                                       "count": counts.get(variation["index"], 0)} for variation in variations]})
    question_id = data.get('question_id')
    if question_id not in context.questions:
        return ajax_success({"submissions": len(submissions), "rows": []})
    part = data.get('part')
    part = str(part) if part not in (None, "") else None
    states = [adjustments.grade_quiz_submission(context, submission.code) for submission in submissions]
    return ajax_success({"submissions": len(submissions),
                         "rows": adjustments.tally_answers(context, states, question_id, part)})


@blueprint_grading.route('/adjustments/preview', methods=['POST'])
@login_required
def score_adjustments_preview():
    """ Who a rule selects and what would happen to each of them. Writes nothing. """
    data = _payload()
    viewer, assignment, course_ids, usable = _load_scope(data)
    submissions = _load_submissions(assignment, course_ids)
    context = _quiz_context(assignment)
    planned, rule, amount, search_errors = _plan(assignment, submissions, data, context)
    variations = adjustments.describe_variations(assignment) if context is None else []
    courses_by_id = {course.id: course for course, _ in usable}
    return ajax_success({
        "rows": _encode_planned(planned, submissions, courses_by_id, variations),
        "search_errors": search_errors,
        "rule_description": adjustments.describe_rule(rule, context, variations),
    })


@blueprint_grading.route('/adjustments/apply', methods=['POST'])
@login_required
def score_adjustments_apply():
    """ Write a batch: the parent review, then one child review on each chosen
    submission. The rule is re-run here; the client only says which of the
    selected submissions to include, never what amount they get. """
    data = _payload()
    viewer, assignment, course_ids, usable = _load_scope(data)
    comment = _clean_comment(data.get('comment'))
    submissions = _load_submissions(assignment, course_ids)
    context = _quiz_context(assignment)
    planned, rule, amount, search_errors = _plan(assignment, submissions, data, context)
    chosen = set(_int_list(data.get('submission_ids')))
    rows = [row for row in planned if row.submission_id in chosen and row.delta != 0]
    if not rows:
        return ajax_failure("None of the selected students would change, so nothing was saved.")
    variations = adjustments.describe_variations(assignment) if context is None else []
    by_id = {submission.id: submission for submission in submissions}
    # A single amount chosen by a person is kept on the parent and inherited;
    # per-student amounts are written on each child
    shared = (int(round(amount["value"])) if amount["mode"] == adjustments.MODE_FIXED
              and amount["unit"] == adjustments.UNIT_PERCENT else None)
    parent = Review(comment=comment, location="", generic=False, tag_id=None, score=shared,
                    submission_id=None, author_id=viewer.id, assignment_version=assignment.version or 0,
                    submission_version=0, version=0, forked_id=None, forked_version=None,
                    tool=ADJUSTMENT_TOOL,
                    extra_data=json.dumps({
                        "assignment_id": assignment.id,
                        "assignment_version": assignment.version,
                        "kind": _assignment_kind(assignment),
                        "rule": rule,
                        "rule_description": adjustments.describe_rule(rule, context, variations),
                        "amount": amount,
                        "note": str(data.get('note') or "").strip()[:MAX_COMMENT_LENGTH],
                    }))
    db.session.add(parent)
    db.session.flush()
    now = datetime.now(timezone.utc)
    pairs = []
    for row in rows:
        submission = by_id[row.submission_id]
        child = Review(comment="", location="", generic=False, tag_id=None,
                       score=None if shared is not None and row.delta == shared else row.delta,
                       submission_id=submission.id, author_id=viewer.id,
                       assignment_version=submission.assignment_version or 0,
                       submission_version=submission.version or 0, version=0,
                       forked_id=parent.id, forked_version=0, tool=ADJUSTMENT_TOOL, extra_data="")
        db.session.add(child)
        submission.date_graded = now
        pairs.append((child, submission))
    db.session.flush()
    _log_rows(viewer, pairs, {"action": "apply", "batch_id": parent.id})
    db.session.commit()
    return ajax_success({
        "batch_id": parent.id,
        "applied": len(pairs),
        "batches": _batches_for(assignment, viewer, {course.id for course, _ in usable}),
    })


@blueprint_grading.route('/adjustments/batch', methods=['POST'])
@login_required
def score_adjustments_batch():
    """ The students in one batch. """
    data = _payload()
    viewer, parent, assignment, pairs = _load_batch(data.get('batch_id'))
    book = ReviewBook({submission.id for _, submission in pairs})
    lms = _lms_states(pairs, book)
    users = {user.id: user for user in User.query.filter(
        User.id.in_({submission.user_id for _, submission in pairs})).all()} if pairs else {}
    courses = {course.id: course for course in Course.query.filter(
        Course.id.in_({submission.course_id for _, submission in pairs})).all()} if pairs else {}
    rows = []
    for child, submission in pairs:
        user = users.get(submission.user_id)
        total = float(submission.score or 0) + book.total(submission.id)
        rows.append({
            "review_id": child.id,
            "submission_id": submission.id,
            "student": user.name() if user is not None else f"User {submission.user_id}",
            "course": courses[submission.course_id].name if submission.course_id in courses else "",
            "amount": book.effective(child),
            "total": total,
            "customized": _is_customized(child),
            "own_comment": child.comment or "",
            "lms": lms.get(submission.id, "unlinked"),
        })
    rows.sort(key=lambda row: (row["course"].lower(), row["student"].lower()))
    return ajax_success({"rows": rows})


@blueprint_grading.route('/adjustments/batch/edit', methods=['POST'])
@login_required
def score_adjustments_edit():
    """ Change a batch's comment, private note, or amount. A new amount is a
    single number for the whole batch (trimmed per student as usual). Reviews a
    grader edited by hand are left alone unless `include_customized` is set. """
    data = _payload()
    viewer, parent, assignment, pairs = _load_batch(data.get('batch_id'))
    extra = _parse_extra(parent)
    comment = _clean_comment(data.get('comment'))
    parent.comment = comment
    extra["note"] = str(data.get('note') or "").strip()[:MAX_COMMENT_LENGTH]
    changed_pairs = []
    if data.get('amount') not in (None, ""):
        try:
            new_amount = int(round(float(data.get('amount'))))
        except (TypeError, ValueError):
            return ajax_failure("Enter a whole number for the amount.")
        include_customized = bool(data.get('include_customized'))
        book = ReviewBook({submission.id for _, submission in pairs})
        parent.score = new_amount
        extra["amount"] = {"mode": adjustments.MODE_FIXED, "value": float(new_amount),
                           "unit": adjustments.UNIT_PERCENT}
        for child, submission in pairs:
            customized = _is_customized(child)
            if customized and not include_customized:
                # It may have been inheriting the old amount; pin it so the edit cannot move it
                if child.score is None:
                    child.score = int(round(book.effective(child)))
                continue
            others = float(submission.score or 0) + book.total(submission.id) - book.effective(child)
            delta = adjustments.trim_delta(others, new_amount)
            child.score = None if delta == new_amount else delta
            if customized:
                child.comment = ""
                child.version = 0
            changed_pairs.append((child, submission))
    parent.extra_data = json.dumps(extra)
    parent.version = (parent.version or 0) + 1
    if changed_pairs:
        _log_rows(viewer, changed_pairs, {"action": "edit", "batch_id": parent.id, "amount": parent.score})
    db.session.commit()
    usable = _usable_courses(viewer, assignment)
    return ajax_success({"changed": len(changed_pairs),
                         "batches": _batches_for(assignment, viewer, {course.id for course, _ in usable})})


@blueprint_grading.route('/adjustments/batch/remove', methods=['POST'])
@login_required
def score_adjustments_remove():
    """ Delete a batch: every child review, then the parent. """
    data = _payload()
    viewer, parent, assignment, pairs = _load_batch(data.get('batch_id'))
    _log_rows(viewer, [(None, submission) for _, submission in pairs],
              {"action": "remove", "batch_id": parent.id})
    now = datetime.now(timezone.utc)
    for child, submission in pairs:
        submission.date_graded = now
        db.session.delete(child)
    db.session.flush()
    db.session.delete(parent)
    db.session.commit()
    usable = _usable_courses(viewer, assignment)
    return ajax_success({"removed": len(pairs),
                         "batches": _batches_for(assignment, viewer, {course.id for course, _ in usable})})


@blueprint_grading.route('/adjustments/send', methods=['POST'])
@login_required
def score_adjustments_send():
    """ Send one submission's current total to the LMS. The page calls this once
    per student so each request stays short and each result can be shown.
    With `publish`, the submission is also marked Fully Graded, which is what
    lets the student see the adjustment's comment in BlockPy. """
    data = _payload()
    viewer, _ = get_user()
    submission_id = maybe_int(data.get('submission_id'))
    submission = Submission.by_id(submission_id)
    check_resource_exists(submission, "Submission", submission_id)
    require_course_grader(viewer, submission.course_id)
    if submission.assignment is not None and submission.assignment.hidden:
        require_course_instructor(viewer, submission.course_id)
    report = post_current_grade(submission, viewer)
    if data.get('publish') and submission.grading_status != GradingStatuses.FULLY_GRADED:
        submission.update_grading_status(GradingStatuses.FULLY_GRADED)
    if report.submitted:
        status = "sent"
    elif report.failure_reasons and report.failure_reasons[0][0] in (
            FailureReasons.NOT_GRADED_ASSIGNMENT, FailureReasons.NO_GRADING_CONTEXT):
        status = "unlinked"
    else:
        status = "failed"
    return ajax_success({"status": status, "message": report.first_failure_message(),
                         "submission_id": submission.id})
