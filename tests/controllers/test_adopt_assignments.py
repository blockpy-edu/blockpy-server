"""
Tests for the "Adopt Assignments" instructor menu: reusing assignments and groups
from other courses by creating (and deleting) instructor submissions.
"""
import pytest

from models import db
from models.assignment import Assignment
from models.course import Course
from models.log_tables import SubmissionLog
from models.submission import Submission


URL = '/courses/adopt_assignments/6'
# Course 3 (cs2) is public and owned by Babbage (11); Ada (10) has no role there.
# It owns assignment 120 ("CS2 Homework 1") in group 10 ("CS2 Homework").
SOURCE = {"source_course_id": 3}


def adopt(client, **values):
    return client.post(URL, data={**SOURCE, "action": "adopt_assignment", **values}, follow_redirects=True)


def unadopt(client, **values):
    return client.post(URL, data={**SOURCE, "action": "unadopt_assignment", **values}, follow_redirects=True)


class TestAdoptAssignmentsPermissions:

    def test_anonymous_blocked(self, client, test_data):
        response = client.get(URL)
        assert (response.status_code == 302
                or b'You are not an instructor' in response.data)

    def test_student_blocked(self, client, test_data, act_as):
        # Lulu (100) is a learner in course 6
        act_as(test_data.user("lulu@blockpy.com"))
        response = client.get(URL)
        assert b'You are not an instructor' in response.data
        assert b'Choose a course to adopt from' not in response.data

    def test_cannot_adopt_from_private_course_without_role(self, client, test_data, act_as):
        # Course 14 is private and Ada has no role in it
        act_as(test_data.user("ada@blockpy.com"))
        response = client.get(URL, query_string={"source_course_id": 14})
        assert b'do not have permission' in response.data

    def test_cannot_adopt_from_self(self, client, test_data, act_as):
        act_as(test_data.user("ada@blockpy.com"))
        response = client.get(URL, query_string={"source_course_id": 6})
        assert b'from the course itself' in response.data

    def test_adopter_role_allows_private_course(self, client, test_data, act_as):
        # Course 51 is private; Ada is a content developer there (role 11)
        act_as(test_data.user("ada@blockpy.com"))
        response = client.get(URL, query_string={"source_course_id": 51})
        assert response.status_code == 200
        assert b'Adopting from: CS1 Exams Honors' in response.data


class TestAdoptAssignmentsPages:

    def test_course_list(self, client, test_data, act_as):
        act_as(test_data.user("ada@blockpy.com"))
        response = client.get(URL)
        assert response.status_code == 200
        assert b'Choose a course to adopt from' in response.data
        # Private course where Ada is an instructor
        assert b'Introduction to CS1 Fall 2021' in response.data
        # Public course where Ada has no role
        assert b'Introduction to CS2' in response.data
        # Not the course itself
        assert b'source_course_id=6"' not in response.data
        # Private course with no role
        assert b'Section 010' not in response.data

    def test_source_course_lists_groups_and_assignments(self, client, test_data, act_as):
        act_as(test_data.user("ada@blockpy.com"))
        response = client.get(URL, query_string=SOURCE)
        assert response.status_code == 200
        assert b'CS2 Homework' in response.data
        assert b'CS2 Homework 1' in response.data
        assert b'Not adopted' in response.data
        assert b'Adopt Entire Group' in response.data

    def test_dashboard_links_to_menu(self, client, test_data, act_as):
        act_as(test_data.user("ada@blockpy.com"))
        response = client.get('/courses/6')
        assert b'Adopt Assignments' in response.data


