"""
Tests for the quiz analysis page (courses/quiz_analysis) and the pure item analysis
behind it and the background quiz report (models/data_formats/quiz_analysis.py).
"""
import json
from types import SimpleNamespace

import pytest

from models.data_formats.quiz_analysis import (analyze_quiz, process_quizzes, select_quiz_submissions,
                                               load_roles_by_user_course, DEFAULT_QUIZ_ROLES,
                                               diverging_palette, DIVERGING_MID, is_likert, question_options)
from models.enums import AssignmentTypes
from tests.factory.factories import AssignmentFactory, SubmissionFactory, UserFactory


BODY = {
    "settings": {},
    "questions": {
        "capital": {"id": "capital", "type": "multiple_choice_question", "points": 2,
                    "body": "What is the capital of **France**?",
                    "answers": ["Paris", "Lyon", "Berlin"]},
        "earth": {"id": "earth", "type": "true_false_question", "points": 1,
                  "body": "The Earth is round."},
        "primes": {"id": "primes", "type": "multiple_answers_question", "points": 3,
                   "body": "Which are prime?", "answers": ["2", "3", "4"]},
        "why": {"id": "why", "type": "essay_question", "points": 1, "body": "Explain."},
    }
}
CHECKS = {
    "questions": {
        "capital": {"correct": "Paris"},
        "earth": {"correct": True},
        "primes": {"correct": ["2", "3"]},
        "why": {},
    }
}


def fake_assignment(body=BODY, checks=CHECKS):
    return SimpleNamespace(instructions=json.dumps(body) if not isinstance(body, str) else body,
                           on_run=json.dumps(checks) if not isinstance(checks, str) else checks)


def fake_submission(answers, submission_id=None, user_id=None, course_id=8, code=None, attempts=1):
    if code is None:
        code = json.dumps({"studentAnswers": answers, "attempt": {"attempting": False, "count": attempts}})
    return SimpleNamespace(id=submission_id, user_id=user_id, course_id=course_id, code=code,
                           attempts=attempts, date_submitted=None)


PERFECT = {"capital": "Paris", "earth": "true", "primes": ["2", "3"], "why": "Because."}
HALF = {"capital": "Lyon", "earth": "true", "primes": ["2"], "why": ""}
NOTHING_RIGHT = {"capital": "Berlin", "earth": "false", "primes": ["4"], "why": ""}


