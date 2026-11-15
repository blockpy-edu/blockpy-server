"""
Tests for Score Adjustments (grading/adjustments): the pure matching and scoring
logic in models/data_formats/score_adjustments.py, and the endpoints that store a
batch as a parent review with one inheriting child review per submission.
"""
import json
from types import SimpleNamespace

import pytest

from models import db
from models.data_formats import score_adjustments as adjustments
from models.enums import AssignmentTypes, GradingStatuses, UserRoles
from models.grade_history import GradeHistory
from models.review import Review
from models.role import Role
from models.submission import Submission
from tests.factory.factories import AssignmentFactory, CourseFactory, SubmissionFactory, UserFactory


ANSWER_D = "range(1, 5)"
BODY = {
    "settings": {},
    "questions": {
        "loop_output": {"id": "loop_output", "type": "multiple_choice_question", "points": 1,
                        "body": "What does the list of **range** one to five produce?",
                        "answers": ["[1, 2, 3, 4, 5]", "[1, 2, 3, 4]", "[0, 1, 2, 3, 4]", ANSWER_D]},
        "earth": {"id": "earth", "type": "true_false_question", "points": 1,
                  "body": "The Earth is round."},
        "primes": {"id": "primes", "type": "multiple_answers_question", "points": 3,
                   "body": "Which are prime?", "answers": ["2", "3", "4"]},
        "keyword": {"id": "keyword", "type": "short_answer_question", "points": 1,
                    "body": "Which keyword starts a condition-controlled loop?"},
    }
}
CHECKS = {
    "questions": {
        "loop_output": {"correct": "[1, 2, 3, 4]"},
        "earth": {"correct": True},
        "primes": {"correct": ["2", "3"]},
        "keyword": {"correct_exact": ["while"]},
    }
}
# 6 points possible. Scores are what the grader gives, as whole percents.
RIMURU = {"loop_output": ANSWER_D, "earth": "true", "primes": ["2", "3"], "keyword": "while"}      # 5/6 = 83
BENIMARU = {"loop_output": ANSWER_D, "earth": "false", "primes": ["2"], "keyword": "for"}         # 2/6 = 33
SHION = {"loop_output": "[1, 2, 3, 4]", "earth": "true", "primes": ["2", "3"], "keyword": "while"}  # 6/6 = 100
GOBTA = {"loop_output": ANSWER_D, "earth": "false", "primes": ["2", "3"], "keyword": "while"}      # 4/6 = 67


def fake_assignment(body=BODY, checks=CHECKS, settings="{}"):
    return SimpleNamespace(instructions=json.dumps(body) if not isinstance(body, str) else body,
                           on_run=json.dumps(checks) if not isinstance(checks, str) else checks,
                           settings=settings)


def quiz_code(answers, attempting=False):
    return json.dumps({"studentAnswers": answers, "attempt": {"attempting": attempting, "count": 1}})


def fake_submission(submission_id, answers, score, attempting=False, code=None):
    return SimpleNamespace(id=submission_id, user_id=submission_id + 100, course_id=8, score=score,
                           code=quiz_code(answers, attempting) if code is None else code)


def quiz_context():
    context, error = adjustments.load_quiz(fake_assignment())
    assert error is None
    return context


def plan(submissions, rule, amount, **kwargs):
    kwargs.setdefault("context", quiz_context())
    return adjustments.plan_adjustments(submissions, adjustments.normalize_rule(rule),
                                        adjustments.normalize_amount(amount), **kwargs)


FOUR = [fake_submission(1, RIMURU, 83), fake_submission(2, BENIMARU, 33),
        fake_submission(3, SHION, 100), fake_submission(4, GOBTA, 67)]


