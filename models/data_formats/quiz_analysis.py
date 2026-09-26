"""
Process canvas quizzes to make them easier to parse
"""

from collections import defaultdict, Counter
from statistics import mean, median
from textwrap import indent
from pprint import pprint

from markdown import Markdown
from dataclasses import dataclass, field
from typing import Optional
import re

from html.parser import HTMLParser
from math import isnan

from common.stats import correlation, binconf
from models.data_formats.quizzes import process_quiz, try_parse_file, check_quiz_answer, is_answer_given
from models.role import Role



class MLStripper(HTMLParser):
    def __init__(self):
        super().__init__()
        self.reset()
        self.strict = False
        self.convert_charrefs = True
        self.fed = []

    def handle_data(self, d):
        self.fed.append(d)

    def get_data(self):
        return ''.join(self.fed)


def strip_tags(html):
    s = MLStripper()
    s.feed(html)
    return s.get_data()


def to_percent(a_value):
    if isnan(a_value):
        return "NaN%"
    return str(int(round(a_value * 1000)) / 10) + "%"


def clean_text(text):
    return text.replace('\\', '')


def to_python_name(s):
    # Remove invalid characters
    s = re.sub('[^0-9a-zA-Z_]', '', s)
    # Remove leading characters until we find a letter or underscore
    s = re.sub('^[^a-zA-Z_]+', '', s)
    return s


def fill_nan_str(value):
    if isinstance(value, float) and isnan(value):
        return ''
    else:
        return str(value)


def split_on_commas(text):
    return re.split(r'(?<!\\),', text)


def sort_by_value_count(pair):
    value, (count, multiples, initials) = pair
    return value, -count


def sort_by_count(pair):
    value, (count, multiples, initials) = pair
    return -count


'''
% of students who chose it at some point
% of students who chose it on their initial submission
% of students who chose it on their final submission
'''


