"""
Regression tests for pre-semester security hardening:
- grading status changes require grader permission (all branches)
- task-launching API endpoints require grader permission
- report endpoints handle missing reports without a 500
- unpublished feedback never leaves the server for non-graders
- students cannot rewrite/self-publish their own feedback submissions
- bulk_update_submissions validates assignment/user membership in the course
"""
import json

import pytest

from models.assignment import Assignment
from models.submission import Submission, GradingStatuses


@pytest.fixture
def feedback_assignment(client, test_data):
    """ A FEEDBACK assignment in course 6 (cs1_f20), owned by Ada (10). """
    return Assignment.new(owner_id=10, course_id=6, type='feedback',
                          name='Project 1 Feedback', url='project_1_feedback')


@pytest.fixture
def blockpy_submission(client, test_data):
    """ Lulu's (100) submission to BlockPy assignment 100 in course 6. """
    assignment = Assignment.by_id(100)
    return Submission.load_or_new(assignment, 100, 6)


def make_feedback_code(contents, published):
    return json.dumps({"contents": contents, "published": published})


class TestUpdateGradingStatus:
    URL = '/grading/update_grading_status'

    def test_anonymous_cannot_change_status(self, client, test_data, blockpy_submission):
        original = blockpy_submission.grading_status
        response = client.post(self.URL, data={
            "submission_id": blockpy_submission.id,
            "new_grading_status": GradingStatuses.PENDING_MANUAL})
        data = response.get_json()
        assert data['success'] is False
        assert Submission.by_id(blockpy_submission.id).grading_status == original

    def test_student_cannot_change_status(self, client, test_data, act_as, blockpy_submission):
        original = blockpy_submission.grading_status
        act_as(test_data.user("lulu@blockpy.com"))
        response = client.post(self.URL, data={
            "submission_id": blockpy_submission.id,
            "new_grading_status": GradingStatuses.PENDING_MANUAL})
        data = response.get_json()
        assert data['success'] is False
        assert Submission.by_id(blockpy_submission.id).grading_status == original

    def test_instructor_can_change_status(self, client, test_data, act_as, blockpy_submission):
        act_as(test_data.user("ada@blockpy.com"))
        response = client.post(self.URL, data={
            "submission_id": blockpy_submission.id,
            "new_grading_status": GradingStatuses.PENDING_MANUAL})
        data = response.get_json()
        assert data['success'] is True
        assert Submission.by_id(blockpy_submission.id).grading_status == GradingStatuses.PENDING_MANUAL


class TestTaskEndpointsRequireGrader:

    def test_anonymous_cannot_launch_similarity(self, client, test_data):
        response = client.get('/api/check_similarity_simple/100/6')
        data = response.get_json()
        assert data['success'] is False
        assert 'not a grader' in data['message']

    def test_student_cannot_launch_similarity(self, client, test_data, act_as):
        act_as(test_data.user("lulu@blockpy.com"))
        response = client.get('/api/check_similarity_simple/100/6')
        data = response.get_json()
        assert data['success'] is False
        assert 'not a grader' in data['message']

    def test_anonymous_cannot_launch_full_similarity(self, client, test_data):
        response = client.get('/api/check_similarity/100/6')
        data = response.get_json()
        assert data['success'] is False
        assert 'not a grader' in data['message']

    def test_anonymous_cannot_dump_events(self, client, test_data):
        response = client.get('/api/long_task/6/100')
        data = response.get_json()
        assert data['success'] is False
        assert 'not a grader' in data['message']

    def test_anonymous_cannot_make_red_flag_report(self, client, test_data):
        response = client.post('/api/make_red_flag_report/6')
        data = response.get_json()
        assert data['success'] is False
        assert 'not a grader' in data['message']

    def test_instructor_can_view_red_flag_report_page(self, client, test_data, act_as):
        act_as(test_data.user("ada@blockpy.com"))
        response = client.get('/api/make_red_flag_report/6')
        assert response.status_code == 200

    def test_missing_report_is_not_a_500(self, client, test_data, act_as):
        act_as(test_data.user("ada@blockpy.com"))
        response = client.get('/api/report/999999')
        assert response.status_code == 200
        assert response.get_json()['success'] is False