class TestAnswerTally:
    def states(self, submissions=FOUR):
        context = quiz_context()
        return context, [adjustments.grade_quiz_submission(context, submission.code) for submission in submissions]

    def test_questions_are_described_for_the_dropdown(self):
        questions = adjustments.describe_questions(quiz_context())
        assert [question["id"] for question in questions] == ["loop_output", "earth", "primes", "keyword"]
        assert questions[0]["label"].startswith("Q1 · What does the list of range")
        assert questions[0]["points"] == 1 and questions[0]["parts"] == []
        assert [part["key"] for part in questions[2]["parts"]] == ["2", "3", "4"]
        assert all(question["graded"] for question in questions)

    def test_rows_follow_the_authors_order_and_keep_zero_counts(self):
        context, states = self.states()
        rows = adjustments.tally_answers(context, states, "loop_output")
        assert [(row["label"], row["count"], row["credit"]) for row in rows] == [
            ("[1, 2, 3, 4, 5]", 0, "ungraded"),
            ("[1, 2, 3, 4]", 1, "full"),
            ("[0, 1, 2, 3, 4]", 0, "ungraded"),
            (ANSWER_D, 3, "none"),
        ]

    def test_free_text_answers_are_listed_by_frequency(self):
        context, states = self.states()
        rows = adjustments.tally_answers(context, states, "keyword")
        assert [(row["key"], row["count"], row["credit"]) for row in rows] == [
            ("while", 3, "full"), ("for", 1, "none")]

    def test_blank_and_never_given_get_their_own_rows(self):
        blank = dict(RIMURU, keyword="  ")
        pooled = {key: value for key, value in RIMURU.items() if key != "keyword"}
        context, states = self.states([fake_submission(1, blank, 67), fake_submission(2, pooled, 100),
                                       fake_submission(3, {}, 0, code="{}")])
        rows = {row["key"]: row for row in adjustments.tally_answers(context, states, "keyword")}
        assert rows[adjustments.BLANK_KEY]["count"] == 1
        assert rows[adjustments.BLANK_KEY]["credit"] == "none"
        # A hidden pool question and a never-opened quiz both mean "was not given it"
        assert rows[adjustments.MISSING_KEY]["count"] == 2
        assert rows[adjustments.MISSING_KEY]["credit"] == "not counted"

    def test_a_part_of_a_multi_part_question_is_tallied_on_its_own(self):
        context, states = self.states()
        rows = adjustments.tally_answers(context, states, "primes", "3")
        assert [(row["key"], row["count"], row["credit"]) for row in rows] == [
            (adjustments.CHOSEN, 3, "full"), (adjustments.NOT_CHOSEN, 1, "none")]
        # 4 is not prime, so leaving it unchosen is the right answer for everyone
        rows = adjustments.tally_answers(context, states, "primes", "4")
        assert [(row["key"], row["count"], row["credit"]) for row in rows] == [
            (adjustments.CHOSEN, 0, "ungraded"), (adjustments.NOT_CHOSEN, 4, "full")]

    def test_whole_answer_of_a_multi_part_question_groups_equal_choices(self):
        context, states = self.states()
        rows = adjustments.tally_answers(context, states, "primes")
        assert [(row["label"], row["count"]) for row in rows] == [("2, 3", 3), ("2", 1)]

    def test_unreadable_quiz_is_reported(self):
        context, error = adjustments.load_quiz(fake_assignment(body="{not json"))
        assert context is None and "Quiz Body" in error