class TestAdoptAndUnadopt:

    def test_adopt_assignment_creates_instructor_submission(self, client, test_data, act_as):
        act_as(test_data.user("ada@blockpy.com"))
        assert Submission.get_submission(120, 10, 6) is None
        response = adopt(client, assignment_id=120)
        assert response.status_code == 200
        assert b'Adopted 1 assignment(s).' in response.data
        submission = Submission.get_submission(120, 10, 6)
        assert submission is not None
        assert submission.course_id == 6
        assert submission.assignment_group_id is None
        # The assignment now shows up in the course
        course = Course.by_id(6)
        submitted = {row.Assignment.id for row in course.get_submitted_assignments_grouped()}
        assert 120 in submitted
        # And the page reflects the change
        assert b'your submission is unmodified' in response.data
        assert b'Unadopt' in response.data

    def test_adopt_assignment_is_idempotent(self, client, test_data, act_as):
        act_as(test_data.user("ada@blockpy.com"))
        adopt(client, assignment_id=120)
        response = adopt(client, assignment_id=120)
        assert b'Adopted 0 assignment(s). 1 were already adopted.' in response.data
        assert Submission.query.filter_by(assignment_id=120, course_id=6).count() == 1

    def test_adopt_group(self, client, test_data, act_as):
        act_as(test_data.user("ada@blockpy.com"))
        response = client.post(URL, data={**SOURCE, "action": "adopt_group", "assignment_group_id": 10},
                               follow_redirects=True)
        assert b'Adopted 1 assignment(s).' in response.data
        submission = Submission.get_submission(120, 10, 6)
        assert submission is not None
        assert submission.assignment_group_id == 10

    def test_adopt_rejects_assignment_outside_source(self, client, test_data, act_as):
        act_as(test_data.user("ada@blockpy.com"))
        # Assignment 110 belongs to course 8, not course 3
        response = adopt(client, assignment_id=110)
        assert b'not part of the source course' in response.data
        assert Submission.get_submission(110, 10, 6) is None

    def test_adopt_rejects_group_outside_source(self, client, test_data, act_as):
        act_as(test_data.user("ada@blockpy.com"))
        response = client.post(URL, data={**SOURCE, "action": "adopt_group", "assignment_group_id": 5},
                               follow_redirects=True)
        assert b'not part of the source course' in response.data

    def test_unadopt_deletes_unmodified_submission(self, client, test_data, act_as):
        act_as(test_data.user("ada@blockpy.com"))
        adopt(client, assignment_id=120)
        submission_id = Submission.get_submission(120, 10, 6).id
        assert SubmissionLog.query.filter_by(submission_id=submission_id).count() > 0
        response = unadopt(client, assignment_id=120)
        assert b'Unadopted 1 assignment(s).' in response.data
        assert Submission.get_submission(120, 10, 6) is None
        assert SubmissionLog.query.filter_by(submission_id=submission_id).count() == 0
        assert b'Not adopted' in response.data

    def test_unadopt_blocked_when_others_have_submissions(self, client, test_data, act_as):
        act_as(test_data.user("ada@blockpy.com"))
        adopt(client, assignment_id=120)
        # Lulu (100), a student in course 6, starts the assignment
        Submission.load_or_new(Assignment.by_id(120), 100, 6)
        response = client.get(URL, query_string=SOURCE)
        assert b'Cannot unadopt (in use)' in response.data
        assert b'1 other submission in this course' in response.data
        response = unadopt(client, assignment_id=120)
        assert b'Cannot unadopt 1 assignment(s) because other users have submissions' in response.data
        assert Submission.get_submission(120, 10, 6) is not None

    def test_unadopt_warns_about_changes_unless_forced(self, client, test_data, act_as):
        act_as(test_data.user("ada@blockpy.com"))
        adopt(client, assignment_id=120)
        submission = Submission.get_submission(120, 10, 6)
        submission.save_code('answer.py', 'print("edited by instructor")')
        assert submission.version > 0
        response = client.get(URL, query_string=SOURCE)
        assert b'your submission has changes' in response.data
        # Without force, the unadopt is refused with a warning
        response = unadopt(client, assignment_id=120)
        assert b'Your submission has changes' in response.data
        assert b'Unadopted' not in response.data
        assert Submission.get_submission(120, 10, 6) is not None
        # With force, it goes through
        response = unadopt(client, assignment_id=120, force="true")
        assert b'Unadopted 1 assignment(s).' in response.data
        assert Submission.get_submission(120, 10, 6) is None

    def test_unadopt_group(self, client, test_data, act_as):
        act_as(test_data.user("ada@blockpy.com"))
        client.post(URL, data={**SOURCE, "action": "adopt_group", "assignment_group_id": 10},
                    follow_redirects=True)
        assert Submission.get_submission(120, 10, 6) is not None
        response = client.post(URL, data={**SOURCE, "action": "unadopt_group", "assignment_group_id": 10},
                               follow_redirects=True)
        assert b'Unadopted 1 assignment(s).' in response.data
        assert Submission.get_submission(120, 10, 6) is None

    def test_unadopt_nothing_when_not_adopted(self, client, test_data, act_as):
        act_as(test_data.user("ada@blockpy.com"))
        response = unadopt(client, assignment_id=120)
        assert b'Unadopted 0 assignment(s).' in response.data

    def test_student_cannot_adopt(self, client, test_data, act_as):
        act_as(test_data.user("lulu@blockpy.com"))
        response = adopt(client, assignment_id=120)
        assert b'You are not an instructor' in response.data
        assert Submission.query.filter_by(assignment_id=120, course_id=6).count() == 0

    def test_feedback_editor_sees_adopted_feedback_assignment(self, client, test_data, act_as):
        # A FEEDBACK assignment owned by course 3 (Babbage's public course)
        feedback = Assignment.new(owner_id=11, course_id=3, type='feedback',
                                  name='Adopted Feedback', url='adopted_feedback')
        act_as(test_data.user("ada@blockpy.com"))
        response = client.get('/courses/feedback_editor/6')
        assert b'Adopted Feedback' not in response.data
        adopt(client, assignment_id=feedback.id)
        response = client.get('/courses/feedback_editor/6')
        assert b'Adopted Feedback' in response.data