class QuizQuestionType:
    name = "Abstract Quiz Question Type"

    @staticmethod
    def key_occurrences(value):
        return sort_by_value_count(value)

    def __init__(self, question, submissions, attempts, user_ids,
                 submission_scores, quiz_scores, course_scores,
                 max_score, anonymous, path, quiz, position):
        # Critical Information
        self.quiz = quiz
        self.question = question
        self.submissions = submissions
        self.attempts = attempts
        self.position = position
        if user_ids is None:
            user_ids = ['Anon ' + str(i) for i in
                        range(len(submissions))]
        self.user_ids = user_ids
        self.uas = zip(user_ids, attempts, submissions)
        self.scores = list(zip(user_ids, attempts, submission_scores,
                               quiz_scores))
        self.course_scores = course_scores
        self.max_score = max_score
        self.anonymous = anonymous
        self.path = path
        # Decorative information
        self.question_name = question['question_name']
        self.points_possible = question['points_possible']
        self.text = question['question_text']
        # Helper information
        self.total_submissions = len(submissions)
        self.total_students = len(set(user_ids))
        self.final_submission = {user_id: attempt
                                 for attempt, user_id
                                 in sorted(zip(attempts, user_ids))}
        # Calculated Information
        self.results = []

        self.prepare_corrects()

    def analyze(self):
        pass

    def to_answers(self):
        yield from self.break_up_submission()

    def to_json(self):
        quiz_disc, course_disc = self.calculate_discrimination()
        o_diff, i_diff, f_diff = self.calculate_difficulty()
        return {
            'question_name': self.question_name,
            'name': self.name,
            'path': self.path,
            'anonymous': self.anonymous,
            'points_possible': self.points_possible,
            'text': self.text,
            'discrimination': {
                'quiz': quiz_disc,
                'course': course_disc
            },
            'difficulty': {
                'overall': o_diff,
                'initial': i_diff,
                'final': f_diff
            }
        }

    def to_text(self):
        body = [self.question_name,
                "\t" + self.name,
                "\t" + str(self.points_possible) + " points",
                indent(strip_tags(self.text.strip()), "\t"),
                "\t---Discrimination---"]
        quiz, course = self.calculate_discrimination()
        body.append("\tQuiz: {}".format(
            to_percent(quiz)
        ))
        body.append("\tCourse: {}".format(
            to_percent(course)
        ))
        o_diff, i_diff, f_diff = self.calculate_difficulty()
        if o_diff is not None:
            body.append("\t---Difficulty---")
            body.append("\tOverall: {}".format(to_percent(o_diff)))
            body.append("\tInitial: {}".format(to_percent(i_diff)))
            body.append("\tFinal: {}".format(to_percent(f_diff)))
        body.append("\t---Answers---")
        body.extend(self.to_text_answers())
        return "\n".join(body)

    def to_text_answers(self):
        body = []
        for answer, correct, o, i, f in self.results:
            body.append("" + "\t{},\t{},\t{}:{}\t".format(
                *map(to_percent, (o, i, f)),
                ('*' if correct else '')
            ) + strip_tags(answer))
        return body

    def score_occurrences(self, occurrences, correctness):
        self.results = []
        sorted_occurrences = sorted(occurrences.items(),
                                    key=self.key_occurrences)
        self.quiz_discrimination = []
        self.course_discrimiation = []
        for key, (count, initials, finals) in sorted_occurrences:
            is_correct = correctness(key)
            o_score = count / self.total_submissions
            i_score = len(initials) / self.total_students
            f_score = len(finals) / self.total_students
            self.results.append(
                (key, is_correct, o_score, i_score, f_score)
            )

    def check_answers(self, submission):
        return [(self.question_name, clean_text(submission), "Unknown")]

    def prepare_corrects(self):
        pass

    def submission_keys(self, submission):
        """
        Find all the possible subquestions and parts to this
        submission, generate keys in the occurrence dictionary
        for them.
        """
        return (clean_text(submission),)

    def count_occurrences(self):
        occurrences = defaultdict(lambda: [0, set(), set()])
        for (user_id, attempt, submission) in self.uas:
            submission = fill_nan_str(submission)
            for key in self.submission_keys(submission):
                count, initials, finals = occurrences[key]
                occurrences[key][0] += 1
                if attempt == 1:
                    initials.add(user_id)
                if self.final_submission[user_id] == attempt:
                    finals.add(user_id)
        return occurrences

    def break_up_submission(self):
        for (user_id, attempt, submission) in self.uas:
            submission = fill_nan_str(submission)
            for subquestion, subanswer, correct in self.check_answers(submission):
                # unique_keys = self.submission_keys(submission)
                # print(unique_key)
                # for unique_key in unique_keys:
                yield [type(self).__name__, user_id, self.quiz['title'], self.question_name,
                       self.question['question_text'],
                       attempt, subquestion, subanswer, correct]

    def calculate_discrimination(self):
        initial_quizzes = []
        initial_courses = []
        for user_id, attempt, submission, quiz in self.scores:
            if attempt == 1:
                initial_quizzes.append((submission, quiz))
                if user_id in self.course_scores:
                    course = self.course_scores[user_id]
                    initial_courses.append((submission, course))
        quiz, _ = correlation(*zip(*initial_quizzes))
        if initial_courses:
            course, _ = correlation(*zip(*initial_courses))
        else:
            course = float('nan')
        return quiz, course

    def calculate_difficulty(self):
        if not self.max_score:
            return 0, 0, 0
        total = 0
        initial = 0
        final = 0
        for user_id, attempt, submission, quiz in self.scores:
            total += submission
            if attempt == 1:
                initial += submission
            elif self.final_submission[user_id] == attempt:
                final += submission
        o_score = total / (self.total_submissions * self.max_score)
        i_score = initial / (self.total_students * self.max_score)
        f_score = final / (self.total_students * self.max_score)
        return o_score, i_score, f_score


class ShortAnswerQuestion(QuizQuestionType):
    name = "Short Answer Question"

    @staticmethod
    def key_occurrences(value):
        return sort_by_count(value)

    def single_correctness(self, value):
        return value in (answer['text'] if answer['text']
                         else strip_tags(answer['html'])
                         for answer in self.question['answers'])

    def analyze(self):
        occurrences = self.count_occurrences()
        self.score_occurrences(occurrences, self.single_correctness)

    def check_answers(self, submission):
        return [(self.question_name, clean_text(submission), self.single_correctness(submission))]

    def to_question(self):
        pass


class MatchingQuestions(QuizQuestionType):
    name = "Matching Question"

    def prepare_corrects(self):
        self.correct_answers = {answer['left']: answer['right']
                                for answer in self.question['answers']}

    def single_correctness(self, value):
        left, right = value
        # TODO: Fix this hack, why does it work?
        # Specific case was "True"
        if left not in self.correct_answers:
            left = '"{}"'.format(left)
        return right == self.correct_answers.get(left, None)

    def analyze(self):
        occurrences = self.count_occurrences()
        self.score_occurrences(occurrences, self.single_correctness)

    def check_answers(self, submission):
        for answer in split_on_commas(submission):
            if not answer:
                continue
            key, value = map(clean_text, answer.split("=>"))
            yield (key, value, self.single_correctness((key, value)))

    def submission_keys(self, submission):
        for answer in split_on_commas(submission):
            if not answer:
                continue
            key, value = map(clean_text, answer.split("=>"))
            yield (key, value)

    def to_text_answers(self):
        body = []
        previous_label = None
        for (key, value), correct, o, i, f in self.results:
            if previous_label != key:
                body.append("\t" + key)
            body.append("\t\t{},\t{},\t{}:{}\t".format(
                *map(to_percent, (o, i, f)),
                ('*' if correct else '')
            ) + strip_tags(value))
            previous_label = key
        return body