class TestPlanning:
    def test_credit_is_each_students_rescore_difference(self):
        planned = plan(FOUR, {"question_id": "loop_output", "answers": [ANSWER_D]}, {"mode": "credit"})
        # Shion answered B and is not selected. 5/6 -> 6/6 is 83 -> 100; 2/6 -> 3/6 is 33 -> 50;
        # 4/6 -> 5/6 is 67 -> 83: the same question is worth 17, 17 and 16 points of percent.
        assert [(row.submission_id, row.delta, row.after) for row in planned] == [
            (1, 17, 100), (2, 17, 50), (4, 16, 83)]
        assert all(row.include for row in planned)
        assert all(row.answer_label == ANSWER_D for row in planned)

    def test_removing_credit_reverses_it(self):
        planned = plan(FOUR, {"question_id": "loop_output", "answers": ["[1, 2, 3, 4]"]}, {"mode": "remove"})
        assert [(row.submission_id, row.delta, row.after) for row in planned] == [(3, -17, 83)]

    def test_credit_for_one_part_moves_only_that_part(self):
        # Benimaru left "3" unchosen: 2 of the 3 parts right. Crediting the part makes it 3 of 3,
        # so the question goes from 2 to 3 points: 2/6 -> 3/6 is 33 -> 50.
        planned = plan(FOUR, {"question_id": "primes", "part": "3", "answers": [adjustments.NOT_CHOSEN]},
                       {"mode": "credit"})
        assert [(row.submission_id, row.delta) for row in planned] == [(2, 17)]
        # Crediting a part that is already right changes nothing, and is not ticked
        planned = plan(FOUR, {"question_id": "primes", "part": "3", "answers": [adjustments.CHOSEN]},
                       {"mode": "credit"})
        assert {row.delta for row in planned} == {0}
        assert not any(row.include for row in planned)

    def test_students_not_given_the_question_do_not_change(self):
        pooled = {key: value for key, value in RIMURU.items() if key != "loop_output"}
        planned = plan([fake_submission(9, pooled, 100)],
                       {"question_id": "loop_output", "answers": [adjustments.MISSING_KEY]}, {"mode": "credit"})
        assert planned[0].delta == 0 and not planned[0].include
        assert "Was not given this question" in planned[0].notes

    def test_amounts_are_trimmed_to_stay_within_0_and_100(self):
        planned = plan(FOUR, {"question_id": "loop_output", "answers": [ANSWER_D]}, {"mode": "credit"},
                       review_totals={1: 10, 2: 0})
        rimuru = planned[0]
        # 83 + 10 already on reviews = 93, so only 7 of the 17 fits
        assert (rimuru.now, rimuru.raw_delta, rimuru.delta, rimuru.after) == (93, 17, 7, 100)
        assert any("Trimmed" in note for note in rimuru.notes)
        planned = plan(FOUR, {"answers": []}, {"mode": "fixed", "value": -50})
        assert [(row.submission_id, row.delta) for row in planned] == [(1, -50), (2, -33), (3, -50), (4, -50)]

    def test_trimming_never_drags_an_out_of_range_total_back(self):
        # A cheating penalty leaves the total far below zero; an adjustment must not undo it
        assert adjustments.trim_delta(-9999917, 17) == 17
        assert adjustments.trim_delta(-9999917, -5) == 0
        assert adjustments.trim_delta(150, 8) == 0
        assert adjustments.trim_delta(96, 8) == 4
        assert adjustments.trim_delta(3, -8) == -3

    def test_fixed_amount_in_quiz_points_uses_each_students_denominator(self):
        pooled = {key: value for key, value in RIMURU.items() if key != "primes"}  # 3 points possible
        planned = plan([fake_submission(1, BENIMARU, 33), fake_submission(2, pooled, 67)],
                       {"answers": []}, {"mode": "fixed", "value": 1, "unit": "points"})
        assert [row.raw_delta for row in planned] == [17, 33]

    def test_floor_and_exact_targets_for_coding_problems(self):
        coders = [SimpleNamespace(id=1, user_id=1, course_id=8, score=40, code="x"),
                  SimpleNamespace(id=2, user_id=2, course_id=8, score=90, code="y")]
        planned = plan(coders, {}, {"mode": "floor", "value": 70}, context=None)
        assert [(row.delta, row.include) for row in planned] == [(30, True), (0, False)]
        planned = plan(coders, {}, {"mode": "exact", "value": 70}, context=None)
        assert [row.delta for row in planned] == [30, -20]

    def test_conditions_variations_and_earlier_batches_narrow_the_plan(self):
        planned = plan(FOUR, {"question_id": "loop_output", "answers": [ANSWER_D]}, {"mode": "credit"},
                       passes_conditions=lambda submission: submission.score >= 50,
                       already_adjusted={4: "Earlier batch"})
        assert [row.submission_id for row in planned] == [1, 4]
        assert planned[0].include and not planned[1].include
        assert any("Already adjusted" in note for note in planned[1].notes)
        coders = [SimpleNamespace(id=number, user_id=number, course_id=8, score=50, code="")
                  for number in (10, 11, 12)]
        planned = plan(coders, {"variations": [1]}, {"mode": "fixed", "value": 5}, context=None,
                       variation_count=2)
        assert [(row.submission_id, row.variation) for row in planned] == [(11, 1)]

    def test_in_progress_attempts_and_stale_scores_are_flagged(self):
        planned = plan([fake_submission(1, RIMURU, 83, attempting=True), fake_submission(2, RIMURU, 50)],
                       {"question_id": "loop_output", "answers": [ANSWER_D]}, {"mode": "credit"})
        assert not planned[0].include and "Quiz attempt in progress" in planned[0].notes
        assert any("now grades to 83%" in note for note in planned[1].notes)

    def test_question_modes_need_a_question_and_amounts_are_validated(self):
        with pytest.raises(ValueError):
            plan(FOUR, {"answers": []}, {"mode": "credit"})
        with pytest.raises(ValueError):
            adjustments.normalize_amount({"mode": "fixed", "value": "lots"})
        with pytest.raises(ValueError):
            adjustments.normalize_amount({"mode": "exact", "value": 140})
        with pytest.raises(ValueError):
            adjustments.normalize_amount({"mode": "double"})


class TestVariations:
    INSTRUCTIONS = ("Intro\n<!----# Cats #---->\nWrite about cats\n<!----# Dogs #---->\nWrite about dogs\n"
                    "<!----# Footer #---->\nGood luck")

    def test_variants_are_named_by_every_separator_but_the_last(self):
        assignment = fake_assignment(body=self.INSTRUCTIONS, checks="", settings='{"poolRandomness": "SEED"}')
        assert adjustments.describe_variations(assignment) == [
            {"index": 0, "label": "Cats"}, {"index": 1, "label": "Dogs"}]
        # The same arithmetic as extractFromPool: seed % (pools - 2)
        assert [adjustments.variation_of(seed, 2) for seed in (10, 11, 12)] == [0, 1, 0]

    def test_tests_name_the_variants_when_instructions_are_not_pooled(self):
        tests = "setup\n/****# A #****/\none\n/****# B #****/\ntwo\n/****# C #****/\nthree\n/****# end #****/\n"
        assignment = fake_assignment(body="No pools here", checks=tests, settings='{"poolRandomness": "SEED"}')
        assert [variation["label"] for variation in adjustments.describe_variations(assignment)] == ["A", "B", "C"]

    def test_unseeded_or_unpooled_problems_have_no_variations(self):
        assert adjustments.describe_variations(fake_assignment(body=self.INSTRUCTIONS, checks="")) == []
        assert adjustments.describe_variations(
            fake_assignment(body="plain", checks="plain", settings='{"poolRandomness": "SEED"}')) == []
        assert adjustments.describe_variations(fake_assignment(body="x", checks="", settings="{broken")) == []
        assert adjustments.variation_of(7, 0) is None


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

