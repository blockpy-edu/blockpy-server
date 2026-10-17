"""
Regression tests for the second batch of audit fixes:
- student-written quiz answers and log messages are escaped before graders see them
- student names cannot inject HTML into the similarity report
- CSV exports neutralise spreadsheet formulas
- students cannot choose or clear their own exam start time
- the users lookup only returns members of the course
- bulk grade upload requires a real grader and never logs rejected grades
- the grading-script route applies the assignment's passcode check
"""
import io
import json

import pytest

from common.text import csv_safe
from models.assignment import Assignment
from models.generics.models import db
from models.log_tables.submission_log import SubmissionLog
from models.submission import Submission
from models.user import User


ADA = "ada@blockpy.com"
CAPTAIN = "captain@blockpy.com"
LULU = "lulu@blockpy.com"
PAYLOAD = "<img src=x onerror=alert(1)>"


class TestEscaping:

    def test_quiz_blank_answer_is_escaped(self, client, test_data):
        from controllers.jinja_filters import make_readonly_quiz_body
        question = {"type": "fill_in_multiple_blanks_question", "body": "The answer is [blank1]."}
        html = make_readonly_quiz_body(question, {}, {"blank1": PAYLOAD}, {"correct": {"blank1": ["x"]}}, True)
        assert PAYLOAD not in html
        assert "&lt;img" in html

    def test_history_filters_escape(self, client, test_data):
        from controllers.jinja_filters import escaped_pre, pretty_json_pre
        assert PAYLOAD not in escaped_pre(PAYLOAD)
        assert escaped_pre(PAYLOAD).startswith("<pre>&lt;img")
        pretty = pretty_json_pre(json.dumps({"a": PAYLOAD}))
        assert PAYLOAD not in pretty
        assert "&#34;a&#34;" in pretty
        assert pretty_json_pre("not json") == "<pre>not json</pre>"
        assert escaped_pre(None) == "<pre></pre>"

    def test_similarity_report_escapes_names(self, client, test_data, tmp_path):
        from tasks.similarity_report import make_report
        lulu = test_data.user(LULU)
        lulu.first_name = PAYLOAD
        db.session.commit()
        assignment = Assignment.by_id(100)
        mine = Submission.load_or_new(assignment, lulu.id, 6)
        theirs = Submission.load_or_new(assignment, 101, 6)
        mine.save_code("answer.py", "print(1)")
        theirs.save_code("answer.py", "print(1)")
        index = make_report(str(tmp_path), [{mine: [(theirs, 99)], theirs: [(mine, 99)]}])
        for path in tmp_path.iterdir():
            text = path.read_text(encoding="utf-8")
            assert PAYLOAD not in text, path.name
        assert "&lt;img" in open(index, encoding="utf-8").read()

    def test_csv_safe(self):
        assert csv_safe("=HYPERLINK(1)") == "'=HYPERLINK(1)"
        assert csv_safe("+1") == "'+1"
        assert csv_safe("-1") == "'-1"
        assert csv_safe("@x") == "'@x"
        assert csv_safe("plain") == "plain"
        assert csv_safe(5) == 5
        assert csv_safe(None) is None


class TestExamTimer:
    URL = '/blockpy/start_assignment'

    @pytest.fixture
    def group_submissions(self, client, test_data):
        lulu = test_data.user(LULU)
        return [Submission.load_or_new(Assignment.by_id(aid), lulu.id, 6) for aid in (100, 101, 102)]

    def test_student_cannot_choose_start_time(self, client, test_data, act_as, group_submissions):
        act_as(test_data.user(LULU))
        data = client.post(self.URL, data={
            "assignment_group_id": 1, "course_id": 6, "date_started": "2020-01-01T00:00:00+00:00"}).get_json()
        assert data['success'] is True
        started = Submission.by_id(group_submissions[0].id).date_started
        assert started is not None and started.year >= 2026

    def test_student_cannot_restart_or_clear(self, client, test_data, act_as, group_submissions):
        act_as(test_data.user(LULU))
        client.post(self.URL, data={"assignment_group_id": 1, "course_id": 6, "date_started": "2020-01-01T00:00:00+00:00"})
        first = Submission.by_id(group_submissions[0].id).date_started
        client.post(self.URL, data={"assignment_group_id": 1, "course_id": 6, "date_started": "2030-01-01T00:00:00+00:00"})
        assert Submission.by_id(group_submissions[0].id).date_started == first
        data = client.post(self.URL, data={"assignment_group_id": 1, "course_id": 6, "date_started": "clear"}).get_json()
        assert data['success'] is False
        assert Submission.by_id(group_submissions[0].id).date_started == first

    def test_grader_can_set_and_clear(self, client, test_data, act_as, group_submissions):
        act_as(test_data.user(ADA))
        client.post(self.URL, data={"assignment_group_id": 1, "course_id": 6, "student_id": 100,
                                    "date_started": "2020-01-01T00:00:00+00:00"})
        assert Submission.by_id(group_submissions[0].id).date_started.year == 2020
        data = client.post(self.URL, data={"assignment_group_id": 1, "course_id": 6, "student_id": 100,
                                           "date_started": "clear"}).get_json()
        assert data['success'] is True
        assert Submission.by_id(group_submissions[0].id).date_started is None