class TestFeedbackPublishGating:
    LOAD_URL = '/blockpy/load_assignment'

    def load_as(self, client, feedback_assignment):
        response = client.get(self.LOAD_URL, query_string={
            "assignment_id": feedback_assignment.id, "course_id": 6})
        assert response.status_code == 200
        return response.get_json()

    def test_student_cannot_read_unpublished_feedback(self, client, test_data, act_as, feedback_assignment):
        submission = Submission.load_or_new(feedback_assignment, 100, 6)
        submission.save_code('answer.py', make_feedback_code("Draft: blunt notes", False))
        act_as(test_data.user("lulu@blockpy.com"))
        data = self.load_as(client, feedback_assignment)
        assert data['success'] is True
        assert 'Draft: blunt notes' not in json.dumps(data)

    def test_student_can_read_published_feedback(self, client, test_data, act_as, feedback_assignment):
        submission = Submission.load_or_new(feedback_assignment, 100, 6)
        submission.save_code('answer.py', make_feedback_code("Great job on loops!", True))
        act_as(test_data.user("lulu@blockpy.com"))
        data = self.load_as(client, feedback_assignment)
        assert data['success'] is True
        assert 'Great job on loops!' in data['submission']['code']

    def test_student_does_not_get_feedback_history(self, client, test_data, act_as, feedback_assignment):
        submission = Submission.load_or_new(feedback_assignment, 100, 6)
        submission.save_code('answer.py', make_feedback_code("Published now", True))
        act_as(test_data.user("lulu@blockpy.com"))
        response = client.get(self.LOAD_URL, query_string={
            "assignment_id": feedback_assignment.id, "course_id": 6, "with_history": "true"})
        data = response.get_json()
        assert data['success'] is True
        assert 'history' not in data

    def test_instructor_still_sees_draft(self, client, test_data, act_as, feedback_assignment):
        submission = Submission.load_or_new(feedback_assignment, 100, 6)
        submission.save_code('answer.py', make_feedback_code("Draft: blunt notes", False))
        act_as(test_data.user("ada@blockpy.com"))
        response = client.get(self.LOAD_URL, query_string={
            "assignment_id": feedback_assignment.id, "course_id": 6, "student_id": 100})
        data = response.get_json()
        assert data['success'] is True
        assert 'Draft: blunt notes' in data['submission']['code']


class TestFeedbackWriteProtection:
    SAVE_URL = '/blockpy/save_file'

    def test_student_cannot_rewrite_own_feedback(self, client, test_data, act_as, feedback_assignment):
        original = make_feedback_code("Needs work.", False)
        submission = Submission.load_or_new(feedback_assignment, 100, 6)
        submission.save_code('answer.py', original)
        act_as(test_data.user("lulu@blockpy.com"))
        response = client.post(self.SAVE_URL, data={
            "filename": "answer.py", "submission_id": submission.id,
            "course_id": 6, "code": make_feedback_code("A+ work", True)})
        data = response.get_json()
        assert data['success'] is False
        assert Submission.by_id(submission.id).code == original

    def test_instructor_can_write_feedback(self, client, test_data, act_as, feedback_assignment):
        submission = Submission.load_or_new(feedback_assignment, 100, 6)
        act_as(test_data.user("ada@blockpy.com"))
        new_code = make_feedback_code("Revised feedback.", True)
        response = client.post(self.SAVE_URL, data={
            "filename": "answer.py", "submission_id": submission.id,
            "course_id": 6, "code": new_code})
        data = response.get_json()
        assert data['success'] is True
        assert Submission.by_id(submission.id).code == new_code

    def test_student_can_still_save_normal_assignment(self, client, test_data, act_as, blockpy_submission):
        act_as(test_data.user("lulu@blockpy.com"))
        response = client.post(self.SAVE_URL, data={
            "filename": "answer.py", "submission_id": blockpy_submission.id,
            "course_id": 6, "code": "print('hello')"})
        data = response.get_json()
        assert data['success'] is True
        assert Submission.by_id(blockpy_submission.id).code == "print('hello')"


class TestBulkUpdateCoherence:
    URL = '/api/bulk_update_submissions'

    def test_assignment_must_belong_to_course(self, client, test_data, act_as):
        # Babbage (11) owns a feedback assignment in course 3; Ada is a grader
        # in course 6 but must not be able to mint course-6 submissions for it.
        other_assignment = Assignment.new(owner_id=11, course_id=3, type='feedback',
                                          name='Other Feedback', url='other_feedback')
        act_as(test_data.user("ada@blockpy.com"))
        response = client.post(self.URL, json={"updates": [
            {"course_id": 6, "user_id": 100, "assignment_id": other_assignment.id,
             "code": make_feedback_code("Cross-course mischief", True)}
        ]})
        data = response.get_json()
        assert data['success'] is True
        assert len(data['updated']) == 0
        assert 'not part of course' in data['errors'][0]['message']
        assert Submission.get_submission(other_assignment.id, 100, 6) is None

    def test_target_user_must_be_enrolled(self, client, test_data, act_as, feedback_assignment):
        # Babbage (11) is not enrolled in course 6.
        act_as(test_data.user("ada@blockpy.com"))
        response = client.post(self.URL, json={"updates": [
            {"course_id": 6, "user_id": 11, "assignment_id": feedback_assignment.id,
             "code": make_feedback_code("Feedback for a stranger", True)}
        ]})
        data = response.get_json()
        assert data['success'] is True
        assert len(data['updated']) == 0
        assert 'not enrolled' in data['errors'][0]['message']
        assert Submission.get_submission(feedback_assignment.id, 11, 6) is None

    def test_enrolled_user_and_owned_assignment_still_works(self, client, test_data, act_as, feedback_assignment):
        act_as(test_data.user("ada@blockpy.com"))
        code = make_feedback_code("Legitimate feedback.", False)
        response = client.post(self.URL, json={"updates": [
            {"course_id": 6, "user_id": 100, "assignment_id": feedback_assignment.id, "code": code}
        ]})
        data = response.get_json()
        assert data['success'] is True
        assert data['errors'] == []
        assert Submission.get_submission(feedback_assignment.id, 100, 6).code == code