def post(client, path, **payload):
    response = client.post(f"/grading/adjustments/{path}", data={"payload": json.dumps(payload)})
    assert response.status_code == 200, response.data
    return response.get_json()


@pytest.fixture
def exam(client, test_data):
    """ One quiz used by two courses that Ada teaches (8 and a second section), with a
    third course she has no role in, and a second instructor who only has the section. """
    course = test_data.courses.by(id=8)
    ada = test_data.user("ada@blockpy.com")
    rimuru = test_data.user("rimuru@blockpy.com")
    benimaru = test_data.user("benimaru@blockpy.com")
    section = CourseFactory.create_course(name="Second Section", owner=ada)
    Role.new(user_id=ada.id, course_id=section.id, name=UserRoles.INSTRUCTOR)
    grace = UserFactory.create_instructor(course=section, first_name="Grace", last_name="Hopper")
    elsewhere = CourseFactory.create_course(name="Someone Else's Course", owner=grace)
    Role.new(user_id=grace.id, course_id=elsewhere.id, name=UserRoles.INSTRUCTOR)
    shion = UserFactory.create_student(course=section, first_name="Shion", last_name="Oni")
    gobta = UserFactory.create_student(course=section, first_name="Gobta", last_name="Goblin")
    outsider = UserFactory.create_student(course=elsewhere, first_name="Out", last_name="Sider")
    assignment = AssignmentFactory.create_assignment(name="Loops Exam", course=course, owner=ada,
                                                     assignment_type=AssignmentTypes.QUIZ,
                                                     instructions=json.dumps(BODY), on_run=json.dumps(CHECKS))

    def submit(user, in_course, answers, score):
        submission = SubmissionFactory.create_submission(assignment=assignment, user=user, course=in_course,
                                                         code=quiz_code(answers))
        submission.score = score
        db.session.commit()
        return submission

    submissions = {
        "rimuru": submit(rimuru, course, RIMURU, 83),
        "benimaru": submit(benimaru, course, BENIMARU, 33),
        "shion": submit(shion, section, SHION, 100),
        "gobta": submit(gobta, section, GOBTA, 67),
        "outsider": submit(outsider, elsewhere, GOBTA, 67),
    }
    return dict(course=course, section=section, elsewhere=elsewhere, assignment=assignment,
                ada=ada, grace=grace, rimuru=rimuru, submissions=submissions)


def credit_rule(exam, **overrides):
    payload = dict(assignment_id=exam['assignment'].id,
                   course_ids=[exam['course'].id, exam['section'].id],
                   rule={"question_id": "loop_output", "answers": [ANSWER_D]},
                   amount={"mode": "credit"},
                   comment=adjustments.DEFAULT_COMMENT)
    payload.update(overrides)
    return payload


def apply_credit(client, exam, **overrides):
    preview = post(client, "preview", **credit_rule(exam, **overrides))
    chosen = [row["submission_id"] for row in preview["rows"] if row["include"]]
    return post(client, "apply", **credit_rule(exam, submission_ids=chosen, **overrides))


class TestAccess:
    def test_page_needs_a_grader(self, client, exam, act_as):
        url = f"/grading/adjustments?course_id={exam['course'].id}&assignment_id={exam['assignment'].id}"
        assert client.get(url).status_code == 302
        act_as(exam['rimuru'])
        assert client.get(url).get_json()['success'] is False
        act_as(exam['ada'])
        response = client.get(url)
        assert response.status_code == 200 and b"score-adjustments" in response.data
        # Without an assignment, the course's assignments are listed to pick from
        response = client.get(f"/grading/adjustments?course_id={exam['course'].id}")
        assert response.status_code == 200 and b"Loops Exam" in response.data

    def test_only_courses_the_viewer_grades_are_offered(self, client, exam, act_as):
        act_as(exam['ada'])
        loaded = post(client, "load", assignment_id=exam['assignment'].id)
        assert loaded['kind'] == "quiz"
        assert {course['name']: course['submissions'] for course in loaded['courses']} == {
            exam['course'].name: 2, "Second Section": 2}
        assert [question['id'] for question in loaded['questions']] == ["loop_output", "earth", "primes", "keyword"]
        act_as(exam['grace'])
        loaded = post(client, "load", assignment_id=exam['assignment'].id)
        assert sorted(course['name'] for course in loaded['courses']) == ["Second Section", "Someone Else's Course"]

    def test_students_and_other_courses_are_refused(self, client, exam, act_as):
        act_as(exam['rimuru'])
        assert post(client, "load", assignment_id=exam['assignment'].id)['success'] is False
        assert post(client, "preview", **credit_rule(exam))['success'] is False
        act_as(exam['ada'])
        refused = post(client, "preview", **credit_rule(exam, course_ids=[exam['course'].id, exam['elsewhere'].id]))
        assert refused['success'] is False and "grader" in refused['message']
        assert Review.query.count() == 0

    def test_hidden_assignments_need_an_instructor(self, client, exam, act_as):
        exam['assignment'].hidden = True
        ta = UserFactory.create_user(first_name="Tee", last_name="Ay")
        Role.new(user_id=ta.id, course_id=exam['course'].id, name=UserRoles.TA)
        db.session.commit()
        act_as(ta)
        assert post(client, "load", assignment_id=exam['assignment'].id)['success'] is False
        act_as(exam['ada'])
        assert post(client, "load", assignment_id=exam['assignment'].id)['success'] is True