class TestAnalyzeQuiz:
    def test_invalid_body_or_checks_report_an_error(self):
        analysis = analyze_quiz(fake_assignment(BODY, "{not json"), [fake_submission(PERFECT)])
        assert analysis.error and "Quiz Checks" in analysis.error
        assert analysis.questions == {} and analysis.submissions == []
        analysis = analyze_quiz(fake_assignment("{not json", CHECKS), [])
        assert analysis.error and "Quiz Body" in analysis.error
        # The background report sees None, as it always did
        assert process_quizzes(fake_assignment(BODY, "{not json"), [], None) is None
        assert process_quizzes(fake_assignment("[1, 2]", CHECKS), [], None) is None

    def test_empty_quiz(self):
        analysis = analyze_quiz(fake_assignment(), [])
        assert analysis.error is None
        assert list(analysis.questions) == ["capital", "earth", "primes", "why"]
        assert analysis.submissions == []
        assert analysis.score_mean is None and analysis.score_histogram == []
        for question in analysis.questions.values():
            assert question.difficulty is None and question.discrimination is None
            assert question.per_part_stats == {}

    def test_scores_and_item_statistics(self):
        submissions = [fake_submission(PERFECT, 1, 10), fake_submission(HALF, 2, 11),
                       fake_submission(NOTHING_RIGHT, 3, 12), fake_submission(PERFECT, 4, 10)]
        analysis = analyze_quiz(fake_assignment(), submissions)
        assert analysis.error is None
        assert len(analysis.submissions) == 4
        assert analysis.student_count == 3
        assert [summary.attempts for summary in analysis.submissions] == [1, 1, 1, 1]
        assert analysis.fully_correct == 2
        scores = {summary.submission_id: summary.score for summary in analysis.submissions}
        # 7 points possible: PERFECT 7/7; HALF: earth 1 + primes 2/3*3=2 + why 1 = 4/7;
        # NOTHING_RIGHT: primes 0/3 (2 and 3 missed, 4 wrong), why 1 = 1/7
        assert scores[1] == pytest.approx(1.0)
        assert scores[2] == pytest.approx(4 / 7)
        assert scores[3] == pytest.approx(1 / 7)
        assert analysis.score_mean == pytest.approx((1 + 4 / 7 + 1 / 7 + 1) / 4)
        assert analysis.score_median == pytest.approx((1 + 4 / 7) / 2)
        histogram = {bin.label: bin.count for bin in analysis.score_histogram}
        assert histogram["90-100%"] == 2 and histogram["50-59%"] == 1 and histogram["10-19%"] == 1
        assert sum(histogram.values()) == 4
        # Difficulty is the mean score on the question
        capital = analysis.questions["capital"]
        assert capital.difficulty == pytest.approx(0.5)
        assert capital.correct_rate == pytest.approx(0.5)
        assert len(capital.scores) == 4
        # Everyone who got the capital right also did best overall
        assert capital.discrimination > 0.9
        # Essays have no key: they are collected, not graded
        why = analysis.questions["why"]
        assert not why.graded
        assert why.difficulty is None and why.discrimination is None
        # Blank essays count as unanswered rather than as empty responses
        assert why.responses == ["Because.", "Because."]
        assert why.no_answer == 2 and why.responded == 2
        assert why.response_counts == [("Because.", 2)]
        assert capital.graded and analysis.has_scores

    def test_single_part_answer_tallies(self):
        submissions = [fake_submission(PERFECT), fake_submission(HALF), fake_submission(NOTHING_RIGHT)]
        analysis = analyze_quiz(fake_assignment(), submissions)
        capital = analysis.questions["capital"]
        assert capital.single_part
        tallies = capital.per_part_stats[None]
        assert tallies["Paris"][:3] == ("True", 1, pytest.approx(1 / 3))
        assert tallies["Lyon"][:3] == ("False", 1, pytest.approx(1 / 3))
        assert tallies["Berlin"][:3] == ("False", 1, pytest.approx(1 / 3))
        low, high = tallies["Paris"][3]
        assert 0 <= low < 1 / 3 < high <= 1
        earth = analysis.questions["earth"].per_part_stats[None]
        assert earth["true"][:2] == ("True", 2) and earth["false"][:2] == ("False", 1)

    def test_multiple_answers_are_tallied_per_option(self):
        submissions = [fake_submission(PERFECT), fake_submission(HALF), fake_submission(NOTHING_RIGHT)]
        analysis = analyze_quiz(fake_assignment(), submissions)
        primes = analysis.questions["primes"]
        assert not primes.single_part
        assert list(primes.per_part_stats) == ["2", "3", "4"]
        # Choosing 2 is right (twice), not choosing it is wrong (once)
        assert primes.per_part_stats["2"]["Chosen"][:2] == ("True", 2)
        assert primes.per_part_stats["2"]["Not Chosen"][:2] == ("False", 1)
        # 4 is a distractor: not choosing it is right
        assert primes.per_part_stats["4"]["Not Chosen"][:2] == ("True", 2)
        assert primes.per_part_stats["4"]["Chosen"][:2] == ("False", 1)

    def test_ungradable_submissions_are_skipped_with_a_reason(self):
        submissions = [fake_submission(PERFECT, 1),
                       fake_submission(None, 2, code=""),
                       fake_submission(None, 3, code="{}"),
                       fake_submission(None, 4, code="{not json"),
                       fake_submission(None, 5, code="[1, 2, 3]"),
                       fake_submission(None, 6, code=json.dumps({"attempt": {"count": 1}}))]
        analysis = analyze_quiz(fake_assignment(), submissions)
        assert len(analysis.submissions) == 1
        skipped = dict(analysis.skipped)
        assert set(skipped) == {2, 3, 4, 5, 6}
        assert skipped[2].startswith("Never answered")
        assert skipped[3].startswith("Never answered")
        assert "Student Submission" in skipped[4]
        assert "not a JSON object" in skipped[5]
        assert skipped[6] == "The submission has no student answers."
        # Only the graded submission counts toward the statistics
        assert analysis.questions["capital"].difficulty == pytest.approx(1.0)

    def test_answers_to_removed_questions_are_ignored(self):
        """ A submission saved against an older body that named a question the quiz no
            longer has must neither crash nor add a phantom question. """
        answers = dict(PERFECT, old_question="whatever")
        analysis = analyze_quiz(fake_assignment(), [fake_submission(answers, 1)])
        assert list(analysis.questions) == ["capital", "earth", "primes", "why"]
        assert len(analysis.submissions) == 1
        assert analysis.skipped == []

    def test_a_crash_in_one_question_does_not_hide_the_rest(self):
        # true/false answers must be strings; a number would crash the checker
        broken = dict(PERFECT, earth=7)
        analysis = analyze_quiz(fake_assignment(), [fake_submission(PERFECT, 1), fake_submission(broken, 2)])
        assert len(analysis.submissions) == 1
        assert [submission_id for submission_id, _ in analysis.skipped] == [2]
        assert "Could not grade" in analysis.skipped[0][1]
        assert analysis.questions["capital"].per_part_stats[None]["Paris"][1] == 1

    def test_process_quizzes_returns_the_questions(self):
        questions = process_quizzes(fake_assignment(), [fake_submission(PERFECT)], None)
        assert list(questions) == ["capital", "earth", "primes", "why"]
        assert questions["capital"].points == 2