class FillInMultipleBlanks(QuizQuestionType):
    name = "Fill in Multiple Blanks"

    def submission_keys(self, submission):
        for label, answer in zip(self.labels, split_on_commas(submission)):
            label = clean_text(label)
            answer = clean_text(answer)
            yield (label, answer)

    def prepare_corrects(self):
        # Retrieve all possible answers
        possible_answers = defaultdict(list)
        self.labels = []
        for answer in self.question['answers']:
            blank_id = answer['blank_id']
            cleaned_text = clean_text(answer['text'])
            possible_answers[blank_id].append(cleaned_text)
            if blank_id not in self.labels:
                self.labels.append(blank_id)
        self.possible_answers = possible_answers

    def single_correctness(self, value):
        # Calculate correctness
        label, given = value
        return given in self.possible_answers[label]

    def check_answers(self, submission):
        for label, answer in zip(self.labels, split_on_commas(submission)):
            label = clean_text(label)
            answer = clean_text(answer)
            yield (label, answer, self.single_correctness((label, answer)))

    def analyze(self):
        # Calculate occurrences of each possible answer
        occurrences = self.count_occurrences()
        self.score_occurrences(occurrences, self.single_correctness)

    def to_text_answers(self):
        body = []
        previous_label = None
        for (label, answer), correct, o, i, f in self.results:
            if previous_label != label:
                body.append("\t" + label)
            body.append("\t\t{},\t{},\t{}:{}\t".format(
                *map(to_percent, (o, i, f)),
                ('*' if correct else '')
            ) + strip_tags(answer))
            previous_label = label
        return body


class MultipleChoiceQuestion(QuizQuestionType):
    name = "Multiple Choice Question"

    def prepare_corrects(self):
        self.answers = [str(answer['text']) if answer['text']
                        else strip_tags(answer['html'])
                        for answer in self.question['answers']
                        if answer['weight']]

    def single_correctness(self, value):
        # TODO: Fix this hack, why does it work?
        # Specific case was "True"
        if value not in self.answers:
            value = '"{}"'.format(value)
        return value in self.answers

    def check_answers(self, submission):
        return [(self.question_name, clean_text(submission), self.single_correctness(submission))]

    def analyze(self):
        occurrences = self.count_occurrences()
        self.score_occurrences(occurrences, self.single_correctness)


class MultipleAnswersQuestion(QuizQuestionType):
    name = "Multiple Answers Question"

    def submission_keys(self, submission):
        for answer in split_on_commas(submission):
            yield clean_text(answer)

    def check_answers(self, submission):
        given_answers = [clean_text(s) for s in split_on_commas(submission)]
        for label in self.labels:
            student_answered = (label in given_answers)
            yield (label, student_answered, (label in self.possible_answers) == student_answered)

    def prepare_corrects(self):
        # self.answers = [str(answer['text']) if answer['text']
        #           else strip_tags(answer['html'])
        #           for answer in self.question['answers']
        #           if answer['weight']]

        self.possible_answers = []
        self.labels = []
        for answer in self.question['answers']:
            cleaned_text = str(answer['text']) if answer['text'] else strip_tags(answer['html'])
            self.labels.append(cleaned_text)
            if answer['weight']:
                self.possible_answers.append(cleaned_text)

    def single_correctness(self, value):
        return value in self.possible_answers

    def analyze(self):
        occurrences = self.count_occurrences()
        self.score_occurrences(occurrences, self.single_correctness)


class MultipleDropDownsQuestion(FillInMultipleBlanks):
    name = "Multiple Drop-Down Question"


class TrueFalseQuestion(MultipleChoiceQuestion):
    name = "True/False Questions"


class EssayQuestion(QuizQuestionType):
    name = "Essay Quesion"

    def check_answers(self, submission):
        return [(self.question_name, clean_text(submission), "Unknown")]

    def analyze(self):
        self.results = list(self.submissions)

    def to_text(self):
        return self.name


class TextOnlyQuestion(QuizQuestionType):
    def analyze(self):
        self.results = []

    def to_text(self):
        return self.name

    def check_answers(self, submission):
        return [(self.question_name, clean_text(submission), "Unknown")]