class TestPreviewAndApply:
    def test_tally_spans_the_chosen_courses(self, client, exam, act_as):
        act_as(exam['ada'])
        both = post(client, "tally", assignment_id=exam['assignment'].id, question_id="loop_output",
                    course_ids=[exam['course'].id, exam['section'].id])
        assert both['submissions'] == 4
        assert {row['label']: row['count'] for row in both['rows']}[ANSWER_D] == 3
        one = post(client, "tally", assignment_id=exam['assignment'].id, question_id="loop_output",
                   course_ids=[exam['course'].id])
        assert {row['label']: row['count'] for row in one['rows']}[ANSWER_D] == 2

    def test_preview_writes_nothing(self, client, exam, act_as):
        act_as(exam['ada'])
        preview = post(client, "preview", **credit_rule(exam))
        assert sorted((row['delta'], row['after']) for row in preview['rows']) == [(16, 83), (17, 50), (17, 100)]
        assert all(row['include'] for row in preview['rows'])
        assert {row['course'] for row in preview['rows']} == {exam['course'].name, "Second Section"}
        assert preview['rule_description'].startswith("Q1:")
        assert Review.query.count() == 0

    def test_apply_writes_one_parent_and_an_inheriting_child_per_student(self, client, exam, act_as):
        act_as(exam['ada'])
        result = apply_credit(client, exam, note="D was ambiguous; see exam meeting notes")
        assert result['success'] and result['applied'] == 3
        parent = Review.by_id(result['batch_id'])
        assert parent.submission_id is None and not parent.generic
        assert parent.comment == adjustments.DEFAULT_COMMENT
        children = Review.query.filter_by(forked_id=parent.id).all()
        assert {child.submission_id: child.score for child in children} == {
            exam['submissions']['rimuru'].id: 17, exam['submissions']['benimaru'].id: 17,
            exam['submissions']['gobta'].id: 16}
        assert all(child.comment == "" for child in children)
        # Scores flow through the normal calculation, in both courses
        assert Submission.by_id(exam['submissions']['rimuru'].id).full_score() == pytest.approx(1.0)
        assert Submission.by_id(exam['submissions']['gobta'].id).full_score() == pytest.approx(0.83)
        assert Submission.by_id(exam['submissions']['shion'].id).full_score() == pytest.approx(1.0)
        # The other course's submission was never in scope
        assert Review.query.filter_by(submission_id=exam['submissions']['outsider'].id).count() == 0
        # The batch is listed with its reach
        batch = result['batches'][0]
        assert batch['students'] == 3 and (batch['amount_low'], batch['amount_high']) == (16, 17)
        assert sorted(course['name'] for course in batch['courses']) == [exam['course'].name, "Second Section"]
        assert batch['rule'].startswith("Q1:") and batch['note'].startswith("D was ambiguous")

    def test_what_students_can_load_holds_no_rule_note_or_answer(self, client, exam, act_as):
        act_as(exam['ada'])
        result = apply_credit(client, exam, note=f"Accepting {ANSWER_D}")
        parent = Review.by_id(result['batch_id'])
        assert ANSWER_D in parent.extra_data  # graders can see why
        submission = Submission.by_id(exam['submissions']['rimuru'].id)
        inherited = submission.get_inherited_reviews()
        assert [review['comment'] for review in inherited] == [adjustments.DEFAULT_COMMENT]
        visible = json.dumps([inherited, submission.get_reviews(), Submission.get_meta_reviews()], default=str)
        assert ANSWER_D not in visible and "loop_output" not in visible and "extra_data" not in visible
        # It is not offered sitewide as something to inherit from
        assert Review.get_generic_reviews() == []
        # And the student's own review endpoint cannot fetch the parent
        act_as(exam['rimuru'])
        assert client.get(f"/grading/review/{parent.id}").get_json()['success'] is False

    def test_the_comment_is_the_graders_to_write_but_cannot_be_empty(self, client, exam, act_as):
        act_as(exam['ada'])
        chosen = [exam['submissions']['rimuru'].id]
        for comment in ("", "   "):
            refused = post(client, "apply", **credit_rule(exam, submission_ids=chosen, comment=comment))
            assert refused['success'] is False
        assert Review.query.count() == 0
        # Like the ordinary review editor, the wording is trusted to the grader
        comment = "Regraded: 2 graders agreed the question was unclear."
        saved = post(client, "apply", **credit_rule(exam, submission_ids=chosen, comment=comment))
        assert saved['success'] and Review.by_id(saved['batch_id']).comment == comment

    def test_the_server_decides_who_and_how_much(self, client, exam, act_as):
        act_as(exam['ada'])
        chosen = [exam['submissions']['rimuru'].id, exam['submissions']['shion'].id,
                  exam['submissions']['outsider'].id]
        result = post(client, "apply", **credit_rule(exam, submission_ids=chosen, amount={"mode": "credit", "value": 99}))
        # Shion did not answer D and the outsider is in another course: only Rimuru is adjusted
        children = Review.query.filter_by(forked_id=result['batch_id']).all()
        assert [(child.submission_id, child.score) for child in children] == [(exam['submissions']['rimuru'].id, 17)]

    def test_a_fixed_amount_is_inherited_and_trimmed_per_student(self, client, exam, act_as):
        act_as(exam['ada'])
        chosen = [submission.id for submission in exam['submissions'].values()]
        result = post(client, "apply", **credit_rule(exam, submission_ids=chosen, rule={"answers": []},
                                                     amount={"mode": "fixed", "value": 20}))
        parent = Review.by_id(result['batch_id'])
        assert parent.score == 20
        scores = {child.submission_id: child.score for child in Review.query.filter_by(forked_id=parent.id)}
        # Shion is at 100 and is left out; Rimuru only has room for 17; the others inherit the 20
        assert scores == {exam['submissions']['rimuru'].id: 17, exam['submissions']['benimaru'].id: None,
                          exam['submissions']['gobta'].id: None}
        assert Submission.by_id(exam['submissions']['benimaru'].id).full_score() == pytest.approx(0.53)

    def test_a_second_batch_for_the_same_question_is_not_ticked(self, client, exam, act_as):
        act_as(exam['ada'])
        apply_credit(client, exam)
        preview = post(client, "preview", **credit_rule(exam))
        assert preview['rows'] and not any(row['include'] for row in preview['rows'])
        assert all(any("Already adjusted" in note for note in row['notes']) for row in preview['rows'])

    def test_conditions_narrow_the_selection(self, client, exam, act_as):
        act_as(exam['ada'])
        rule = {"question_id": "loop_output", "answers": [ANSWER_D],
                "search": {"combinator": "and", "criteria": [{"field": "score", "operator": "ge", "value": "50"}]}}
        preview = post(client, "preview", **credit_rule(exam, rule=rule))
        assert sorted(row['now'] for row in preview['rows']) == [67, 83]


