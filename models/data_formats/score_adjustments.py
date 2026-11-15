"""
Score adjustments: the pure logic behind the bulk review editor
(`grading/adjustments`), which writes one review per matching submission to
correct many students' scores at once.

Nothing in here touches the database or a request, so it can be tested
directly and imported without an app context. The controller loads the
submissions, hands them in with whatever it already knows about them (their
existing review totals, whether they pass the extra search conditions), and
stores what `plan_adjustments` returns.

The pieces:

- **Quiz answers.** `tally_answers` lists every distinct answer to one question
  (or one part of a multi-part question) with how many submissions gave it and
  what credit it earns now. Each row has a stable `key`; a rule selects
  submissions by those keys.
- **Coding variations.** Kettle problems with seeded pools show each student one
  of several variants, chosen in the browser as `submission.id % variants`.
  `describe_variations` and `variation_of` reproduce that choice.
- **Amounts.** `plan_adjustments` works out each submission's adjustment. For a
  quiz question the default is the re-score difference: what the student's
  whole-percent total would be with that question counted right (or wrong),
  minus what it is now. That is exactly what fixing the key and regrading
  would give, including for pooled quizzes where students have different
  denominators. Amounts are trimmed so no total leaves 0-100.
"""
import json
import re
from dataclasses import dataclass, field
from typing import Callable, Optional

from models.data_formats.quizzes import (process_quiz, try_parse_file, check_quiz_answer,
                                         is_answer_given)

# Answer keys for the two rows that are not an answer at all
BLANK_KEY = "__blank__"
MISSING_KEY = "__missing__"
BLANK_LABEL = "Left blank"
MISSING_LABEL = "Was not given this question"

# How an amount is chosen
MODE_CREDIT = "credit"    # count the question (or part) as right
MODE_REMOVE = "remove"    # count the question (or part) as wrong
MODE_FIXED = "fixed"      # the same amount for everyone
MODE_FLOOR = "floor"      # raise the total to at least this
MODE_EXACT = "exact"      # set the total to exactly this
QUESTION_MODES = (MODE_CREDIT, MODE_REMOVE)
ALL_MODES = (MODE_CREDIT, MODE_REMOVE, MODE_FIXED, MODE_FLOOR, MODE_EXACT)

UNIT_PERCENT = "percent"
UNIT_POINTS = "points"

DEFAULT_COMMENT = "Score adjusted after instructor review."

MULTI_PART_TYPES = ('multiple_answers_question', 'matching_question',
                    'multiple_dropdowns_question', 'fill_in_multiple_blanks_question')
KEY_FIELDS = ('correct', 'correct_exact', 'correct_regex')
CHOSEN, NOT_CHOSEN = "Chosen", "Not chosen"


def as_int_score(fraction) -> int:
    """ A 0-1 score as the whole percent the submission table stores
    (the same rounding as `Submission.as_int_score`). """
    return int(round(100 * fraction))


def plain_text(text) -> str:
    """ Markdown or HTML reduced to its words, for labels and leak checks. """
    text = re.sub(r"<[^>]+>", " ", str(text or ""))
    text = re.sub(r"[`*_#>\[\]()~|]", " ", text)
    return " ".join(text.split())


def shorten(text, limit=70) -> str:
    text = " ".join(str(text).split())
    return text if len(text) <= limit else text[:limit - 1].rstrip() + "…"


# ---------------------------------------------------------------------------
# Quizzes
# ---------------------------------------------------------------------------

@dataclass
class QuizContext:
    """ A quiz's parsed body and checks. """
    body: dict
    checks: dict
    questions: dict
    question_checks: dict
    is_survey: bool


def load_quiz(assignment):
    """ (QuizContext, None), or (None, why the quiz cannot be read). """
    body_ready, body = try_parse_file(assignment.instructions, "Quiz Body")
    if not body_ready:
        return None, body
    checks_ready, checks = try_parse_file(assignment.on_run, "Quiz Checks")
    if not checks_ready:
        return None, checks
    if not isinstance(body, dict) or not isinstance(checks, dict):
        return None, "The quiz body and checks must both be JSON objects."
    questions = {question_id: question for question_id, question in (body.get('questions') or {}).items()
                 if isinstance(question, dict)}
    settings = body.get('settings') or {}
    return QuizContext(body=body, checks=checks, questions=questions,
                       question_checks=checks.get('questions') or {},
                       is_survey=str(settings.get('gradeMode', 'QUIZ')).upper() == 'SURVEY'), None