class DefaultQuestionType(QuizQuestionType):
    def calculate_difficulty(self):
        return 0, 0, 0

    def calculate_discrimination(self):
        return 0, 0

    def analyze(self):
        self.results = []

    def to_text(self):
        return self.name


QUESTION_TYPES = {
    'fill_in_multiple_blanks_question': FillInMultipleBlanks,
    'matching_question': MatchingQuestions,
    'short_answer_question': ShortAnswerQuestion,
    'multiple_choice_question': MultipleChoiceQuestion,
    'multiple_answers_question': MultipleAnswersQuestion,
    'true_false_question': TrueFalseQuestion,
    'multiple_dropdowns_question': MultipleDropDownsQuestion,
    'essay_question': EssayQuestion,
    'text_only_question': TextOnlyQuestion,
}


@dataclass
class QuizQuestionAttempt:
    correct: bool
    score: float
    overall_score: float


@dataclass
class QuizQuestionPart:
    key: str
    value: str
    correct: bool


@dataclass
class QuizQuestionStats:
    question_id: str
    body: str
    type: str
    points_possible: int
    scores: list[QuizQuestionAttempt]
    parts: list[QuizQuestionPart]
    difficulty = None
    discrimination = None
    correct_rate = None
    per_part_stats = None
    # Whether answers are checked against a key. False for surveys, for free-text
    # questions, and for a quiz question whose checks have no key at all.
    graded: bool = True
    # An ordered scale (a horizontal multiple choice, or numbered options like
    # "(1) Not at all ... (6) Very"): drawn as a diverging stacked bar.
    likert: bool = False
    # The question's options in the author's order, per part (None for a single
    # part), so distributions can be shown in that order with zero counts kept.
    options: dict = field(default_factory=dict)
    # {part: [OptionCount, ...]} in option order, plus any unexpected values last
    distribution: dict = field(default_factory=dict)
    # Colors aligned with each part's distribution (diverging for Likert scales),
    # and the text color that reads on each
    colors: dict = field(default_factory=dict)
    inks: dict = field(default_factory=dict)
    # Mean 1-based position on the scale, for Likert questions
    scale_mean: Optional[float] = None
    # How many graded submissions gave no answer to this question at all
    no_answer: int = 0
    # Free-text answers (essay questions, and ungraded short answers)
    responses: list = field(default_factory=list)

    @property
    def points(self):
        return self.points_possible

    @property
    def responded(self) -> int:
        return len(self.scores) - self.no_answer

    @property
    def response_counts(self) -> list:
        """ Free-text answers grouped, most common first, as (text, count). """
        return Counter(response.strip() for response in self.responses if response.strip()).most_common()

    @property
    def scale_size(self) -> int:
        return len(self.options.get(None, []))

    @property
    def chosen_distribution(self) -> list:
        """ For an ungraded "choose all that apply" question: one row per option
        with how many respondents chose it, in the author's order. """
        rows = []
        for option, part_rows in self.distribution.items():
            chosen = next((row for row in part_rows if row.label == 'Chosen'), None)
            rows.append(OptionCount(str(option), chosen.count if chosen else 0, chosen.share if chosen else 0.0))
        return rows

    @property
    def plain_text(self) -> str:
        """ The question body as plain text, for chart row labels. """
        return " ".join(strip_tags(self.body or "").split())

    @property
    def single_part(self) -> bool:
        """ Single-valued question types (multiple choice, true/false, short answer)
        have exactly one part, keyed by None; everything else has named parts. """
        return bool(self.per_part_stats) and list(self.per_part_stats) == [None]


@dataclass
class QuizSubmissionSummary:
    """ One graded quiz submission, for the score distribution and the per-student table. """
    submission_id: Optional[int]
    user_id: Optional[int]
    course_id: Optional[int]
    score: float
    correct: bool
    answered: int
    attempts: Optional[int] = None
    date_submitted: Optional[object] = None


@dataclass
class OptionCount:
    label: str
    count: int
    share: float
    expected: bool = True


@dataclass
class ScoreBin:
    low: int
    high: int
    count: int

    @property
    def label(self) -> str:
        return f"{self.low}-{self.high}%"