class TestUsersLookup:

    def test_grader_cannot_look_up_users_outside_course(self, client, test_data, act_as):
        act_as(test_data.user(CAPTAIN))
        data = client.get('/courses/users', query_string={"course_id": 14, "user_ids": "100,10"}).get_json()
        assert data['users'] == []
        assert len(data['errors']) == 2

    def test_grader_can_look_up_members(self, client, test_data, act_as):
        act_as(test_data.user(ADA))
        data = client.get('/courses/users', query_string={"course_id": 6, "user_ids": "100"}).get_json()
        assert [u['id'] for u in data['users']] == [100]

    def test_anonymous_can_still_ask_about_themselves(self, client, test_data):
        me = client.get('/whoami').get_json()
        data = client.get('/courses/users', query_string={"course_id": 2, "user_ids": me['id']}).get_json()
        assert [u['id'] for u in data['users']] == [me['id']]


class TestBulkGradeUpload:
    URL = '/grading/bulk_update_submission'

    def upload(self, client, bundle):
        return client.post(self.URL, data={"file": (io.BytesIO(json.dumps(bundle).encode()), "grades.json")},
                           content_type='multipart/form-data', follow_redirects=True)

    def test_anonymous_is_redirected(self, client, test_data):
        response = client.post(self.URL, data={"file": (io.BytesIO(b"[]"), "grades.json")},
                               content_type='multipart/form-data')
        assert response.status_code == 302

    def test_non_grader_writes_no_log_rows(self, client, test_data, act_as):
        submission = Submission.load_or_new(Assignment.by_id(100), 100, 6)
        before = SubmissionLog.query.filter_by(submission_id=submission.id).count()
        act_as(test_data.user(CAPTAIN))
        response = self.upload(client, [{"submission_id": submission.id, "score": 100, "correct": True, "message": "x"}])
        assert response.status_code == 200
        assert SubmissionLog.query.filter_by(submission_id=submission.id).count() == before
        assert Submission.by_id(submission.id).score != 100

    def test_garbage_does_not_500(self, client, test_data, act_as):
        act_as(test_data.user(ADA))
        response = client.post(self.URL, data={"file": (io.BytesIO(b"{not json"), "grades.json")},
                               content_type='multipart/form-data', follow_redirects=True)
        assert response.status_code == 200


class TestGradingScriptRoute:
    URL = '/blockpy/load_assignment_give_feedback'

    def test_passcode_is_enforced(self, client, test_data):
        assignment = Assignment.by_id(110)
        assignment.edit({"on_run": "secret grading code", "settings": json.dumps({"passcode": "open-sesame"})})
        data = client.get(self.URL, query_string={"assignment_id": 110}).get_json()
        assert data['success'] is False
        assert 'secret grading code' not in json.dumps(data)
        data = client.get(self.URL, query_string={"assignment_id": 110, "passcode": "open-sesame"}).get_json()
        assert data['give_feedback'] == "secret grading code"

    def test_unknown_assignment_is_not_a_500(self, client, test_data):
        response = client.get(self.URL, query_string={"assignment_id": 999999})
        assert response.status_code == 200
        assert response.get_json()['success'] is False


class TestAdminIndex:

    def test_anonymous_and_instructors_get_403(self, client, test_data, act_as):
        assert client.get('/admin/').status_code == 403
        act_as(test_data.user(ADA))
        assert client.get('/admin/').status_code == 403

    def test_admin_can_open_index(self, client, test_data, act_as):
        from models.role import Role
        from models.enums import UserRoles
        Role.new(UserRoles.ADMIN, user_id=50, course_id=None)
        act_as(test_data.user("pico@blockpy.com"))
        assert client.get('/admin/').status_code == 200