def question_parts(question) -> list:
    """ The separately-scored parts of a multi-part question as (key, label)
    pairs: options of a "choose all", statements of a matching question, blanks
    of a dropdown or fill-in question. Empty for single-answer questions. """
    question_type = question.get('type')
    answers = question.get('answers')
    if question_type == 'multiple_answers_question' and isinstance(answers, list):
        return [(str(answer), str(answer)) for answer in answers]
    if question_type == 'matching_question':
        return [(str(index), str(statement))
                for index, statement in enumerate(question.get('statements') or [])]
    if question_type in ('multiple_dropdowns_question', 'fill_in_multiple_blanks_question'):
        if isinstance(answers, dict):
            return [(str(blank), str(blank)) for blank in answers]
        return []
    return []


def is_question_graded(context: QuizContext, question_id) -> bool:
    """ Whether answers to this question are checked against a key at all. """
    question = context.questions.get(question_id, {})
    if context.is_survey or question.get('type') in ('essay_question', 'text_only_question'):
        return False
    check = context.question_checks.get(question_id, {})
    return isinstance(check, dict) and any(key in check for key in KEY_FIELDS)


def describe_questions(context: QuizContext) -> list:
    """ The questions of a quiz for the question dropdown, in author order.
    Text-only blocks are skipped: they have no answer to select on. """
    described = []
    position = 0
    for question_id, question in context.questions.items():
        if question.get('type') == 'text_only_question':
            continue
        position += 1
        described.append({
            "id": question_id,
            "position": position,
            "label": f"Q{position} · {shorten(plain_text(question.get('body')) or question_id)}",
            "type": question.get('type'),
            "points": question.get('points', 1),
            "graded": is_question_graded(context, question_id),
            "parts": [{"key": key, "label": shorten(plain_text(label) or key, 50)}
                      for key, label in question_parts(question)],
        })
    return described


def _stable(value) -> str:
    return json.dumps(value, sort_keys=True, ensure_ascii=False)


def answer_key(question, student, part=None):
    """ The (key, label) of one student's answer to a question, or to one part
    of it. `student` is their entry in `studentAnswers`, or None when they were
    never given the question (a pool that hid it, or a quiz they never opened).
    Equal answers always produce equal keys, so a rule can select by key. """
    if student is None:
        return MISSING_KEY, MISSING_LABEL
    question_type = question.get('type')
    if part is not None:
        if question_type == 'multiple_answers_question':
            chosen = part in [str(choice) for choice in student] if isinstance(student, (list, tuple)) else False
            return (CHOSEN, CHOSEN) if chosen else (NOT_CHOSEN, NOT_CHOSEN)
        if question_type == 'matching_question':
            index = int(part) if str(part).isdigit() else -1
            value = student[index] if isinstance(student, (list, tuple)) and 0 <= index < len(student) else None
        else:
            value = student.get(part) if isinstance(student, dict) else None
        if not is_answer_given(value):
            return BLANK_KEY, BLANK_LABEL
        if isinstance(value, str):
            return value.strip(), value.strip()
        return _stable(value), _readable(value)
    if not is_answer_given(student):
        return BLANK_KEY, BLANK_LABEL
    if isinstance(student, str):
        return student.strip(), student.strip()
    if question_type == 'multiple_answers_question' and isinstance(student, (list, tuple)):
        chosen = sorted(str(choice) for choice in student)
        return _stable(chosen), _readable(chosen)
    return _stable(student), _readable(student)


def _readable(value) -> str:
    if isinstance(value, dict):
        return "; ".join(f"{key}: {_readable(inner)}" for key, inner in value.items())
    if isinstance(value, (list, tuple)):
        return ", ".join(_readable(inner) for inner in value) or "(nothing chosen)"
    return str(value)


