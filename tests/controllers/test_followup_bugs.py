"""
Tests for the fixes approved in docs/specs/audit-logging-followup-bugs.md (B1 to B7).
"""
import pytest
from click.testing import CliRunner

from models import db
from models.assignment import Assignment
from models.assignment_group import AssignmentGroup
from models.assignment_group_membership import AssignmentGroupMembership
from models.course import Course, CourseHasSubmissions
from models.enums import CourseLogEvent, RoleLogEvent
from models.log_tables import CourseLog, RoleLog
from models.role import Role
from models.submission import Submission
from models.user import User


class TestGroupRemoval:
    """ B1 """

    def test_memberships_and_submissions_are_detached_first(self, client, test_data, act_as):
        submission = Submission.load_or_new(Assignment.by_id(100), 100, 6, assignment_group_id=1)
        assert submission.assignment_group_id == 1
        act_as(test_data.user("ada@blockpy.com"))
        response = client.post('/assignment_group/remove', data={"assignment_group_id": 1})
        assert response.get_json()["success"] is True
        assert AssignmentGroup.by_id(1) is None
        assert AssignmentGroupMembership.query.filter_by(assignment_group_id=1).count() == 0
        assert Submission.by_id(submission.id).assignment_group_id is None
        # The assignments themselves stay
        assert Assignment.by_id(100) is not None


class TestCourseRemoval:
    """ B2 """

    def test_web_removal_of_empty_course_is_complete(self, client, test_data, act_as):
        Role.by_id(1000).update_role("proctor", authorizer_id=10)
        act_as(test_data.user("admin@blockpy.com"))
        response = client.post('/courses/remove', data={"course_id": 6})
        assert response.status_code == 302
        assert Course.by_id(6) is None
        assert Role.query.filter_by(course_id=6).count() == 0
        assert Assignment.query.filter_by(course_id=6).count() == 0
        assert AssignmentGroup.query.filter_by(course_id=6).count() == 0
        assert AssignmentGroupMembership.query.filter(
            AssignmentGroupMembership.assignment_group_id.in_([1, 2, 3, 4])).count() == 0
        # Audit rows outlive the course
        assert CourseLog.query.filter_by(course_id=6, event_type=CourseLogEvent.DELETE).one().subject_id == 1
        assert RoleLog.query.filter_by(course_id=6, event_type=RoleLogEvent.CHANGED).count() == 1

    def test_web_removal_refuses_course_with_submissions(self, client, test_data, act_as):
        Submission.load_or_new(Assignment.by_id(100), 100, 6)
        act_as(test_data.user("admin@blockpy.com"))
        response = client.post('/courses/remove', data={"course_id": 6}, follow_redirects=True)
        assert b'Course not removed' in response.data
        assert b'archived' in response.data
        assert Course.by_id(6) is not None
        assert Submission.query.filter_by(course_id=6).count() == 1
        assert CourseLog.query.filter_by(course_id=6, event_type=CourseLogEvent.DELETE).count() == 0

    def test_work_on_owned_assignment_elsewhere_blocks_removal(self, app, test_data):
        # Ada adopts assignment 120 (owned by course 3) into course 6
        Submission.load_or_new(Assignment.by_id(120), 10, 6)
        assert Course.count_submissions_blocking_removal(3) == 1
        with pytest.raises(CourseHasSubmissions):
            Course.remove(3)
        assert Course.by_id(3) is not None
        assert Assignment.by_id(120) is not None

    def test_cli_removal_needs_remove_linked_for_student_work(self, app, test_data):
        from scripts.db_commands import delete_course
        Submission.load_or_new(Assignment.by_id(100), 100, 6)
        result = CliRunner().invoke(delete_course, ['--course', '6'])
        assert result.exit_code != 0
        assert 'submission' in result.output
        assert Course.by_id(6) is not None
        result = CliRunner().invoke(delete_course, ['--course', '6', '--remove-linked'], input='y\n')
        assert result.exit_code == 0, result.output
        assert Course.by_id(6) is None
        assert Submission.query.filter_by(course_id=6).count() == 0
        assert Assignment.query.filter_by(course_id=6).count() == 0
        assert CourseLog.query.filter_by(course_id=6, event_type=CourseLogEvent.DELETE).one().subject_id == 1

    def test_cli_refuses_missing_course(self, app, test_data):
        from scripts.db_commands import delete_course
        result = CliRunner().invoke(delete_course, ['--course', '9999'])
        assert result.exit_code != 0


class TestAddNewUser:
    """ B3 """

    def test_new_email_creates_user_with_unusable_password(self, client, test_data, act_as):
        from flask_security.utils import verify_password
        act_as(test_data.user("ada@blockpy.com"))
        response = client.post('/courses/add_users/6', data={"new_users": "newbie@blockpy.com", "role": "learner"})
        assert response.status_code == 302
        newbie = User.find_student("newbie@blockpy.com")
        assert newbie is not None
        assert newbie.password
        assert not verify_password("", newbie.password)
        assert newbie.is_student(6)
        logs = RoleLog.query.filter_by(subject_id=newbie.id).all()
        assert [(log.event_type, log.event_value, log.authorizer_id) for log in logs] == [(RoleLogEvent.GIVEN, "learner", 10)]

    def test_new_from_instructor_without_password(self, app, test_data):
        from flask_security.utils import verify_password
        user = User.new_from_instructor("second@blockpy.com")
        assert user.password
        assert not verify_password("", user.password)
        with_password = User.new_from_instructor("third@blockpy.com", password="hunter2")
        assert verify_password("hunter2", with_password.password)


class TestSubmissionTransfer:
    """ B4 """

    def test_transfer_keeps_each_submission_url(self, client, test_data, act_as):
        old = Submission.load_or_new(Assignment.by_id(100), 100, 6)
        old.code = "print(1)"
        db.session.commit()
        assert old.url
        old_url, old_id = old.url, old.id
        act_as(test_data.user("ada@blockpy.com"))
        response = client.post('/assignments/transfer_course', data={"submission_id": old_id, "new_course_id": 8})
        assert response.get_json()["success"] is True
        new = Submission.get_submission(100, 100, 8)
        assert new is not None
        assert new.code == "print(1)"
        assert new.url and new.url != old_url
        assert Submission.by_id(old_id).url == old_url


class TestAnonymousCleanup:
    """ B6 """

    def test_course_owned_by_anonymous_user_is_walkable(self, app, test_data):
        from models.generics.base import find_all_linked_resources, mass_delete
        anonymous = User.by_id(1000)
        course = Course.new("Anon course", anonymous.id, "private", "", "anon_course")
        course_id = course.id
        graph = find_all_linked_resources([anonymous])
        assert course in graph['Course']
        assert len(graph['CourseLog']) == 1
        assert len(graph['RoleLog']) == 1
        graph.setdefault('User', []).append(anonymous)
        mass_delete(graph)
        assert Course.by_id(course_id) is None
        assert CourseLog.query.filter_by(course_id=course_id).count() == 0
        assert User.by_id(1000) is None


class TestActAs:
    """ B7 """

    def test_can_switch_users_within_a_test(self, client, test_data, act_as):
        act_as(test_data.user("ada@blockpy.com"))
        assert b'Signed in as Ada' in client.get('/courses/').data
        act_as(test_data.user("admin@blockpy.com"))
        assert b'Signed in as Admin' in client.get('/courses/').data
        assert client.get('/admin/course/').status_code == 200
        act_as(test_data.user("lulu@blockpy.com"))
        assert client.get('/admin/course/').status_code == 403