@dataclass
class QuizAnalysis:
    """ Everything the quiz analysis page and the background quiz report compute
    from one quiz's submissions: per-question item statistics, one summary per
    graded submission, and the submissions that could not be graded (with why). """
    questions: dict[str, QuizQuestionStats] = field(default_factory=dict)
    submissions: list[QuizSubmissionSummary] = field(default_factory=list)
    skipped: list[tuple[Optional[int], str]] = field(default_factory=list)
    error: Optional[str] = None
    score_mean: Optional[float] = None
    score_median: Optional[float] = None
    score_histogram: list[ScoreBin] = field(default_factory=list)
    fully_correct: int = 0
    # Surveys are graded for participation, so scores and correctness mean nothing;
    # the page shows response distributions instead.
    is_survey: bool = False
    # Submissions that answered every answerable (non text-only) question
    complete_count: int = 0
    # Runs of consecutive Likert questions sharing one scale, drawn as one chart
    likert_groups: list = field(default_factory=list)

    @property
    def student_count(self) -> int:
        return len({submission.user_id for submission in self.submissions})

    @property
    def has_scores(self) -> bool:
        return not self.is_survey and any(question.graded for question in self.questions.values())


# The user-role choices on the quiz analysis page and the quiz report form:
# (code, label, checked by default)
QUIZ_ROLE_OPTIONS = (
    ("students", "Students", True),
    ("test", "Test Student(s)", False),
    ("instructors", "Instructors", False),
    ("graders", "Graders (includes TAs and instructors)", True),
    ("anonymous", "Anonymous Users", False),
)
QUIZ_ROLE_CODES = frozenset(code for code, _, _ in QUIZ_ROLE_OPTIONS)
DEFAULT_QUIZ_ROLES = frozenset(code for code, _, checked in QUIZ_ROLE_OPTIONS if checked)
GRADER_ROLE_NAMES = frozenset(('admin', 'instructor', 'teachingassistant'))


def load_roles_by_user_course(user_ids, course_ids) -> dict:
    """ One query for every role these users hold in these courses, as
    {(user_id, course_id): {'learner', 'instructor', ...}}; replaces the
    per-submission `is_instructor`/`is_student`/`is_grader` lookups. """
    user_ids, course_ids = list(set(user_ids)), list(set(course_ids))
    if not user_ids or not course_ids:
        return {}
    roles = defaultdict(set)
    rows = (Role.query.with_entities(Role.user_id, Role.course_id, Role.name)
            .filter(Role.user_id.in_(user_ids), Role.course_id.in_(course_ids)).all())
    for user_id, course_id, name in rows:
        roles[(user_id, course_id)].add(str(name).lower())
    return dict(roles)


def select_quiz_submissions(submissions, included_roles, roles_by_user_course):
    """ Keep the submissions whose owner has one of the included roles in the
    submission's course. Anonymous and test users are dropped unless asked for;
    otherwise a submission is kept when its owner is an instructor, student, or
    grader there (whichever of those were included). Returns the kept submissions
    and a Counter of why the others were left out. """
    included_roles = set(included_roles)
    kept, excluded = [], Counter()
    for submission in submissions:
        user = submission.user
        roles = roles_by_user_course.get((submission.user_id, submission.course_id), set())
        if 'anonymous' not in included_roles and getattr(user, 'anonymous', False):
            excluded['anonymous user'] += 1
        elif 'test' not in included_roles and user.is_test_user(submission.course_id):
            excluded['test user'] += 1
        elif 'instructors' in included_roles and 'instructor' in roles:
            kept.append(submission)
        elif 'students' in included_roles and 'learner' in roles:
            kept.append(submission)
        elif 'graders' in included_roles and roles & GRADER_ROLE_NAMES:
            kept.append(submission)
        else:
            excluded['no included role in the course'] += 1
    return kept, excluded


FREE_TEXT_TYPES = ('essay_question', 'short_answer_question', 'numerical_question')
KEY_FIELDS = ('correct', 'correct_exact', 'correct_regex')
NUMBERED_OPTION = re.compile(r'^\s*\(?\d+[).]')

# Diverging steps (validated as an ordinal ramp on the light surface): red pole,
# neutral midpoint, blue pole. Arms are taken from the pole inward.
DIVERGING_LOW = ['#a12a29', '#e34948', '#ee8987']
DIVERGING_HIGH = ['#184f95', '#3987e5', '#86b6ef']
DIVERGING_MID = '#b5b4ae'
# Single-hue blue ramp for longer ordered scales, and for plain distributions
SEQUENTIAL = ['#cde2fb', '#b7d3f6', '#9ec5f4', '#86b6ef', '#6da7ec', '#5598e7', '#3987e5',
              '#2a78d6', '#256abf', '#1c5cab', '#184f95', '#104281', '#0d366b']
BAR_COLOR = '#2a78d6'
# Fills light enough for dark text; every other fill takes white text
LIGHT_FILLS = {'#ee8987', '#b5b4ae', '#86b6ef', '#cde2fb', '#b7d3f6', '#9ec5f4', '#6da7ec', '#5598e7'}