@dataclass
class QuizSubmissionState:
    """ One submission graded against the quiz as it is now. """
    answers: dict
    # The grader's result, or None when the submission could not be graded
    result: Optional[object] = None
    problem: Optional[str] = None
    attempting: bool = False

    @property
    def points_possible(self) -> float:
        return self.result.points_possible if self.result is not None else 0

    def question_score(self, question_id) -> Optional[float]:
        """ 0-1 credit this student has on the question; None if it was not graded for them. """
        if self.result is None:
            return None
        feedback = self.result.feedbacks.get(question_id)
        if not feedback or feedback.get('status') != 'graded':
            return None
        return float(feedback.get('score') or 0)


def grade_quiz_submission(context: QuizContext, code) -> QuizSubmissionState:
    """ Parse and grade one submission's answers; never raises. """
    ready, student_body = try_parse_file(code or "{}", "Student Submission")
    if not ready or not isinstance(student_body, dict):
        return QuizSubmissionState(answers={}, problem="The submission is not valid quiz data.")
    answers = student_body.get('studentAnswers')
    if not isinstance(answers, dict):
        return QuizSubmissionState(answers={}, problem="Never answered the quiz.")
    attempt = student_body.get('attempt')
    attempting = bool(attempt.get('attempting')) if isinstance(attempt, dict) else False
    try:
        result = process_quiz(context.body, context.checks, student_body)
    except Exception as error:
        return QuizSubmissionState(answers=answers, attempting=attempting,
                                   problem=f"Could not be graded: {type(error).__name__}: {error}")
    return QuizSubmissionState(answers=answers, result=result, attempting=attempting)


def _part_argument(question, part):
    """ The `part` argument `check_quiz_answer` expects for our part key. """
    if question.get('type') == 'matching_question':
        return int(part)
    return part


def part_is_correct(context: QuizContext, question_id, student, part) -> Optional[bool]:
    """ Whether one part of a student's answer is right under the current key. """
    question = context.questions.get(question_id, {})
    check = context.question_checks.get(question_id, {})
    question_type = question.get('type')
    try:
        if question_type == 'multiple_answers_question':
            value = tuple(str(choice) for choice in student)
        elif question_type == 'matching_question':
            value = student[int(part)]
        else:
            value = student.get(part, "")
        return bool(check_quiz_answer(question, {}, value, check, True, _part_argument(question, part)))
    except Exception:
        return None


def part_count(context: QuizContext, question_id, student) -> int:
    """ How many parts the grader averages this student's score over. """
    question = context.questions.get(question_id, {})
    check = context.question_checks.get(question_id, {})
    question_type = question.get('type')
    if question_type == 'multiple_answers_question':
        return len(question.get('answers') or [])
    if question_type == 'matching_question':
        return min(len(student) if isinstance(student, (list, tuple)) else 0, len(check.get('correct') or []))
    for key in KEY_FIELDS:
        if isinstance(check.get(key), dict):
            return len(check[key])
    return 0


def _credit_word(fractions) -> str:
    """ Summarize the credit a group of students has: full, none, partial, or mixed. """
    known = [fraction for fraction in fractions if fraction is not None]
    if not known:
        return "ungraded"
    if all(fraction >= 1 for fraction in known):
        return "full"
    if all(fraction <= 0 for fraction in known):
        return "none"
    if len(set(known)) == 1:
        return "partial"
    return "mixed"


def _authored_order(question, part):
    """ The answers an author listed, in their order, so the table reads like the quiz. """
    question_type = question.get('type')
    answers = question.get('answers')
    if part is None:
        if question_type == 'multiple_choice_question' and isinstance(answers, list):
            return [str(answer) for answer in answers]
        if question_type == 'true_false_question':
            return ['true', 'false']
        return []
    if question_type == 'multiple_answers_question':
        return [CHOSEN, NOT_CHOSEN]
    if question_type == 'matching_question' and isinstance(answers, list):
        return [str(answer) for answer in answers]
    if isinstance(answers, dict) and isinstance(answers.get(part), list):
        return [str(option) for option in answers[part]]
    return []