SCALE = ["(1) Not at all confident", "(2)", "(3)", "(4)", "(5)", "(6) Very confident"]
SURVEY_BODY = {
    "settings": {"gradeMode": "SURVEY", "feedbackType": "NONE"},
    "questions": {
        "intro": {"id": "intro", "type": "text_only_question", "points": 0, "body": "Tell us how you feel."},
        "conf1": {"id": "conf1", "type": "multiple_choice_question", "points": 0, "horizontal": True,
                  "body": "How confident are you that you will *succeed*?", "answers": SCALE},
        "conf2": {"id": "conf2", "type": "multiple_choice_question", "points": 0, "horizontal": True,
                  "body": "How confident are you in your **programming**?", "answers": SCALE},
        "grade": {"id": "grade", "type": "multiple_choice_question", "points": 0,
                  "body": "What grade do you expect?", "answers": ["A", "B", "C", "D", "F"]},
        "fun": {"id": "fun", "type": "multiple_choice_question", "points": 0,
                "body": "Is it fun?", "answers": ["(1) No", "(2) Somewhat", "(3) Yes"]},
        "langs": {"id": "langs", "type": "multiple_answers_question", "points": 0,
                  "body": "Which languages have you used?", "answers": ["Python", "Java", "Scratch"]},
        "why": {"id": "why", "type": "essay_question", "points": 0, "body": "Why did you enroll?"},
        "word": {"id": "word", "type": "short_answer_question", "points": 0, "body": "One word for CS:"},
    }
}
# A Canvas-style export keeps keys around; survey grading must ignore them
SURVEY_CHECKS = {"questions": {"conf1": {"correct": ["(6) Very confident"]}, "conf2": {"correct": ["(6) Very confident"]},
                               "grade": {"correct": ["A"]}, "fun": {}, "langs": {"correct": ["Python"]},
                               "why": {}, "word": {}}}


def survey_answers(conf1, conf2, grade, fun, langs, why, word):
    return {"intro": "", "conf1": conf1, "conf2": conf2, "grade": grade, "fun": fun, "langs": langs,
            "why": why, "word": word}


