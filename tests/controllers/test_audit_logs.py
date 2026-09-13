"""
Tests for the audit log tables (course_log, role_log, assignment_log) and the bug
fixes made on the way to wiring them up. See docs/specs/audit-logging-review.md.

Seed data used throughout: Ada (10) is an instructor of course 6 via role 102; Lulu (100)
is a learner in course 6 via role 1000; course 3 is owned by Babbage (11) and holds
assignment 120; assignment 100 is in course 6.
"""
import pytest
from werkzeug.exceptions import Forbidden

from models import db
from models.assignment_group import AssignmentGroup
from models.course import Course
from models.enums import CourseLogEvent, UserRoles
from models.generics.definitions import LogEventType
from models.log_tables import CourseLog
from models.role import Role


class TestPhase1Fixes:

    def test_update_role_accepts_valid_role(self, app, test_data):
        role = Role.by_id(1000)
        assert role.update_role("proctor") == "proctor"
        assert Role.by_id(1000).name == UserRoles.PROCTOR

    def test_update_role_rejects_bogus_role(self, app, test_data):
        role = Role.by_id(1000)
        assert role.update_role("bogus") is None
        assert Role.by_id(1000).name == UserRoles.LEARNER

    def test_change_role_endpoint(self, client, test_data, act_as):
        act_as(test_data.user("ada@blockpy.com"))
        response = client.post('/courses/change_role',
                               data={"role_id": 1000, "new_role": "teachingassistant"})
        assert response.status_code == 200
        assert response.get_json()["success"] is True
        assert Role.by_id(1000).name == UserRoles.TA

    def test_set_setting_logs_corrupted_settings(self, app, test_data):
        course = Course.by_id(6)
        course.settings = "{not json"
        db.session.commit()
        course.set_setting("pinned", True, 10)
        assert course.get_setting("pinned", None) is True
        logs = CourseLog.query.filter_by(course_id=6, event_type=CourseLogEvent.CORRUPTED).all()
        assert len(logs) == 1
        assert logs[0].field == "settings"
        assert logs[0].value == "{not json"
        assert logs[0].subject_id == 10

    def test_edit_textbooks_with_corrupted_settings(self, client, test_data, act_as):
        course = Course.by_id(6)
        course.settings = "{not json"
        db.session.commit()
        act_as(test_data.user("ada@blockpy.com"))
        response = client.post('/courses/edit_textbooks',
                               data={"course_id": 6, "action": "add", "textbook_url": "some_textbook"})
        assert response.status_code == 302
        assert Course.by_id(6).get_setting("textbooks", []) == ["some_textbook"]

    def test_require_course_instructor_as_html_is_forbidden(self, app, test_data):
        from controllers.helpers import require_course_instructor
        lulu = test_data.user("lulu@blockpy.com")
        with pytest.raises(Forbidden):
            require_course_instructor(lulu, 6, as_html=True)

    def test_fork_group_through_blockpy(self, client, test_data, act_as):
        act_as(test_data.user("ada@blockpy.com"))
        before = {group.id for group in AssignmentGroup.by_course(6)}
        response = client.post('/blockpy/fork_assignment',
                               data={"assignment_group_id": 1, "course_id": 6})
        assert response.get_json()["success"] is True
        new_ids = {group.id for group in AssignmentGroup.by_course(6)} - before
        assert len(new_ids) == 1
        new_group = AssignmentGroup.by_id(new_ids.pop())
        assert new_group.forked_id == 1
        assert new_group.course_id == 6
        assert len(new_group.get_assignments()) == 3

    def test_log_event_type_aliases(self):
        assert LogEventType.LMS_SUBMISSION == "X-Submission.LMS"
        assert LogEventType.SUBMIT == "Submit"