def tally_answers(context: QuizContext, states, question_id, part=None) -> list:
    """ Every distinct answer to a question (or one part) across the given
    graded submissions, as rows of {key, label, count, credit}: authored options
    first in the author's order (zero counts kept), then anything else by
    frequency, then blanks, then students who were never given the question. """
    question = context.questions.get(question_id, {})
    graded = is_question_graded(context, question_id)
    rows = {}

    def row_for(key, label):
        if key not in rows:
            rows[key] = {"key": key, "label": label, "count": 0, "fractions": []}
        return rows[key]

    for option in _authored_order(question, part):
        row_for(option, option)
    for state in states:
        student = state.answers.get(question_id)
        key, label = answer_key(question, student, part)
        row = row_for(key, label)
        row["count"] += 1
        if not graded or key == MISSING_KEY:
            continue
        if part is None:
            row["fractions"].append(state.question_score(question_id))
        else:
            correct = part_is_correct(context, question_id, student, part)
            row["fractions"].append(None if correct is None else float(correct))
    authored = _authored_order(question, part)
    special = [BLANK_KEY, MISSING_KEY]
    ordered = [rows[key] for key in authored if key in rows]
    ordered += sorted((row for key, row in rows.items() if key not in authored and key not in special),
                      key=lambda row: (-row["count"], row["label"]))
    ordered += [rows[key] for key in special if key in rows]
    return [{"key": row["key"], "label": row["label"], "count": row["count"],
             "credit": ("not counted" if row["key"] == MISSING_KEY
                        else _credit_word(row["fractions"]) if graded else "ungraded")}
            for row in ordered]


def rescore_delta(state: QuizSubmissionState, question_id, points, new_question_score) -> int:
    """ How many whole percent the quiz total moves if this student's credit on
    one question becomes `new_question_score` (0-1). """
    old_question_score = state.question_score(question_id)
    possible = state.points_possible
    if old_question_score is None or not possible:
        return 0
    earned = state.result.score * possible
    changed = earned + (new_question_score - old_question_score) * points
    return as_int_score(changed / possible) - as_int_score(earned / possible)


# ---------------------------------------------------------------------------
# Coding variations
# ---------------------------------------------------------------------------

# Mirrors POOL_SEPARATORS in frontend/components/kettle/kettle.ts
INSTRUCTION_POOL = re.compile(r"<!-{4,}# (.+) #-{4,}>")
TEST_POOL = re.compile(r"/\*{4,}# (.+) #\*{4,}/")


def pool_labels(text, pattern) -> list:
    """ The names of the variants in a pooled text. A pool is a header, the
    variants, and a footer, each introduced by a separator line, so the variants
    are named by every separator but the last. Fewer than two separators is not
    a pool (the frontend calls that an invalid pool). """
    names = [name.strip() for name in pattern.findall(text or "")]
    return names[:-1] if len(names) >= 2 else []


def describe_variations(assignment) -> list:
    """ The variants of a seeded-pool coding problem as [{index, label}], or []
    when the assignment does not use seeded pools. Instructions name the
    variants when they are pooled; otherwise the tests do. """
    try:
        settings = json.loads(assignment.settings or "{}")
    except ValueError:
        settings = {}
    if not isinstance(settings, dict) or str(settings.get('poolRandomness', '')).upper() != 'SEED':
        return []
    labels = pool_labels(assignment.instructions, INSTRUCTION_POOL) or pool_labels(assignment.on_run, TEST_POOL)
    return [{"index": index, "label": label} for index, label in enumerate(labels)]


def variation_of(submission_id, variation_count) -> Optional[int]:
    """ Which variant a submission was shown: the seed is the submission's id. """
    if not variation_count or submission_id is None:
        return None
    return submission_id % variation_count


# ---------------------------------------------------------------------------
# Planning a batch
# ---------------------------------------------------------------------------