SURVEY_RESPONSES = [
    survey_answers(SCALE[5], SCALE[4], "A", "(3) Yes", ["Python", "Scratch"], "I like computers.", "fun"),
    survey_answers(SCALE[3], SCALE[3], "B", "(2) Somewhat", ["Python"], "Required.", "hard"),
    survey_answers(SCALE[0], SCALE[1], "C", "(1) No", [], "Required.", "hard"),
    survey_answers(SCALE[5], SCALE[5], "A", "(3) Yes", ["Java", "Python"], "", "Fun"),
]


class TestSurveyAnalysis:
    def test_survey_mode_tallies_instead_of_grading(self):
        submissions = [fake_submission(answers, index + 1, index + 10)
                       for index, answers in enumerate(SURVEY_RESPONSES)]
        analysis = analyze_quiz(fake_assignment(SURVEY_BODY, SURVEY_CHECKS), submissions)
        assert analysis.error is None
        assert analysis.is_survey and not analysis.has_scores
        assert len(analysis.submissions) == 4
        # Scores are participation only, so no score summary is produced
        assert analysis.score_mean is None and analysis.score_histogram == []
        for question in analysis.questions.values():
            assert not question.graded
            assert question.difficulty is None and question.discrimination is None
        # Answered counts non-blank answers to the seven answerable questions
        assert [summary.answered for summary in analysis.submissions] == [7, 7, 6, 6]
        assert analysis.complete_count == 2

    def test_likert_detection_and_scale_means(self):
        submissions = [fake_submission(answers) for answers in SURVEY_RESPONSES]
        analysis = analyze_quiz(fake_assignment(SURVEY_BODY, SURVEY_CHECKS), submissions)
        conf1, grade, fun = analysis.questions["conf1"], analysis.questions["grade"], analysis.questions["fun"]
        assert conf1.likert and fun.likert and not grade.likert
        assert conf1.scale_size == 6
        # Positions 6, 4, 1, 6 -> mean 4.25
        assert conf1.scale_mean == pytest.approx(4.25)
        assert analysis.questions["conf2"].scale_mean == pytest.approx((5 + 4 + 2 + 6) / 4)
        assert fun.scale_mean == pytest.approx((3 + 2 + 1 + 3) / 4)
        # Distribution keeps the author's order and the zero-count options
        rows = conf1.distribution[None]
        assert [row.label for row in rows] == SCALE
        assert [row.count for row in rows] == [1, 0, 0, 1, 0, 2]
        assert rows[5].share == pytest.approx(0.5)
        assert conf1.colors[None] == diverging_palette(6)
        assert len(conf1.inks[None]) == 6
        # Consecutive questions on the same scale are grouped; "fun" has its own scale
        assert analysis.likert_groups == [["conf1", "conf2"], ["fun"]]

    def test_unordered_choice_and_multiple_answers_distributions(self):
        submissions = [fake_submission(answers) for answers in SURVEY_RESPONSES]
        analysis = analyze_quiz(fake_assignment(SURVEY_BODY, SURVEY_CHECKS), submissions)
        grade = analysis.questions["grade"].distribution[None]
        assert [(row.label, row.count) for row in grade] == [("A", 2), ("B", 1), ("C", 1), ("D", 0), ("F", 0)]
        langs = analysis.questions["langs"].distribution
        assert list(langs) == ["Python", "Java", "Scratch"]
        # The third response chose nothing, which counts as no answer rather than "Not Chosen"
        assert [(row.label, row.count) for row in langs["Python"]] == [("Chosen", 3), ("Not Chosen", 0)]
        assert [(row.label, row.count) for row in langs["Java"]] == [("Chosen", 1), ("Not Chosen", 2)]
        assert analysis.questions["langs"].no_answer == 1
        chosen = analysis.questions["langs"].chosen_distribution
        assert [(row.label, row.count) for row in chosen] == [("Python", 3), ("Java", 1), ("Scratch", 1)]
        assert chosen[0].share == pytest.approx(1.0)

    def test_free_text_responses_are_collected(self):
        submissions = [fake_submission(answers) for answers in SURVEY_RESPONSES]
        analysis = analyze_quiz(fake_assignment(SURVEY_BODY, SURVEY_CHECKS), submissions)
        why, word = analysis.questions["why"], analysis.questions["word"]
        assert why.response_counts == [("Required.", 2), ("I like computers.", 1)]
        assert why.responded == 3 and why.no_answer == 1
        assert word.response_counts == [("hard", 2), ("fun", 1), ("Fun", 1)]
        assert word.parts == [] and word.distribution == {}

    def test_unexpected_values_are_listed_last(self):
        answers = dict(SURVEY_RESPONSES[0], grade="Z")
        analysis = analyze_quiz(fake_assignment(SURVEY_BODY, SURVEY_CHECKS), [fake_submission(answers)])
        rows = analysis.questions["grade"].distribution[None]
        assert rows[-1].label == "Z" and not rows[-1].expected and rows[-1].count == 1
        assert all(row.expected for row in rows[:-1])

    def test_blank_answers_count_as_no_answer_not_as_options(self):
        blank = survey_answers("", "", "", "", [], "", "")
        analysis = analyze_quiz(fake_assignment(SURVEY_BODY, SURVEY_CHECKS),
                                [fake_submission(blank, 1), fake_submission(SURVEY_RESPONSES[0], 2)])
        conf1 = analysis.questions["conf1"]
        assert conf1.responded == 1 and conf1.no_answer == 1
        assert sum(row.count for row in conf1.distribution[None]) == 1
        assert analysis.submissions[0].answered == 0
        assert analysis.complete_count == 1

    def test_quiz_question_without_a_key_is_tallied_not_scored(self):
        """ A quiz (not a survey) can hold an opinion question with no answer key;
            it gets a distribution and no difficulty, while the keyed ones are scored. """
        body = {"settings": {}, "questions": dict(BODY["questions"],
                                                  mood={"id": "mood", "type": "multiple_choice_question", "points": 0,
                                                        "body": "How was it?", "answers": ["Easy", "OK", "Hard"]})}
        checks = {"questions": dict(CHECKS["questions"], mood={})}
        submissions = [fake_submission(dict(PERFECT, mood="Easy"), 1), fake_submission(dict(HALF, mood="Hard"), 2)]
        analysis = analyze_quiz(fake_assignment(body, checks), submissions)
        assert not analysis.is_survey and analysis.has_scores
        mood = analysis.questions["mood"]
        assert not mood.graded and not mood.likert
        assert mood.difficulty is None and mood.discrimination is None
        assert [(row.label, row.count) for row in mood.distribution[None]] == [("Easy", 1), ("OK", 0), ("Hard", 1)]
        assert analysis.questions["capital"].graded
        assert analysis.questions["capital"].difficulty == pytest.approx(0.5)
        assert analysis.likert_groups == []

    def test_palette_and_detection_helpers(self):
        assert diverging_palette(0) == []
        assert diverging_palette(1) == [DIVERGING_MID]
        assert diverging_palette(2) == ['#e34948', '#3987e5']
        assert diverging_palette(5)[2] == DIVERGING_MID and len(diverging_palette(5)) == 5
        assert DIVERGING_MID not in diverging_palette(6) and len(diverging_palette(6)) == 6
        assert len(diverging_palette(7)) == 7
        long = diverging_palette(10)
        assert len(long) == 10 and len(set(long)) == 10 and DIVERGING_MID not in long
        numbered = {"type": "multiple_choice_question", "answers": ["1. Never", "2. Sometimes", "3. Always"]}
        assert is_likert(numbered, question_options(numbered))
        flagged = {"type": "multiple_choice_question", "horizontal": True, "answers": ["Low", "Mid", "High"]}
        assert is_likert(flagged, question_options(flagged))
        plain = {"type": "multiple_choice_question", "answers": ["Cats", "Dogs", "Fish"]}
        assert not is_likert(plain, question_options(plain))
        short = {"type": "multiple_choice_question", "horizontal": True, "answers": ["Yes", "No"]}
        assert not is_likert(short, question_options(short))
        assert question_options({"type": "true_false_question"}) == {None: ["true", "false"]}
        assert question_options({"type": "multiple_dropdowns_question",
                                 "answers": {"a": ["x", "y"], "b": "bad"}}) == {"a": ["x", "y"], "b": []}
        assert question_options({"type": "essay_question"}) == {}