class TestCodingProblems:
    INSTRUCTIONS = ("Write a function.\n<!----# Cats #---->\nCount the cats in a shelter.\n"
                    "<!----# Dogs #---->\nCount the dogs in a kennel.\n<!----# Footer #---->\nGood luck")

    @pytest.fixture
    def problem(self, client, test_data):
        course = test_data.courses.by(id=8)
        ada = test_data.user("ada@blockpy.com")
        assignment = AssignmentFactory.create_assignment(
            name="Pooled Problem", course=course, owner=ada, assignment_type=AssignmentTypes.TYPESCRIPT,
            instructions=self.INSTRUCTIONS, settings='{"poolRandomness": "SEED"}')
        submissions = []
        for email, score in (("rimuru@blockpy.com", 40), ("benimaru@blockpy.com", 90)):
            submission = SubmissionFactory.create_submission(assignment=assignment, user=test_data.user(email),
                                                             course=course, code="let x = 1;")
            submission.score = score
            submission.attempts = 1 if score == 40 else 0
            submissions.append(submission)
        db.session.commit()
        return dict(course=course, assignment=assignment, ada=ada, submissions=submissions)

    def scope(self, problem, **extra):
        return dict(assignment_id=problem['assignment'].id, course_ids=[problem['course'].id], **extra)

    def test_variations_are_offered_and_counted(self, client, problem, act_as):
        act_as(problem['ada'])
        loaded = post(client, "load", assignment_id=problem['assignment'].id)
        assert loaded['kind'] == "code" and loaded['questions'] == []
        assert [variation['label'] for variation in loaded['variations']] == ["Cats", "Dogs"]
        tally = post(client, "tally", **self.scope(problem))
        expected = {"Cats": 0, "Dogs": 0}
        for submission in problem['submissions']:
            expected[["Cats", "Dogs"][submission.id % 2]] += 1
        assert {row['label']: row['count'] for row in tally['rows']} == expected

    def test_a_variation_can_be_raised_to_a_floor(self, client, problem, act_as):
        act_as(problem['ada'])
        low = problem['submissions'][0]
        request = self.scope(problem, rule={"variations": [low.id % 2]}, amount={"mode": "floor", "value": 70},
                             comment=adjustments.DEFAULT_COMMENT)
        preview = post(client, "preview", **request)
        by_id = {row['submission_id']: row for row in preview['rows']}
        assert by_id[low.id]['delta'] == 30 and by_id[low.id]['variation'] == ["Cats", "Dogs"][low.id % 2]
        applied = post(client, "apply", submission_ids=[low.id], **request)
        assert applied['applied'] == 1 and applied['batches'][0]['rule'].startswith("variation ")
        assert Submission.by_id(low.id).full_score() == pytest.approx(0.70)

    def test_conditions_alone_select_students(self, client, problem, act_as):
        act_as(problem['ada'])
        graded_once = {"combinator": "and", "criteria": [{"field": "attempts", "operator": "ge", "value": "1"}]}
        request = self.scope(problem, rule={"search": graded_once}, amount={"mode": "fixed", "value": 5},
                             comment=adjustments.DEFAULT_COMMENT)
        preview = post(client, "preview", **request)
        assert [row['submission_id'] for row in preview['rows']] == [problem['submissions'][0].id]
        assert preview['rule_description'] == "everyone"