@dataclass
class PlannedAdjustment:
    """ What would happen to one submission. """
    submission_id: int
    user_id: Optional[int]
    course_id: Optional[int]
    # The submission's own score (0-100), the sum of its reviews, and their total
    base_score: float
    review_total: float
    # The adjustment before and after trimming to keep the total in 0-100
    raw_delta: int
    delta: int
    answer_label: str = ""
    variation: Optional[int] = None
    notes: list = field(default_factory=list)
    # Whether the row starts out ticked in the preview
    include: bool = True

    @property
    def now(self) -> float:
        return self.base_score + self.review_total

    @property
    def after(self) -> float:
        return self.now + self.delta


def trim_delta(total, delta) -> int:
    """ Shrink an adjustment so `total + delta` stays within 0-100. It only ever
    shrinks: a total that is already out of range (say, a cheating penalty far
    below zero) is left where it is rather than dragged back to the limit. """
    if delta > 0:
        return int(max(0, min(delta, 100 - total)))
    if delta < 0:
        return int(min(0, max(delta, -total)))
    return 0


def normalize_amount(amount) -> dict:
    """ A cleaned copy of an amount description; raises ValueError if unusable. """
    amount = amount if isinstance(amount, dict) else {}
    mode = amount.get("mode", MODE_CREDIT)
    if mode not in ALL_MODES:
        raise ValueError(f"Unknown adjustment mode: {mode!r}")
    unit = amount.get("unit", UNIT_PERCENT)
    if unit not in (UNIT_PERCENT, UNIT_POINTS):
        raise ValueError(f"Unknown unit: {unit!r}")
    value = 0.0
    if mode not in QUESTION_MODES:
        try:
            value = float(amount.get("value"))
        except (TypeError, ValueError):
            raise ValueError("Enter a number for the amount.")
        if mode in (MODE_FLOOR, MODE_EXACT):
            unit = UNIT_PERCENT
            if not 0 <= value <= 100:
                raise ValueError("A target total must be between 0 and 100.")
    return {"mode": mode, "value": value, "unit": unit}


def normalize_rule(rule) -> dict:
    """ A cleaned copy of a rule: which question/answers or variations select
    the submissions. The search conditions are parsed by the controller. """
    rule = rule if isinstance(rule, dict) else {}
    question_id = rule.get("question_id") or None
    part = rule.get("part")
    part = str(part) if part not in (None, "") else None
    answers = [str(key) for key in (rule.get("answers") or [])]
    variations = rule.get("variations")
    variations = sorted({int(index) for index in variations}) if variations else []
    return {"question_id": question_id, "part": part, "answers": answers, "variations": variations}


def describe_rule(rule, context: Optional[QuizContext], variations=()) -> str:
    """ A one-line, grader-only description of who a rule selects. Never shown to students. """
    pieces = []
    if rule.get("question_id") and context is not None:
        described = {question["id"]: question for question in describe_questions(context)}
        question = described.get(rule["question_id"])
        name = f"Q{question['position']}" if question else rule["question_id"]
        if rule.get("part") is not None:
            name += f" [{shorten(rule['part'], 30)}]"
        labels = {BLANK_KEY: BLANK_LABEL.lower(), MISSING_KEY: MISSING_LABEL.lower()}
        answers = [labels.get(key, shorten(key, 30)) for key in rule.get("answers", [])]
        pieces.append(f"{name}: {' / '.join(answers) if answers else 'no answers selected'}")
    if rule.get("variations"):
        names = {variation["index"]: variation["label"] for variation in variations}
        pieces.append("variation " + ", ".join(names.get(index, str(index + 1)) for index in rule["variations"]))
    return "; ".join(pieces) or "everyone"


def _question_target(context, state, rule, mode):
    """ The 0-1 credit the rule's question should have for this student under a
    question mode, or None when the mode does not apply to them. """
    question_id, part = rule["question_id"], rule["part"]
    student = state.answers.get(question_id)
    current = state.question_score(question_id)
    if student is None or current is None:
        return None
    if part is None:
        return 1.0 if mode == MODE_CREDIT else 0.0
    parts = part_count(context, question_id, student)
    correct = part_is_correct(context, question_id, student, part)
    if not parts or correct is None:
        return None
    if mode == MODE_CREDIT:
        return current if correct else min(1.0, current + 1.0 / parts)
    return max(0.0, current - 1.0 / parts) if correct else current


