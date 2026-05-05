"""
Tests for the quiz grading system in models/data_formats/quizzes.py.
Covers all question types, partial credit, error handling, and edge cases.
"""
import json
import pytest

from models.data_formats.quizzes import (
    process_quiz,
    process_quiz_str,
    check_quiz_question,
    QuizResult,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def make_quiz(questions: dict, settings: dict = None) -> dict:
    return {"questions": questions, "settings": settings or {}}


def make_checks(questions: dict) -> dict:
    return {"questions": questions}


def grade(body_questions: dict, check_questions: dict, student_answers: dict,
          settings: dict = None) -> QuizResult:
    body = make_quiz(body_questions, settings)
    checks = make_checks(check_questions)
    submission = {"studentAnswers": student_answers}
    return process_quiz(body, checks, submission)


# ---------------------------------------------------------------------------
# process_quiz_str helpers
# ---------------------------------------------------------------------------

class TestProcessQuizStr:
    def test_returns_error_on_bad_body_json(self):
        result = process_quiz_str("not json", "{}", "{}")
        assert result.graded_successfully is False
        assert "Quiz Body" in result.error

    def test_returns_error_on_bad_checks_json(self):
        result = process_quiz_str("{}", "not json", "{}")
        assert result.graded_successfully is False
        assert "Quiz Checks" in result.error

    def test_returns_error_on_bad_submission_json(self):
        result = process_quiz_str("{}", "{}", "not json")
        assert result.graded_successfully is False
        assert "Student Submission" in result.error

    def test_empty_submission_is_ok(self):
        body = json.dumps({"questions": {}})
        checks = json.dumps({"questions": {}})
        result = process_quiz_str(body, checks, None)
        assert result.graded_successfully is True

    def test_valid_inputs_produce_result(self):
        body = json.dumps({"questions": {
            "q1": {"type": "true_false_question", "points": 1}
        }})
        checks = json.dumps({"questions": {
            "q1": {"correct": True}
        }})
        submission = json.dumps({"studentAnswers": {"q1": "true"}})
        result = process_quiz_str(body, checks, submission)
        assert result.graded_successfully is True


# ---------------------------------------------------------------------------
# process_quiz — missing / skipped answers
# ---------------------------------------------------------------------------

class TestProcessQuizMissingAnswers:
    def test_missing_answer_skipped(self):
        """Questions with no student answer are skipped (not penalised)."""
        body_q = {"q1": {"type": "true_false_question", "points": 1}}
        check_q = {"q1": {"correct": True}}
        result = grade(body_q, check_q, {})
        # No questions checked → correct = False
        assert result.graded_successfully is True
        assert result.correct is False
        assert result.score == 0

    def test_zero_points_possible_gives_zero_score(self):
        """If no questions are answered the score should be 0."""
        body_q = {"q1": {"type": "true_false_question", "points": 1}}
        check_q = {"q1": {"correct": True}}
        result = grade(body_q, check_q, {})
        assert result.score == 0

    def test_unknown_type_gives_error_feedback(self):
        body_q = {"q1": {"type": "totally_unknown_type", "points": 1}}
        check_q = {"q1": {}}
        result = grade(body_q, check_q, {"q1": "answer"})
        assert result.feedbacks["q1"]["status"] == "error"


# ---------------------------------------------------------------------------
# true_false_question
# ---------------------------------------------------------------------------

class TestTrueFalseQuestion:
    Q = {"q1": {"type": "true_false_question", "points": 1}}
    C_TRUE = {"q1": {"correct": True, "wrong": "Nope!"}}
    C_FALSE = {"q1": {"correct": False, "wrong": "Nope!"}}

    def test_correct_true(self):
        result = grade(self.Q, self.C_TRUE, {"q1": "true"})
        assert result.feedbacks["q1"]["correct"] is True
        assert result.score == 1.0

    def test_correct_false(self):
        result = grade(self.Q, self.C_FALSE, {"q1": "false"})
        assert result.feedbacks["q1"]["correct"] is True

    def test_incorrect_true(self):
        result = grade(self.Q, self.C_TRUE, {"q1": "false"})
        assert result.feedbacks["q1"]["correct"] is False
        assert result.feedbacks["q1"]["message"] == "Nope!"
        assert result.score == 0.0

    def test_case_insensitive(self):
        result = grade(self.Q, self.C_TRUE, {"q1": "True"})
        assert result.feedbacks["q1"]["correct"] is True

    def test_missing_wrong_key(self):
        checks = {"q1": {"correct": True}}
        result = grade(self.Q, checks, {"q1": "false"})
        assert result.feedbacks["q1"]["correct"] is False

    def test_tags_on_wrong(self):
        body_q = {"q1": {"type": "true_false_question", "points": 1,
                          "tags": ["concept-A"]}}
        result = grade(body_q, self.C_TRUE, {"q1": "false"})
        assert result.feedbacks["q1"]["tags"] == ["concept-A"]

    def test_no_tags_on_correct(self):
        body_q = {"q1": {"type": "true_false_question", "points": 1,
                          "tags": ["concept-A"]}}
        result = grade(body_q, self.C_TRUE, {"q1": "true"})
        assert result.feedbacks["q1"]["tags"] == []


# ---------------------------------------------------------------------------
# multiple_choice_question
# ---------------------------------------------------------------------------

class TestMultipleChoiceQuestion:
    Q = {"q1": {"type": "multiple_choice_question", "points": 2,
                "answers": ["A", "B", "C"]}}
    C = {"q1": {"correct": "B", "feedback": {"A": "Not A", "C": "Not C"}}}

    def test_correct_answer(self):
        result = grade(self.Q, self.C, {"q1": "B"})
        assert result.feedbacks["q1"]["correct"] is True
        assert result.score == 1.0

    def test_wrong_answer_with_specific_feedback(self):
        result = grade(self.Q, self.C, {"q1": "A"})
        assert result.feedbacks["q1"]["correct"] is False
        assert result.feedbacks["q1"]["message"] == "Not A"

    def test_wrong_answer_no_specific_feedback(self):
        c = {"q1": {"correct": "B"}}
        result = grade(self.Q, c, {"q1": "A"})
        assert result.feedbacks["q1"]["correct"] is False
        assert result.feedbacks["q1"]["message"] == "Incorrect"

    def test_list_of_correct_answers(self):
        c = {"q1": {"correct": ["A", "B"]}}
        result = grade(self.Q, c, {"q1": "A"})
        assert result.feedbacks["q1"]["correct"] is True

    def test_list_of_correct_answers_wrong(self):
        c = {"q1": {"correct": ["A", "B"]}}
        result = grade(self.Q, c, {"q1": "C"})
        assert result.feedbacks["q1"]["correct"] is False


# ---------------------------------------------------------------------------
# multiple_answers_question
# ---------------------------------------------------------------------------

class TestMultipleAnswersQuestion:
    Q = {"q1": {"type": "multiple_answers_question", "points": 2,
                "answers": ["A", "B", "C", "D"]}}
    C = {"q1": {"correct": ["A", "C"], "wrong_any": "Wrong answer"}}

    def test_all_correct(self):
        result = grade(self.Q, self.C, {"q1": ["A", "C"]})
        assert result.feedbacks["q1"]["correct"] is True
        assert result.score == 1.0

    def test_all_wrong(self):
        result = grade(self.Q, self.C, {"q1": ["B", "D"]})
        assert result.feedbacks["q1"]["correct"] is False

    def test_partial_credit(self):
        # Select A (correct) + B (wrong) + C (correct) — missing D (correct to omit)
        # answers: A(correct+selected)=T, B(correct to omit+selected)=F,
        #          C(correct+selected)=T, D(correct to omit+unselected)=T → 3/4
        result = grade(self.Q, self.C, {"q1": ["A", "B", "C"]})
        assert result.feedbacks["q1"]["correct"] is False
        assert result.feedbacks["q1"]["score"] == pytest.approx(3 / 4)

    def test_empty_selection(self):
        result = grade(self.Q, self.C, {"q1": []})
        assert result.feedbacks["q1"]["correct"] is False

    def test_wrong_feedback_list(self):
        c = {"q1": {"correct": ["A", "C"],
                    "wrong": ["", "You picked B", ""],  # index matches answers
                    "wrong_any": "Something wrong"}}
        result = grade(self.Q, c, {"q1": ["B"]})
        # B is wrong to pick → "You picked B" feedback
        assert "You picked B" in result.feedbacks["q1"]["message"]

    def test_wrong_any_fallback(self):
        result = grade(self.Q, self.C, {"q1": ["B"]})
        assert result.feedbacks["q1"]["message"] == "Wrong answer"

    def test_correct_marks_as_correct(self):
        result = grade(self.Q, self.C, {"q1": ["A", "C"]})
        assert result.feedbacks["q1"]["message"] == "Correct"


# ---------------------------------------------------------------------------
# matching_question
# ---------------------------------------------------------------------------

class TestMatchingQuestion:
    Q = {"q1": {"type": "matching_question", "points": 3,
                "statements": ["S1", "S2", "S3"],
                "answers": ["X", "Y", "Z"]}}
    C = {"q1": {"correct": ["X", "Y", "Z"]}}

    def test_all_correct(self):
        result = grade(self.Q, self.C, {"q1": ["X", "Y", "Z"]})
        assert result.feedbacks["q1"]["correct"] is True
        assert result.score == 1.0

    def test_all_wrong(self):
        result = grade(self.Q, self.C, {"q1": ["Z", "X", "Y"]})
        assert result.feedbacks["q1"]["correct"] is False

    def test_partial_credit(self):
        result = grade(self.Q, self.C, {"q1": ["X", "X", "Z"]})
        # X-X-Z vs X-Y-Z → 2/3 correct
        assert result.feedbacks["q1"]["score"] == pytest.approx(2 / 3)
        assert result.feedbacks["q1"]["correct"] is False

    def test_list_correct_per_statement(self):
        c = {"q1": {"correct": [["X", "Y"], "Y", "Z"]}}
        # statement 0 accepts X or Y
        result = grade(self.Q, c, {"q1": ["Y", "Y", "Z"]})
        assert result.feedbacks["q1"]["correct"] is True

    def test_feedback_for_wrong(self):
        c = {"q1": {"correct": ["X", "Y", "Z"],
                    "feedback": [{"Z": "Z is wrong for S1"}, {}, {}]}}
        result = grade(self.Q, c, {"q1": ["Z", "Y", "Z"]})
        assert "Z is wrong for S1" in result.feedbacks["q1"]["message"]

    def test_empty_answers(self):
        result = grade(self.Q, self.C, {"q1": []})
        # zip stops at shorter list → score = 0/0 → 0
        assert result.feedbacks["q1"]["score"] == 0


# ---------------------------------------------------------------------------
# multiple_dropdowns_question
# ---------------------------------------------------------------------------

class TestMultipleDropdownsQuestion:
    Q = {"q1": {"type": "multiple_dropdowns_question", "points": 2,
                "answers": {"color": ["red", "green", "blue"],
                            "size": ["small", "large"]}}}
    C = {"q1": {"correct": {"color": "red", "size": "large"},
                "wrong_any": "Try again"}}

    def test_all_correct(self):
        result = grade(self.Q, self.C, {"q1": {"color": "red", "size": "large"}})
        assert result.feedbacks["q1"]["correct"] is True
        assert result.score == 1.0

    def test_all_wrong(self):
        result = grade(self.Q, self.C, {"q1": {"color": "blue", "size": "small"}})
        assert result.feedbacks["q1"]["correct"] is False
        assert result.feedbacks["q1"]["message"] == "Try again"

    def test_partial_credit(self):
        result = grade(self.Q, self.C, {"q1": {"color": "red", "size": "small"}})
        assert result.feedbacks["q1"]["correct"] is False
        assert result.feedbacks["q1"]["score"] == pytest.approx(0.5)

    def test_per_blank_feedback(self):
        c = {"q1": {"correct": {"color": "red", "size": "large"},
                    "feedback": {"size": {"small": "Not small!"}}}}
        result = grade(self.Q, c, {"q1": {"color": "red", "size": "small"}})
        assert "Not small!" in result.feedbacks["q1"]["message"]

    def test_per_blank_string_feedback(self):
        c = {"q1": {"correct": {"color": "red", "size": "large"},
                    "feedback": {"size": "Size is wrong"}}}
        result = grade(self.Q, c, {"q1": {"color": "red", "size": "small"}})
        assert "Size is wrong" in result.feedbacks["q1"]["message"]

    def test_no_correct_keys_gives_zero(self):
        c = {"q1": {"correct": {}}}
        result = grade(self.Q, c, {"q1": {"color": "red"}})
        assert result.feedbacks["q1"]["score"] == 0

    def test_correct_message(self):
        result = grade(self.Q, self.C, {"q1": {"color": "red", "size": "large"}})
        assert result.feedbacks["q1"]["message"] == "Correct"


# ---------------------------------------------------------------------------
# short_answer_question and numerical_question
# ---------------------------------------------------------------------------

class TestShortAnswerQuestion:
    Q = {"q1": {"type": "short_answer_question", "points": 1}}
    Q_NUM = {"q1": {"type": "numerical_question", "points": 1}}

    def test_correct_exact_string(self):
        c = {"q1": {"correct_exact": "hello"}}
        result = grade(self.Q, c, {"q1": "hello"})
        assert result.feedbacks["q1"]["correct"] is True

    def test_correct_exact_list(self):
        c = {"q1": {"correct_exact": ["hello", "hi"]}}
        result = grade(self.Q, c, {"q1": "hi"})
        assert result.feedbacks["q1"]["correct"] is True

    def test_correct_alias(self):
        c = {"q1": {"correct": "hello"}}
        result = grade(self.Q, c, {"q1": "hello"})
        assert result.feedbacks["q1"]["correct"] is True

    def test_whitespace_trimmed(self):
        c = {"q1": {"correct_exact": "hello"}}
        result = grade(self.Q, c, {"q1": "  hello  "})
        assert result.feedbacks["q1"]["correct"] is True

    def test_incorrect_answer(self):
        c = {"q1": {"correct_exact": "hello", "wrong_any": "Wrong!"}}
        result = grade(self.Q, c, {"q1": "world"})
        assert result.feedbacks["q1"]["correct"] is False
        assert result.feedbacks["q1"]["message"] == "Wrong!"

    def test_specific_answer_feedback(self):
        c = {"q1": {"correct_exact": "hello",
                    "feedback": {"world": "Did you mean hello?"}}}
        result = grade(self.Q, c, {"q1": "world"})
        assert result.feedbacks["q1"]["message"] == "Did you mean hello?"

    def test_regex_match(self):
        c = {"q1": {"correct_regex": [r"^\d+$"]}}
        result = grade(self.Q, c, {"q1": "123"})
        assert result.feedbacks["q1"]["correct"] is True

    def test_regex_no_match(self):
        c = {"q1": {"correct_regex": [r"^\d+$"], "wrong_any": "Numbers only"}}
        result = grade(self.Q, c, {"q1": "abc"})
        assert result.feedbacks["q1"]["correct"] is False
        assert result.feedbacks["q1"]["message"] == "Numbers only"

    def test_missing_check_gives_error(self):
        c = {"q1": {}}
        result = grade(self.Q, c, {"q1": "hello"})
        assert result.feedbacks["q1"]["correct"] is False

    def test_numerical_question_correct(self):
        c = {"q1": {"correct_exact": "42"}}
        result = grade(self.Q_NUM, c, {"q1": "42"})
        assert result.feedbacks["q1"]["correct"] is True

    def test_correct_shows_correct_message(self):
        c = {"q1": {"correct_exact": "hello"}}
        result = grade(self.Q, c, {"q1": "hello"})
        assert result.feedbacks["q1"]["message"] == "Correct"


# ---------------------------------------------------------------------------
# fill_in_multiple_blanks_question
# ---------------------------------------------------------------------------

class TestFillInMultipleBlanks:
    Q = {"q1": {"type": "fill_in_multiple_blanks_question", "points": 2,
                "body": "The [color] sky is [adjective]."}}
    C_EXACT = {"q1": {"correct_exact": {"color": "blue", "adjective": "clear"},
                      "wrong_any": "Not right"}}

    def test_all_correct(self):
        result = grade(self.Q, self.C_EXACT,
                       {"q1": {"color": "blue", "adjective": "clear"}})
        assert result.feedbacks["q1"]["correct"] is True
        assert result.score == 1.0

    def test_all_wrong(self):
        result = grade(self.Q, self.C_EXACT,
                       {"q1": {"color": "red", "adjective": "stormy"}})
        assert result.feedbacks["q1"]["correct"] is False
        assert result.feedbacks["q1"]["message"] == "Not right"

    def test_partial_credit(self):
        result = grade(self.Q, self.C_EXACT,
                       {"q1": {"color": "blue", "adjective": "stormy"}})
        assert result.feedbacks["q1"]["correct"] is False
        assert result.feedbacks["q1"]["score"] == pytest.approx(0.5)

    def test_correct_exact_list_per_blank(self):
        c = {"q1": {"correct_exact": {"color": ["blue", "azure"],
                                      "adjective": "clear"}}}
        result = grade(self.Q, c, {"q1": {"color": "azure", "adjective": "clear"}})
        assert result.feedbacks["q1"]["correct"] is True

    def test_correct_alias(self):
        c = {"q1": {"correct": {"color": "blue", "adjective": "clear"}}}
        result = grade(self.Q, c, {"q1": {"color": "blue", "adjective": "clear"}})
        assert result.feedbacks["q1"]["correct"] is True

    def test_regex_blanks(self):
        c = {"q1": {"correct_regex": {"color": [r"^bl"],
                                      "adjective": [r"cl"]}}}
        result = grade(self.Q, c, {"q1": {"color": "blue", "adjective": "clear"}})
        assert result.feedbacks["q1"]["correct"] is True

    def test_regex_blanks_wrong(self):
        c = {"q1": {"correct_regex": {"color": [r"^bl"],
                                      "adjective": [r"cl"]}}}
        result = grade(self.Q, c, {"q1": {"color": "red", "adjective": "clear"}})
        assert result.feedbacks["q1"]["correct"] is False

    def test_missing_check_type_gives_error(self):
        c = {"q1": {}}
        result = grade(self.Q, c, {"q1": {"color": "blue", "adjective": "clear"}})
        assert result.feedbacks["q1"]["correct"] is False

    def test_correct_message(self):
        result = grade(self.Q, self.C_EXACT,
                       {"q1": {"color": "blue", "adjective": "clear"}})
        assert result.feedbacks["q1"]["message"] == "Correct"


# ---------------------------------------------------------------------------
# text_only_question and essay_question
# ---------------------------------------------------------------------------

class TestTextOnlyAndEssayQuestion:
    def test_text_only_always_correct(self):
        body_q = {"q1": {"type": "text_only_question", "points": 0}}
        check_q = {"q1": {}}
        # text_only questions have no student input; pass an empty string so the
        # answer is not treated as missing/skipped by the grader.
        result = grade(body_q, check_q, {"q1": ""})
        assert result.feedbacks["q1"]["correct"] is True
        assert result.feedbacks["q1"]["score"] == 1

    def test_essay_always_correct(self):
        body_q = {"q1": {"type": "essay_question", "points": 5}}
        check_q = {"q1": {}}
        result = grade(body_q, check_q, {"q1": "Some long essay text."})
        assert result.feedbacks["q1"]["correct"] is True
        assert result.feedbacks["q1"]["score"] == 1


# ---------------------------------------------------------------------------
# Scoring — weights and multi-question quizzes
# ---------------------------------------------------------------------------

class TestQuizScoring:
    def test_single_question_full_score(self):
        body_q = {"q1": {"type": "true_false_question", "points": 5}}
        check_q = {"q1": {"correct": True}}
        result = grade(body_q, check_q, {"q1": "true"})
        assert result.score == pytest.approx(1.0)
        assert result.points_possible == 5

    def test_multi_question_average(self):
        body_q = {
            "q1": {"type": "true_false_question", "points": 1},
            "q2": {"type": "true_false_question", "points": 1},
        }
        check_q = {
            "q1": {"correct": True},
            "q2": {"correct": False},
        }
        # q1 correct (answer "true", check True), q2 wrong (answer "true", check False)
        result = grade(body_q, check_q, {"q1": "true", "q2": "true"})
        assert result.score == pytest.approx(0.5)
        assert result.points_possible == 2

    def test_weighted_questions(self):
        body_q = {
            "q1": {"type": "true_false_question", "points": 3},
            "q2": {"type": "true_false_question", "points": 1},
        }
        check_q = {
            "q1": {"correct": True},
            "q2": {"correct": True},
        }
        result = grade(body_q, check_q, {"q1": "true", "q2": "true"})
        assert result.score == pytest.approx(1.0)
        assert result.points_possible == 4

    def test_weighted_partial_score(self):
        body_q = {
            "q1": {"type": "true_false_question", "points": 3},
            "q2": {"type": "true_false_question", "points": 1},
        }
        check_q = {
            "q1": {"correct": True},
            "q2": {"correct": True},
        }
        # q1 wrong (3 pts), q2 correct (1 pt) → 1/4
        result = grade(body_q, check_q, {"q1": "false", "q2": "true"})
        assert result.score == pytest.approx(1 / 4)

    def test_overall_correct_requires_all_correct(self):
        body_q = {
            "q1": {"type": "true_false_question", "points": 1},
            "q2": {"type": "true_false_question", "points": 1},
        }
        check_q = {
            "q1": {"correct": True},
            "q2": {"correct": False},
        }
        # q1 correct, q2 wrong (student says "true" but answer is False)
        result = grade(body_q, check_q, {"q1": "true", "q2": "true"})
        assert result.correct is False

    def test_overall_correct_when_all_correct(self):
        body_q = {
            "q1": {"type": "true_false_question", "points": 1},
            "q2": {"type": "true_false_question", "points": 1},
        }
        check_q = {
            "q1": {"correct": True},
            "q2": {"correct": False},
        }
        # q1 correct ("true"), q2 correct ("false" matches correct: False)
        result = grade(body_q, check_q, {"q1": "true", "q2": "false"})
        assert result.correct is True


# ---------------------------------------------------------------------------
# check_quiz_question — unit-level tests
# ---------------------------------------------------------------------------

class TestCheckQuizQuestion:
    def test_returns_none_for_unknown_type(self):
        question = {"type": "unknown_custom_type", "points": 1}
        result = check_quiz_question(question, {}, "answer")
        assert result is None

    def test_returns_tuple_for_known_type(self):
        question = {"type": "true_false_question", "points": 1}
        check = {"correct": True}
        result = check_quiz_question(question, check, "true")
        assert isinstance(result, tuple)
        assert len(result) == 3