def fake_user(anonymous=False, test=False):
    return SimpleNamespace(anonymous=anonymous, is_test_user=lambda course_id=None: test)


def owned(user, user_id, course_id=8):
    return SimpleNamespace(user=user, user_id=user_id, course_id=course_id)


class TestSelectQuizSubmissions:
    ROLES = {(1, 8): {"learner"}, (2, 8): {"instructor"}, (3, 8): {"teachingassistant"},
             (4, 8): {"learner"}, (5, 8): {"learner"}, (1, 9): {"instructor"}}

    def submissions(self):
        return [owned(fake_user(), 1),                      # student
                owned(fake_user(), 2),                      # instructor
                owned(fake_user(), 3),                      # TA
                owned(fake_user(anonymous=True), 4),        # anonymous learner
                owned(fake_user(test=True), 5),             # test student
                owned(fake_user(), 6),                      # no role in the course
                owned(fake_user(), 1, course_id=9)]         # instructor elsewhere

    def test_defaults_keep_students_and_graders(self):
        kept, excluded = select_quiz_submissions(self.submissions(), DEFAULT_QUIZ_ROLES, self.ROLES)
        assert [(s.user_id, s.course_id) for s in kept] == [(1, 8), (2, 8), (3, 8), (1, 9)]
        assert excluded == {"anonymous user": 1, "test user": 1, "no included role in the course": 1}

    def test_students_only(self):
        kept, excluded = select_quiz_submissions(self.submissions(), {"students"}, self.ROLES)
        assert [s.user_id for s in kept] == [1]
        assert excluded["no included role in the course"] == 4

    def test_instructors_without_graders_leaves_out_tas(self):
        kept, _ = select_quiz_submissions(self.submissions(), {"instructors"}, self.ROLES)
        assert [(s.user_id, s.course_id) for s in kept] == [(2, 8), (1, 9)]

    def test_anonymous_and_test_users_still_need_a_role(self):
        kept, excluded = select_quiz_submissions(self.submissions(), {"students", "anonymous", "test"}, self.ROLES)
        assert [s.user_id for s in kept] == [1, 4, 5]
        assert excluded == {"no included role in the course": 4}

    def test_nothing_included(self):
        kept, excluded = select_quiz_submissions(self.submissions(), set(), self.ROLES)
        assert kept == []
        assert sum(excluded.values()) == 7


