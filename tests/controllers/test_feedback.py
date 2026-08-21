"""
Tests for FEEDBACK assignments: the course feedback editor dashboard and
the bulk submission update API endpoint.
"""
import json

import pytest

from models.assignment import Assignment
from models.submission import Submission


@pytest.fixture
def feedback_assignment(client, test_data):
    """ A FEEDBACK assignment in course 6 (cs1_f20), owned by Ada (10). """
    return Assignment.new(owner_id=10, course_id=6, type='feedback',
                          name='Project 1 Feedback', url='project_1_feedback')


def make_feedback_code(contents, published):
    return json.dumps({"contents": contents, "published": published})


class TestFeedbackEditorPage:
    """ Test the /courses/feedback_editor/<course_id> dashboard. """

    def test_anonymous_blocked(self, client, test_data, feedback_assignment):
        # Anonymous visitors get an anonymous identity, so they reach the
        # grader check rather than a login redirect
        response = client.get('/courses/feedback_editor/6')
        assert (response.status_code == 302
                or b'You are not an instructor or TA in this course!' in response.data)

    def test_student_blocked(self, client, test_data, act_as, feedback_assignment):
        # Lulu (100) is a learner in course 6
        act_as(test_data.user("lulu@blockpy.com"))
        response = client.get('/courses/feedback_editor/6')
        assert response.status_code == 200
        assert b'You are not an instructor or TA in this course!' in response.data

    def test_instructor_sees_dropdown(self, client, test_data, act_as, feedback_assignment):
        # Ada (10) is an instructor in course 6
        act_as(test_data.user("ada@blockpy.com"))
        response = client.get('/courses/feedback_editor/6')
        assert response.status_code == 200
        assert b'Project 1 Feedback' in response.data

    def test_instructor_sees_student_rows(self, client, test_data, act_as, feedback_assignment):
        act_as(test_data.user("ada@blockpy.com"))
        response = client.get('/courses/feedback_editor/6',
                              query_string={"assignment_id": feedback_assignment.id})
        assert response.status_code == 200
        # Lulu is a student in course 6, so she should have a row
        assert b'lulu@blockpy.com' in response.data
        assert b'No submission yet' in response.data

    def test_instructor_sees_existing_contents(self, client, test_data, act_as, feedback_assignment):
        act_as(test_data.user("ada@blockpy.com"))
        submission = Submission.load_or_new(feedback_assignment, 100, 6)
        submission.save_code('answer.py', make_feedback_code("Great work on recursion!", True))
        response = client.get('/courses/feedback_editor/6',
                              query_string={"assignment_id": feedback_assignment.id})
        assert response.status_code == 200
        assert b'Great work on recursion!' in response.data

    def test_rejects_non_feedback_assignment(self, client, test_data, act_as, feedback_assignment):
        act_as(test_data.user("ada@blockpy.com"))
        # Assignment 100 is a BlockPy assignment in course 6
        response = client.get('/courses/feedback_editor/6',
                              query_string={"assignment_id": 100})
        assert b'not a Feedback assignment' in response.data


class TestBulkUpdateSubmissions:
    """ Test the /api/bulk_update_submissions endpoint. """

    URL = '/api/bulk_update_submissions'

    def test_anonymous_cannot_update(self, client, test_data, feedback_assignment):
        response = client.post(self.URL, json={"updates": [
            {"course_id": 6, "user_id": 100, "assignment_id": feedback_assignment.id,
             "code": make_feedback_code("Anonymous mischief", True)}
        ]})
        if response.status_code == 200:
            data = response.get_json()
            assert len(data.get('updated', [])) == 0
        else:
            assert response.status_code in (302, 403)
        assert Submission.get_submission(feedback_assignment.id, 100, 6) is None

    def test_requires_updates_list(self, client, test_data, act_as):
        act_as(test_data.user("ada@blockpy.com"))
        response = client.post(self.URL, json={})
        assert response.get_json()['success'] is False

    def test_student_cannot_update(self, client, test_data, act_as, feedback_assignment):
        act_as(test_data.user("lulu@blockpy.com"))
        response = client.post(self.URL, json={"updates": [
            {"course_id": 6, "user_id": 100, "assignment_id": feedback_assignment.id,
             "code": make_feedback_code("Sneaky self-feedback", True)}
        ]})
        data = response.get_json()
        assert data['success'] is True
        assert len(data['updated']) == 0
        assert len(data['errors']) == 1
        assert 'not a grader' in data['errors'][0]['message']
        # And no submission was created for them
        assert Submission.get_submission(feedback_assignment.id, 100, 6) is None

    def test_instructor_creates_submission_by_triple(self, client, test_data, act_as, feedback_assignment):
        act_as(test_data.user("ada@blockpy.com"))
        code = make_feedback_code("You should review loops.", False)
        response = client.post(self.URL, json={"updates": [
            {"course_id": 6, "user_id": 100, "assignment_id": feedback_assignment.id, "code": code}
        ]})
        data = response.get_json()
        assert data['success'] is True
        assert data['errors'] == []
        assert len(data['updated']) == 1
        submission = Submission.get_submission(feedback_assignment.id, 100, 6)
        assert submission is not None
        assert submission.code == code
        assert data['updated'][0]['submission_id'] == submission.id

    def test_instructor_updates_by_submission_id(self, client, test_data, act_as, feedback_assignment):
        act_as(test_data.user("ada@blockpy.com"))
        submission = Submission.load_or_new(feedback_assignment, 100, 6)
        code = make_feedback_code("Nice improvement!", True)
        response = client.post(self.URL, json={"updates": [
            {"submission_id": submission.id, "code": code}
        ]})
        data = response.get_json()
        assert data['success'] is True
        assert data['errors'] == []
        assert len(data['updated']) == 1
        assert Submission.by_id(submission.id).code == code

    def test_mixed_batch_reports_row_errors(self, client, test_data, act_as, feedback_assignment):
        act_as(test_data.user("ada@blockpy.com"))
        response = client.post(self.URL, json={"updates": [
            {"course_id": 6, "user_id": 100, "assignment_id": feedback_assignment.id,
             "code": make_feedback_code("Valid update", False)},
            {"course_id": 6, "user_id": 100, "assignment_id": 999999,
             "code": make_feedback_code("Bad assignment", False)},
            {"course_id": 6, "user_id": 100, "code": make_feedback_code("Missing id", False)},
            {"code": 12345},
        ]})
        data = response.get_json()
        assert data['success'] is True
        assert len(data['updated']) == 1
        assert len(data['errors']) == 3

    def test_instructor_cannot_update_other_courses(self, client, test_data, act_as):
        # Babbage (11) is an instructor in course 3, but not course 6
        babbage = test_data.user("babbage@blockpy.com")
        other_assignment = Assignment.new(owner_id=babbage.id, course_id=3, type='feedback',
                                          name='Other Feedback', url='other_feedback')
        act_as(babbage)
        response = client.post(self.URL, json={"updates": [
            {"course_id": 6, "user_id": 100, "assignment_id": other_assignment.id,
             "code": make_feedback_code("Not my course", True)}
        ]})
        data = response.get_json()
        assert data['success'] is True
        assert len(data['updated']) == 0
        assert len(data['errors']) == 1
        assert 'not a grader' in data['errors'][0]['message']