class TestBatches:
    def test_editing_the_comment_changes_it_for_every_course_at_once(self, client, exam, act_as):
        act_as(exam['ada'])
        batch_id = apply_credit(client, exam)['batch_id']
        assert post(client, "batch/edit", batch_id=batch_id, comment=" ")['success'] is False
        edited = post(client, "batch/edit", batch_id=batch_id, comment="Regraded after review.", note="v2")
        assert edited['success'] and edited['batches'][0]['comment'] == "Regraded after review."
        for name in ("rimuru", "gobta"):
            inherited = Submission.by_id(exam['submissions'][name].id).get_inherited_reviews()
            assert [review['comment'] for review in inherited] == ["Regraded after review."]

    def test_changing_the_amount_keeps_hand_edited_reviews(self, client, exam, act_as):
        act_as(exam['ada'])
        batch_id = apply_credit(client, exam)['batch_id']
        children = {child.submission_id: child for child in Review.query.filter_by(forked_id=batch_id)}
        # A grader gives Gobta a different amount through the ordinary review editor
        customized = children[exam['submissions']['gobta'].id]
        response = client.put(f"/grading/review/{customized.id}",
                              json=dict(customized.encode_json(), score=5, comment="Partial only"))
        assert response.get_json()['success']
        listed = post(client, "load", assignment_id=exam['assignment'].id)['batches'][0]
        assert listed['customized'] == 1
        edited = post(client, "batch/edit", batch_id=batch_id, comment=adjustments.DEFAULT_COMMENT, amount=10)
        assert edited['changed'] == 2
        scores = {child.submission_id: child.score for child in Review.query.filter_by(forked_id=batch_id)}
        assert scores == {exam['submissions']['rimuru'].id: None, exam['submissions']['benimaru'].id: None,
                          exam['submissions']['gobta'].id: 5}
        assert Review.by_id(batch_id).score == 10
        assert Submission.by_id(exam['submissions']['rimuru'].id).full_score() == pytest.approx(0.93)
        # Asking for it overwrites the hand edit too
        post(client, "batch/edit", batch_id=batch_id, comment=adjustments.DEFAULT_COMMENT, amount=10,
             include_customized=True)
        gobta = Review.query.filter_by(forked_id=batch_id, submission_id=exam['submissions']['gobta'].id).one()
        assert (gobta.score, gobta.comment) == (None, "")

    def test_batch_lists_its_students(self, client, exam, act_as):
        act_as(exam['ada'])
        batch_id = apply_credit(client, exam)['batch_id']
        detail = post(client, "batch", batch_id=batch_id)
        by_course = {(row['course'], row['amount'], row['total']) for row in detail['rows']}
        assert by_course == {("Second Section", 16, 83), (exam['course'].name, 17, 50),
                             (exam['course'].name, 17, 100)}
        assert all(row['lms'] == "unlinked" and not row['customized'] for row in detail['rows'])

    def test_removing_a_batch_deletes_every_review(self, client, exam, act_as):
        act_as(exam['ada'])
        batch_id = apply_credit(client, exam)['batch_id']
        removed = post(client, "batch/remove", batch_id=batch_id)
        assert removed['success'] and removed['removed'] == 3 and removed['batches'] == []
        assert Review.query.count() == 0
        assert Submission.by_id(exam['submissions']['rimuru'].id).full_score() == pytest.approx(0.83)

    def test_a_grader_of_one_course_can_see_but_not_change_a_wider_batch(self, client, exam, act_as):
        act_as(exam['ada'])
        batch_id = apply_credit(client, exam)['batch_id']
        act_as(exam['grace'])
        listed = post(client, "load", assignment_id=exam['assignment'].id)['batches']
        assert [batch['id'] for batch in listed] == [batch_id] and listed[0]['editable'] is False
        assert post(client, "batch/remove", batch_id=batch_id)['success'] is False
        assert post(client, "batch/edit", batch_id=batch_id, comment="Mine now")['success'] is False
        assert Review.query.filter_by(forked_id=batch_id).count() == 3
        # A student cannot touch it at all, and an ordinary review is not a batch
        act_as(exam['rimuru'])
        assert post(client, "batch/remove", batch_id=batch_id)['success'] is False
        act_as(exam['ada'])
        child = Review.query.filter_by(forked_id=batch_id).first()
        assert post(client, "batch/remove", batch_id=child.id)['success'] is False