@pytest.fixture
def quiz(client, test_data):
    """ A quiz in course 8 with submissions from Rimuru and Benimaru (learners) and
        Ada (the instructor), plus one that was opened and never answered. """
    course = test_data.courses.by(id=8)
    ada = test_data.user("ada@blockpy.com")
    rimuru = test_data.user("rimuru@blockpy.com")
    benimaru = test_data.user("benimaru@blockpy.com")
    assignment = AssignmentFactory.create_assignment(name="Capitals Quiz", course=course, owner=ada,
                                                     assignment_type=AssignmentTypes.QUIZ,
                                                     instructions=json.dumps(BODY), on_run=json.dumps(CHECKS))
    submissions = {
        "rimuru": SubmissionFactory.create_submission(assignment=assignment, user=rimuru, course=course,
                                                      code=json.dumps({"studentAnswers": PERFECT, "attempt": {"count": 1}})),
        "benimaru": SubmissionFactory.create_submission(assignment=assignment, user=benimaru, course=course,
                                                        code=json.dumps({"studentAnswers": HALF, "attempt": {"count": 2}})),
        "ada": SubmissionFactory.create_submission(assignment=assignment, user=ada, course=course,
                                                   code=json.dumps({"studentAnswers": NOTHING_RIGHT})),
    }
    return dict(course=course, assignment=assignment, ada=ada, rimuru=rimuru, benimaru=benimaru,
                submissions=submissions)