def plan_adjustments(submissions, rule, amount, context: Optional[QuizContext] = None,
                     variation_count: int = 0, review_totals: Optional[dict] = None,
                     passes_conditions: Optional[Callable] = None,
                     already_adjusted: Optional[dict] = None) -> list:
    """ Decide the adjustment for every submission a rule selects.

    :param submissions: objects with id, user_id, course_id, score and (for quizzes) code
    :param rule: from `normalize_rule`
    :param amount: from `normalize_amount`
    :param context: the quiz, when the assignment is one
    :param variation_count: how many variants the coding problem has (0 for none)
    :param review_totals: {submission_id: sum of that submission's existing review scores}
    :param passes_conditions: submission -> bool, the extra search conditions
    :param already_adjusted: {submission_id: description} for submissions an earlier
        batch already adjusted for this same question; they are planned but not ticked
    :return: one PlannedAdjustment per selected submission, in the order given
    """
    review_totals = review_totals or {}
    already_adjusted = already_adjusted or {}
    mode = amount["mode"]
    question_id = rule["question_id"] if context is not None else None
    question = context.questions.get(question_id) if question_id else None
    if mode in QUESTION_MODES and question is None:
        raise ValueError("Choose a question to give or remove credit for.")
    selected_answers = set(rule["answers"])
    selected_variations = set(rule["variations"])
    planned = []
    for submission in submissions:
        state = grade_quiz_submission(context, submission.code) if context is not None else None
        answer_label = ""
        if question is not None:
            key, answer_label = answer_key(question, state.answers.get(question_id), rule["part"])
            if key not in selected_answers:
                continue
        variation = variation_of(submission.id, variation_count)
        if selected_variations and variation not in selected_variations:
            continue
        if passes_conditions is not None and not passes_conditions(submission):
            continue
        base_score = float(submission.score or 0)
        review_total = float(review_totals.get(submission.id, 0) or 0)
        now = base_score + review_total
        notes, include = [], True
        if mode in QUESTION_MODES:
            target = _question_target(context, state, rule, mode)
            if target is None:
                raw_delta = 0
                notes.append("Was not given this question" if state.answers.get(question_id) is None
                             else "This question could not be graded for them")
            else:
                raw_delta = rescore_delta(state, question_id, question.get('points', 1), target)
        elif mode == MODE_FIXED:
            if amount["unit"] == UNIT_POINTS:
                possible = state.points_possible if state is not None else 0
                if possible:
                    raw_delta = as_int_score(amount["value"] / possible)
                else:
                    raw_delta = 0
                    notes.append("No quiz points to measure against")
            else:
                raw_delta = int(round(amount["value"]))
        elif mode == MODE_FLOOR:
            raw_delta = int(round(max(0.0, amount["value"] - now)))
        else:
            raw_delta = int(round(amount["value"] - now))
        delta = trim_delta(now, raw_delta)
        if delta != raw_delta:
            limit = 100 if raw_delta > 0 else 0
            notes.append(f"Trimmed from {raw_delta:+d} to stay at {limit}%" if delta
                         else f"Already at or past {limit}%")
        if state is not None and state.problem:
            notes.append(state.problem)
        if state is not None and state.attempting:
            notes.append("Quiz attempt in progress")
            include = False
        if (state is not None and state.result is not None
                and as_int_score(state.result.score) != int(round(base_score))):
            notes.append(f"Stored score is {int(round(base_score))}%, but the quiz now grades to "
                         f"{as_int_score(state.result.score)}%")
        if submission.id in already_adjusted:
            notes.append(f"Already adjusted: {already_adjusted[submission.id]}")
            include = False
        if delta == 0:
            include = False
            if not notes:
                notes.append("No change")
        planned.append(PlannedAdjustment(
            submission_id=submission.id, user_id=getattr(submission, 'user_id', None),
            course_id=getattr(submission, 'course_id', None),
            base_score=base_score, review_total=review_total, raw_delta=raw_delta, delta=delta,
            answer_label=answer_label, variation=variation, notes=notes, include=include))
    return planned