def ink_for(fill: str) -> str:
    return '#0b0b0b' if fill in LIGHT_FILLS else '#ffffff'


def diverging_palette(size: int) -> list:
    """ Colors for an ordered scale of `size` steps, low to high: a red arm, a
    gray midpoint when the count is odd, and a blue arm. Scales longer than seven
    steps fall back to a light-to-dark blue ramp. """
    if size <= 0:
        return []
    if size > 7:
        # Light to dark, starting at the lightest step that still clears the surface
        ramp = SEQUENTIAL[3:]
        return [ramp[round(index * (len(ramp) - 1) / (size - 1))] for index in range(size)]
    arms = {0: [], 1: [1], 2: [0, 2], 3: [0, 1, 2]}[size // 2]
    low = [DIVERGING_LOW[index] for index in arms]
    high = [DIVERGING_HIGH[index] for index in reversed(arms)]
    return low + ([DIVERGING_MID] if size % 2 else []) + high


def question_options(question) -> dict:
    """ The answer options an author wrote, keyed by part (None for single-part
    types): multiple choice/answers lists, matching answers per statement, and
    dropdown options per blank. """
    question_type = question.get('type')
    answers = question.get('answers')
    if question_type in ('multiple_choice_question',):
        return {None: [str(answer) for answer in answers]} if isinstance(answers, list) else {}
    if question_type == 'true_false_question':
        return {None: ['true', 'false']}
    if question_type == 'multiple_answers_question':
        return {str(answer): ['Chosen', 'Not Chosen'] for answer in answers} if isinstance(answers, list) else {}
    if question_type == 'matching_question':
        statements = question.get('statements') or []
        return {str(statement): [str(answer) for answer in answers]
                for statement in statements} if isinstance(answers, list) else {}
    if question_type in ('multiple_dropdowns_question', 'fill_in_multiple_blanks_question'):
        if isinstance(answers, dict):
            return {str(blank): [str(option) for option in options] if isinstance(options, list) else []
                    for blank, options in answers.items()}
        return {}
    return {}


def is_likert(question, options) -> bool:
    """ A single-answer question on an ordered scale: laid out horizontally by
    the author, or with numbered options like "(1) Not at all" ... "(6) Very". """
    if question.get('type') != 'multiple_choice_question':
        return False
    scale = options.get(None) or []
    if len(scale) < 3:
        return False
    return bool(question.get('horizontal')) or all(NUMBERED_OPTION.match(option) for option in scale)


def is_graded(question, check, is_survey) -> bool:
    if is_survey or question.get('type') in ('essay_question', 'text_only_question'):
        return False
    return isinstance(check, dict) and any(key in check for key in KEY_FIELDS)


def _describe_error(error: Exception) -> str:
    return f"{type(error).__name__}: {error}"


def _summarize_scores(analysis: QuizAnalysis):
    scores = [submission.score for submission in analysis.submissions]
    if not scores:
        return
    analysis.score_mean = mean(scores)
    analysis.score_median = median(scores)
    analysis.fully_correct = sum(1 for submission in analysis.submissions if submission.correct)
    counts = [0] * 10
    for score in scores:
        counts[max(0, min(int(score * 10), 9))] += 1
    analysis.score_histogram = [ScoreBin(low=index * 10, high=index * 10 + 9 if index < 9 else 100, count=count)
                                for index, count in enumerate(counts)]


def _attempt_count(submission_body, submission):
    """ The quiz's own attempt counter (saved in the answer JSON as attempt.count),
    falling back to the submission row's counter, which quizzes do not maintain. """
    attempt = submission_body.get('attempt')
    if isinstance(attempt, dict) and isinstance(attempt.get('count'), int):
        return attempt['count']
    return getattr(submission, 'attempts', None)


def _collect_parts(question, student):
    """ Break one student's answer to a question into (key, value, part) triples,
    one per option, statement, or blank, ready for `check_quiz_answer`. """
    keys, values, parts = [], [], []
    question_type = question.get('type')
    if question_type == 'multiple_answers_question':
        for potential_answer in question['answers']:
            keys.append(potential_answer)
            values.append(tuple(student))
            parts.append(potential_answer)
    elif question_type == 'matching_question':
        for index, (statement, answer) in enumerate(zip(question['statements'], student)):
            if isinstance(answer, list):
                for sub_answer in answer:
                    keys.append(statement)
                    values.append(sub_answer)
                    parts.append(index)
            else:
                keys.append(statement)
                values.append(answer)
                parts.append(index)
    elif question_type in ('multiple_dropdowns_question', 'fill_in_multiple_blanks_question'):
        for key, value in student.items():
            keys.append(key)
            values.append(value)
            parts.append(key)
    else:
        keys, values, parts = [None], [student], [None]
    return zip(keys, values, parts)


def analyze_quiz(assignment, submissions) -> QuizAnalysis:
    """ Grade every submission against the quiz's current body and checks, then
    compute item statistics per question: difficulty (mean score), discrimination
    (correlation of the question's score with the whole-quiz score), how often each
    answer was given, and a score distribution across submissions.

    A submission that cannot be graded (invalid JSON, no student answers, a crash
    in one question's check) is recorded in `skipped` and never takes the page
    down. The body and checks are parsed once, not once per submission. """
    analysis = QuizAnalysis()
    body_ready, body = try_parse_file(assignment.instructions, "Quiz Body")
    checks_ready, checks = try_parse_file(assignment.on_run, "Quiz Checks")
    if not (body_ready and checks_ready):
        analysis.error = body if not body_ready else checks
        return analysis
    if not isinstance(body, dict) or not isinstance(checks, dict):
        analysis.error = "The quiz body and checks must both be JSON objects."
        return analysis
    # Setup question information
    questions = analysis.questions
    checks_by_question = checks.get('questions', {}) or {}
    body_questions = body.get('questions', {}) or {}
    settings = body.get('settings', {}) or {}
    analysis.is_survey = str(settings.get('gradeMode', 'QUIZ')).upper() == 'SURVEY'
    markdown = Markdown(extensions=['fenced_code'])
    for question_id, question in body_questions.items():
        if not isinstance(question, dict):
            continue
        check = checks_by_question.get(question_id, {})
        options = question_options(question)
        stats = QuizQuestionStats(
            question_id=question_id,
            body=markdown.convert(question.get('body', '') or ''),
            type=question.get('type'),
            points_possible=question.get('points', 1),
            scores=[],
            parts=[]
        )
        stats.options = options
        stats.graded = is_graded(question, check, analysis.is_survey)
        stats.likert = not stats.graded and is_likert(question, options)
        questions[question_id] = stats
        markdown.reset()
    answerable = sum(1 for question in body_questions.values()
                     if isinstance(question, dict) and question.get('type') != 'text_only_question')
    # Iterate through submissions
    for submission in submissions:
        submission_id = getattr(submission, 'id', None)
        student_ready, student_body = try_parse_file(submission.code or "{}", "Student Submission")
        if not student_ready:
            analysis.skipped.append((submission_id, student_body))
            continue
        if not isinstance(student_body, dict):
            analysis.skipped.append((submission_id, "The submission is not a JSON object."))
            continue
        try:
            quiz_result = process_quiz(body, checks, student_body)
        except Exception as error:
            analysis.skipped.append((submission_id, "Could not grade: " + _describe_error(error)))
            continue
        if not quiz_result.graded_successfully:
            analysis.skipped.append((submission_id, str(quiz_result.error)))
            continue
        if 'studentAnswers' not in quiz_result.submission_body:
            analysis.skipped.append((submission_id, "Never answered (the quiz was opened but nothing was saved)."
                                     if not quiz_result.submission_body else
                                     "The submission has no student answers."))
            continue
        # Attach the scores to the question
        feedbacks = quiz_result.feedbacks
        for question_id, feedback in feedbacks.items():
            if question_id not in questions:
                # Graded against an older quiz body whose question no longer exists
                continue
            questions[question_id].scores.append(QuizQuestionAttempt(
                correct=feedback['correct'],
                score=feedback['score'],
                overall_score=quiz_result.score
            ))
        student_answers = quiz_result.submission_body['studentAnswers']
        if not isinstance(student_answers, dict):
            student_answers = {}
        answered = sum(1 for question_id, student in student_answers.items()
                       if question_id in questions and questions[question_id].type != 'text_only_question'
                       and is_answer_given(student))
        analysis.submissions.append(QuizSubmissionSummary(
            submission_id=submission_id,
            user_id=getattr(submission, 'user_id', None),
            course_id=getattr(submission, 'course_id', None),
            score=quiz_result.score,
            correct=bool(quiz_result.correct),
            answered=answered,
            attempts=_attempt_count(quiz_result.submission_body, submission),
            date_submitted=getattr(submission, 'date_submitted', None),
        ))
        if answered >= answerable:
            analysis.complete_count += 1
        for question_id, student in student_answers.items():
            question = body_questions.get(question_id, {})
            if not isinstance(question, dict) or 'type' not in question or question_id not in questions:
                continue
            stats = questions[question_id]
            if question_id in feedbacks and not is_answer_given(student):
                stats.no_answer += 1
                continue
            check = checks_by_question.get(question_id, {})
            feedback = feedbacks.get(question_id, {})
            if question.get('type') in FREE_TEXT_TYPES and not stats.graded:
                stats.responses.append(str(student))
                continue
            try:
                for key, value, part in _collect_parts(question, student):
                    correctness = (check_quiz_answer(question, feedback, value, check, True, part)
                                   if stats.graded else None)
                    stats.parts.append(QuizQuestionPart(
                        key=key,
                        value=('Chosen' if part in value else 'Not Chosen')
                            if question.get('type') == 'multiple_answers_question' else value,
                        correct=correctness
                    ))
            except Exception as error:
                # One malformed answer should not hide the rest of the analysis
                analysis.skipped.append((submission_id, f"Could not tally question {question_id}: "
                                                        + _describe_error(error)))
    # Post process for difficulty and discrimination
    for question_id, question in questions.items():
        attempts = len(question.scores)
        if question.graded and question.scores:
            question.difficulty = sum(score.score for score in question.scores) / attempts
            question.correct_rate = sum(1 for score in question.scores if score.correct) / attempts
        if question.graded and attempts >= 2:
            question.discrimination = correlation([score.overall_score for score in question.scores],
                                                  [score.score for score in question.scores])
        result = {}
        for part in question.parts:
            if part.key not in result:
                result[part.key] = {}
            if part.value not in result[part.key]:
                result[part.key][part.value] = []
            result[part.key][part.value].append(part.correct or False)
        scored = {}
        denominator = max(attempts, 1)
        for key, values in result.items():
            scored[key] = {}
            for value, corrects in values.items():
                scored[key][value] = (str(corrects[0]) if corrects else "Unknown",
                                      len(corrects),
                                      float(len(corrects)) / denominator,
                                      binconf(len(corrects), denominator)
                                      )
        question.per_part_stats = scored
        _tally_distribution(question)
    analysis.likert_groups = _group_likert(questions)
    if analysis.has_scores:
        _summarize_scores(analysis)
    return analysis


def _tally_distribution(question: QuizQuestionStats):
    """ Per part, how often each authored option was chosen (in the author's
    order, zeros kept), followed by any values that are not options at all. Likert
    questions also get their diverging colors and mean scale position. """
    counts = defaultdict(Counter)
    for part in question.parts:
        counts[part.key][str(part.value)] += 1
    parts = list(question.options) or list(counts)
    for key in counts:
        if key not in parts:
            parts.append(key)
    for key in parts:
        options = question.options.get(key, [])
        tally = counts.get(key, Counter())
        total = sum(tally.values()) or 1
        rows = [OptionCount(option, tally.get(option, 0), tally.get(option, 0) / total) for option in options]
        rows.extend(OptionCount(value, count, count / total, expected=False)
                    for value, count in tally.most_common() if value not in options)
        question.distribution[key] = rows
        if question.likert:
            colors = diverging_palette(len(options))
            question.colors[key] = colors + ['#52514e'] * (len(rows) - len(colors))
        else:
            question.colors[key] = [BAR_COLOR] * len(rows)
        question.inks[key] = [ink_for(color) for color in question.colors[key]]
    if question.likert:
        scale = question.options.get(None, [])
        positions = [(scale.index(row.label) + 1, row.count) for row in question.distribution.get(None, [])
                     if row.label in scale]
        responses = sum(count for _, count in positions)
        if responses:
            question.scale_mean = sum(position * count for position, count in positions) / responses


def _group_likert(questions) -> list:
    """ Consecutive Likert questions with the same scale, as lists of question
    ids, so the page can draw them as one chart with a shared legend. """
    groups, current, scale = [], [], None
    for question_id, question in questions.items():
        this_scale = question.options.get(None) if question.likert else None
        if this_scale is not None and this_scale == scale:
            current.append(question_id)
            continue
        if current:
            groups.append(current)
        current, scale = ([question_id], this_scale) if this_scale is not None else ([], None)
    if current:
        groups.append(current)
    return groups


def process_quizzes(assignment, submissions, directory):
    """ The background quiz report's view of `analyze_quiz`: just the per-question
    statistics, or None when the quiz body or checks are not valid JSON. """
    analysis = analyze_quiz(assignment, submissions)
    if analysis.error:
        print("Error: instructions or on_run not valid", analysis.error)
        return None
    for submission_id, reason in analysis.skipped:
        print("Error: quiz submission was not valid", submission_id, reason)
    return analysis.questions