@pytest.fixture
def survey(client, test_data):
    """ A survey in course 8 answered by Rimuru and Benimaru. """
    course = test_data.courses.by(id=8)
    ada = test_data.user("ada@blockpy.com")
    assignment = AssignmentFactory.create_assignment(name="Start of Course Survey", course=course, owner=ada,
                                                     assignment_type=AssignmentTypes.QUIZ,
                                                     instructions=json.dumps(SURVEY_BODY),
                                                     on_run=json.dumps(SURVEY_CHECKS))
    for email, answers in (("rimuru@blockpy.com", SURVEY_RESPONSES[0]), ("benimaru@blockpy.com", SURVEY_RESPONSES[2])):
        SubmissionFactory.create_submission(assignment=assignment, user=test_data.user(email), course=course,
                                            code=json.dumps({"studentAnswers": answers, "attempt": {"count": 1}}))
    return dict(course=course, assignment=assignment, ada=ada)


class TestLoadRoles:
    def test_roles_are_batched_by_user_and_course(self, quiz):
        roles = load_roles_by_user_course([quiz['ada'].id, quiz['rimuru'].id], [8])
        assert roles[(quiz['ada'].id, 8)] == {"instructor"}
        assert roles[(quiz['rimuru'].id, 8)] == {"learner"}
        assert load_roles_by_user_course([], [8]) == {}
        assert load_roles_by_user_course([quiz['ada'].id], []) == {}