class TestSendingGrades:
    OUTCOME_URL = "https://lms.example.edu/api/lti/v1/tools/1/grade_passback"
    SUCCESS_XML = b"<imsx_POXEnvelopeResponse><imsx_codeMajor>success</imsx_codeMajor></imsx_POXEnvelopeResponse>"
    FAILURE_XML = b"<imsx_POXEnvelopeResponse><imsx_codeMajor>failure</imsx_codeMajor></imsx_POXEnvelopeResponse>"

    @pytest.fixture
    def lms(self, app, exam, monkeypatch):
        """ Link course 8 and Rimuru's submission to a fake LMS that records each post. """
        from controllers.pylti import common as pylti_common
        calls = []
        outcome = {"content": self.SUCCESS_XML}

        class FakeClient:
            def __init__(self, consumer, token=None, **kwargs):
                pass

            def add_certificate(self, **kwargs):
                pass

            def request(self, url, method, body=None, headers=None):
                calls.append((url, body))
                return {'status': '200'}, outcome["content"]

        monkeypatch.setattr(pylti_common.oauth2, "Client", FakeClient)
        exam['course'].endpoint = self.OUTCOME_URL
        exam['submissions']['rimuru'].endpoint = "rimuru-sourcedid"
        db.session.commit()
        return SimpleNamespace(calls=calls, outcome=outcome)

    def test_unlinked_submissions_are_reported_not_failed(self, client, exam, act_as):
        act_as(exam['ada'])
        apply_credit(client, exam)
        sent = post(client, "send", submission_id=exam['submissions']['gobta'].id)
        assert sent['success'] and sent['status'] == "unlinked"

    def test_send_posts_the_total_and_changes_nothing_else(self, client, exam, act_as, lms):
        submission = exam['submissions']['rimuru']
        # Mid-attempt, with a status that a full regrade would overwrite
        submission.code = quiz_code(RIMURU, attempting=True)
        submission.grading_status = GradingStatuses.PENDING
        db.session.commit()
        before = (submission.code, submission.version, submission.submission_status, submission.score)
        act_as(exam['ada'])
        result = post(client, "apply", **credit_rule(exam, submission_ids=[submission.id]))
        assert result['batches'][0]['pending'] == 1
        sent = post(client, "send", submission_id=submission.id)
        assert sent['status'] == "sent"
        assert len(lms.calls) == 1 and lms.calls[0][0] == self.OUTCOME_URL
        assert b"<textString>1.0</textString>" in lms.calls[0][1] or b">1.0<" in lms.calls[0][1]
        fresh = Submission.by_id(submission.id)
        assert (fresh.code, fresh.version, fresh.submission_status, fresh.score) == before
        assert fresh.grading_status == GradingStatuses.PENDING
        assert json.loads(fresh.code)["attempt"]["attempting"] is True
        history = GradeHistory.query.filter_by(submission_id=submission.id).all()
        assert [row.score for row in history] == [pytest.approx(1.0)]
        # The batch now knows this grade is with the LMS
        batch = post(client, "load", assignment_id=exam['assignment'].id)['batches'][0]
        assert (batch['pending'], batch['sent']) == (0, 1)

    def test_publish_marks_the_submission_fully_graded(self, client, exam, act_as, lms):
        submission = exam['submissions']['rimuru']
        submission.grading_status = GradingStatuses.PENDING
        db.session.commit()
        act_as(exam['ada'])
        post(client, "apply", **credit_rule(exam, submission_ids=[submission.id]))
        post(client, "send", submission_id=submission.id, publish=True)
        assert Submission.by_id(submission.id).grading_status == GradingStatuses.FULLY_GRADED

    def test_a_refused_post_is_reported_and_stays_pending(self, client, exam, act_as, lms):
        lms.outcome["content"] = self.FAILURE_XML
        submission = exam['submissions']['rimuru']
        act_as(exam['ada'])
        post(client, "apply", **credit_rule(exam, submission_ids=[submission.id]))
        sent = post(client, "send", submission_id=submission.id)
        assert sent['status'] == "failed" and sent['message']
        assert GradeHistory.query.filter_by(submission_id=submission.id).count() == 0
        batch = post(client, "load", assignment_id=exam['assignment'].id)['batches'][0]
        assert batch['pending'] == 1

    def test_students_cannot_send(self, client, exam, act_as, lms):
        act_as(exam['rimuru'])
        assert post(client, "send", submission_id=exam['submissions']['rimuru'].id)['success'] is False
        assert lms.calls == []