class TestQuizAnalysisPage:
    def url(self, quiz):
        return f"/courses/quiz_analysis/{quiz['course'].id}"

    def test_anonymous_cannot_view(self, client, quiz):
        response = client.get(self.url(quiz), query_string={"assignment_id": quiz['assignment'].id})
        assert response.get_json()['success'] is False

    def test_student_cannot_view(self, client, quiz, act_as):
        act_as(quiz['rimuru'])
        response = client.get(self.url(quiz), query_string={"assignment_id": quiz['assignment'].id})
        assert response.get_json()['success'] is False

    def test_quiz_list_without_an_assignment(self, client, quiz, act_as):
        act_as(quiz['ada'])
        response = client.get(self.url(quiz))
        assert response.status_code == 200
        page = response.data.decode("utf8")
        assert "Quiz Analysis" in page
        assert "Capitals Quiz" in page
        assert f"assignment_id={quiz['assignment'].id}" in page
        assert "Score distribution" not in page

    def test_default_analysis_includes_students_and_graders(self, client, quiz, act_as):
        act_as(quiz['ada'])
        response = client.get(self.url(quiz), query_string={"assignment_id": quiz['assignment'].id})
        assert response.status_code == 200
        page = response.data.decode("utf8")
        assert "Capitals Quiz" in page
        assert "Analyzed 3 of 3 loaded submissions" in page
        assert "Score distribution" in page
        assert "capital" in page and "primes" in page
        # The question body is rendered from Markdown
        assert "<strong>France</strong>" in page
        # Per-student table with the view links
        assert "Rimuru" in page and "Benimaru" in page
        assert f"submission_id={quiz['submissions']['rimuru'].id}" in page
        # Attempts come from the quiz's own counter in the answer JSON (Benimaru took two;
        # Ada's answers have none, so the row's counter of 0 shows instead)
        students_table = page.split("<details")[-1].split("</details>")[0]
        rows = {row.split("@blockpy.com")[0].rsplit("(", 1)[-1]: row for row in students_table.split("<tr>")[2:]}
        assert '<td class="text-right">2</td>' in rows["benimaru"]
        assert '<td class="text-right">1</td>' in rows["rimuru"]
        assert "computed in" in page
        # The essay is collected, and flagged as ungraded in the overview
        assert "Because." in page
        assert "ungraded" in page

    def test_roles_filter_students_only(self, client, quiz, act_as):
        act_as(quiz['ada'])
        response = client.get(self.url(quiz), query_string={"assignment_id": quiz['assignment'].id,
                                                           "roles_set": "1", "roles": ["students"]})
        assert response.status_code == 200
        page = response.data.decode("utf8")
        assert "Analyzed 2 of 3 loaded submissions" in page
        assert "1 no included role in the course" in page
        assert "2 graded submissions" in page
        # The instructor's submission is not in the per-student table
        students_table = page.split("<details")[-1].split("</details>")[0]
        assert "rimuru@blockpy.com" in students_table and "ada@blockpy.com" not in students_table

    def test_no_roles_at_all(self, client, quiz, act_as):
        act_as(quiz['ada'])
        response = client.get(self.url(quiz), query_string={"assignment_id": quiz['assignment'].id,
                                                           "roles_set": "1"})
        assert response.status_code == 200
        page = response.data.decode("utf8")
        assert "Analyzed 0 of 3 loaded submissions" in page
        assert '<div class="stat-value">0</div>' in page
        assert "Score distribution" not in page

    def test_unknown_role_or_course_is_refused(self, client, quiz, act_as):
        act_as(quiz['ada'])
        response = client.get(self.url(quiz), query_string={"assignment_id": quiz['assignment'].id,
                                                           "roles_set": "1", "roles": ["aliens"]})
        assert response.get_json()['success'] is False
        response = client.get(self.url(quiz), query_string={"assignment_id": quiz['assignment'].id,
                                                           "course_ids": ["999999"]})
        assert response.get_json()['success'] is False

    def test_assignment_must_be_a_quiz_with_submissions_here(self, client, quiz, act_as, test_data):
        act_as(quiz['ada'])
        response = client.get(self.url(quiz), query_string={"assignment_id": 999999})
        assert response.get_json()['success'] is False
        # A quiz without submissions is not offered either
        empty = AssignmentFactory.create_assignment(name="Empty Quiz", course=quiz['course'], owner=quiz['ada'],
                                                    assignment_type=AssignmentTypes.QUIZ,
                                                    instructions=json.dumps(BODY), on_run=json.dumps(CHECKS))
        response = client.get(self.url(quiz), query_string={"assignment_id": empty.id})
        assert response.get_json()['success'] is False

    def test_never_answered_submission_is_listed_not_graded(self, client, quiz, act_as, test_data):
        act_as(quiz['ada'])
        # Another learner who opened the quiz and never answered
        student = UserFactory.create_student(course=quiz['course'])
        SubmissionFactory.create_submission(assignment=quiz['assignment'], user=student, course=quiz['course'],
                                            code="")
        response = client.get(self.url(quiz), query_string={"assignment_id": quiz['assignment'].id})
        page = response.data.decode("utf8")
        assert "Analyzed 4 of 4 loaded submissions" in page
        assert "3 graded submissions" in page
        assert "Never answered" in page

    def test_invalid_quiz_json_shows_an_error(self, client, quiz, act_as):
        act_as(quiz['ada'])
        quiz['assignment'].on_run = "{not json"
        from models import db
        db.session.commit()
        response = client.get(self.url(quiz), query_string={"assignment_id": quiz['assignment'].id})
        assert response.status_code == 200
        assert b"could not be analyzed" in response.data


class TestSurveyPage:
    def test_survey_page_shows_distributions_not_scores(self, client, survey, act_as):
        act_as(survey['ada'])
        response = client.get(f"/courses/quiz_analysis/{survey['course'].id}",
                              query_string={"assignment_id": survey['assignment'].id})
        assert response.status_code == 200
        page = response.data.decode("utf8")
        assert "Survey" in page
        assert "Score distribution" not in page
        assert "Discrimination" not in page
        assert "answered everything" in page
        # The two confidence questions share one scale and one chart, with a legend and table view
        assert "2 questions on one scale" in page
        assert "(6) Very confident" in page
        assert 'class="likert-bar"' in page
        assert "Table view" in page
        # Unordered choices get a plain distribution, in the author's order, zeros included
        assert "<code>D</code>" in page and "<code>F</code>" in page
        # Free text is listed
        assert "I like computers." in page
        # Respondents, not students, and no score column
        assert "Respondents" in page
        respondents_header = page.split("Respondents</h3>")[1].split("</thead>")[0]
        assert "Score" not in respondents_header
        assert "Mean position" in page
