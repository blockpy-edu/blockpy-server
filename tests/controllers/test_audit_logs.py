"""
Tests for the audit log tables (course_log, role_log, assignment_log) and the bug
fixes made on the way to wiring them up. See docs/specs/audit-logging-review.md.

Seed data used throughout: Ada (10) is an instructor of course 6 via role 102 and of
course 8; Lulu (100) is a learner in course 6 via role 1000; course 3 is owned by
Babbage (11) and holds assignment 120 in group 10; assignment 100 is in course 6,
group 1; user 1 is the admin.
"""
import html as html_module
import json
import os
import re

import pytest
from werkzeug.exceptions import Forbidden

from models import db
from models.assignment import Assignment
from models.assignment_group import AssignmentGroup
from models.course import Course
from models.enums import CourseLogEvent, RoleLogEvent, UserRoles, AssignmentLogEvent
from models.generics.definitions import LogEventType
from models.log_tables import CourseLog, RoleLog, AssignmentLog
from models.role import Role
from models.submission import Submission
from models.user import User


def course_logs(course_id, event_type=None):
    query = CourseLog.query.filter_by(course_id=course_id)
    if event_type is not None:
        query = query.filter_by(event_type=event_type)
    return query.order_by(CourseLog.id).all()


def role_logs(**filters):
    return RoleLog.query.filter_by(**filters).order_by(RoleLog.id).all()


def assignment_logs(assignment_id):
    return AssignmentLog.query.filter_by(assignment_id=assignment_id).order_by(AssignmentLog.id).all()


def scrape_form(page):
    """ Turn a rendered Flask-Admin edit form into the data dict that would submit it unchanged. """
    data = {}
    for match in re.finditer(r'<input([^>]*)>', page):
        tag = match.group(1)
        name = re.search(r'name="([^"]+)"', tag)
        if name is None:
            continue
        kind = re.search(r'type="([^"]+)"', tag)
        kind = kind.group(1) if kind else 'text'
        value = re.search(r'value="([^"]*)"', tag)
        value = html_module.unescape(value.group(1)) if value else ''
        if kind == 'submit' or (kind == 'checkbox' and 'checked' not in tag):
            continue
        data[name.group(1)] = value
    for match in re.finditer(r'<select[^>]*name="([^"]+)"[^>]*>(.*?)</select>', page, re.S):
        options = re.findall(r'<option([^>]*)>', match.group(2))
        chosen = next((option for option in options if 'selected' in option), options[0])
        data[match.group(1)] = re.search(r'value="([^"]*)"', chosen).group(1)
    for match in re.finditer(r'<textarea[^>]*name="([^"]+)"[^>]*>(.*?)</textarea>', page, re.S):
        data[match.group(1)] = html_module.unescape(match.group(2)).lstrip('\r\n')
    return data


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
        logs = course_logs(6, CourseLogEvent.CORRUPTED)
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
        logs = course_logs(6, CourseLogEvent.FORK)
        assert [(log.field, log.value) for log in logs] == [("assignment_group_id", str(new_group.id))]

    def test_log_event_type_aliases(self):
        assert LogEventType.LMS_SUBMISSION == "X-Submission.LMS"
        assert LogEventType.SUBMIT == "Submit"


class TestCourseLog:

    def test_add_course_logs_create_and_instructor_role(self, client, test_data, act_as):
        act_as(test_data.user("ada@blockpy.com"))
        response = client.post('/courses/add', data={"name": "Audit Course", "visibility": "private",
                                                     "term": "Fall 2026", "url": "audit_course"})
        assert response.status_code == 302
        course = Course.by_url("audit_course")
        created = course_logs(course.id, CourseLogEvent.CREATE)
        assert len(created) == 1
        assert created[0].subject_id == 10
        given = role_logs(course_id=course.id, event_type=RoleLogEvent.GIVEN)
        assert len(given) == 1
        assert given[0].event_value == "instructor"
        assert given[0].subject_id == 10
        assert given[0].authorizer_id == 10
        assert given[0].role_id is not None

    def test_rename_logs(self, client, test_data, act_as):
        act_as(test_data.user("ada@blockpy.com"))
        client.post('/courses/rename', data={"course_id": 6, "name": "Renamed"})
        logs = course_logs(6, CourseLogEvent.RENAME)
        assert [(log.value, log.subject_id) for log in logs] == [("Renamed", 10)]

    def test_change_visibility_logs(self, client, test_data, act_as):
        act_as(test_data.user("ada@blockpy.com"))
        client.post('/courses/change_course_visibility', data={"course_id": 6, "visibility": "private"})
        logs = course_logs(6, CourseLogEvent.EDIT)
        assert [(log.field, log.value) for log in logs] == [("visibility", "private")]

    def test_edit_logs_only_changed_fields(self, client, test_data, act_as):
        act_as(test_data.user("ada@blockpy.com"))
        data = {"id": 6, "name": "Introduction to CS1 Fall 2020", "visibility": "public",
                "term": "Spring 2027", "url": "cs1_s27", "settings": "{}"}
        response = client.post('/courses/edit/6', data=data)
        assert response.status_code == 200
        logs = course_logs(6, CourseLogEvent.EDIT)
        assert {(log.field, log.value) for log in logs} == {("term", "Spring 2027"), ("url", "cs1_s27")}
        # The same edit again changes nothing, so it logs nothing
        client.post('/courses/edit/6', data=data)
        assert len(course_logs(6, CourseLogEvent.EDIT)) == 2

    def test_pin_logs_settings_edit(self, client, test_data, act_as):
        act_as(test_data.user("ada@blockpy.com"))
        response = client.post('/courses/pin_course', data={"course_id": 6, "pin_status": "true"})
        assert response.get_json()["success"] is True
        logs = course_logs(6, CourseLogEvent.EDIT)
        assert len(logs) == 1
        assert logs[0].field == "settings"
        assert json.loads(logs[0].value) == {"pinned": True}

    def test_textbook_logs_settings_edit(self, client, test_data, act_as):
        act_as(test_data.user("ada@blockpy.com"))
        client.post('/courses/edit_textbooks', data={"course_id": 6, "action": "add", "textbook_url": "book"})
        logs = course_logs(6, CourseLogEvent.EDIT)
        assert len(logs) == 1
        assert logs[0].field == "settings"
        assert json.loads(logs[0].value) == {"textbooks": ["book"]}

    def test_remove_logs_delete(self, client, test_data, act_as):
        act_as(test_data.user("admin@blockpy.com"))
        response = client.post('/courses/remove', data={"course_id": 6})
        assert response.status_code == 302
        assert Course.by_id(6) is None
        logs = course_logs(6, CourseLogEvent.DELETE)
        assert [log.subject_id for log in logs] == [1]

    def test_lti_course_create_and_endpoint_change(self, app, test_data):
        course = Course.from_lti("canvas", "ctx-123", "LTI Course", 10, "https://lms/outcome/1")
        assert [(log.event_type, log.subject_id) for log in course_logs(course.id)] == [(CourseLogEvent.CREATE, 10)]
        # Same launch again: nothing new
        assert Course.from_lti("canvas", "ctx-123", "LTI Course", 10, "https://lms/outcome/1").id == course.id
        assert len(course_logs(course.id)) == 1
        # New outcome endpoint
        Course.from_lti("canvas", "ctx-123", "LTI Course", 10, "https://lms/outcome/2")
        logs = course_logs(course.id)
        assert [log.event_type for log in logs] == [CourseLogEvent.CREATE, CourseLogEvent.EDIT]
        assert (logs[1].field, logs[1].value) == ("endpoint", "https://lms/outcome/2")


class TestRoleLog:

    def test_add_users_logs_given(self, client, test_data, act_as):
        act_as(test_data.user("ada@blockpy.com"))
        response = client.post('/courses/add_users/6', data={"new_users": "pico@blockpy.com", "role": "learner"})
        assert response.status_code == 302
        newbie = User.find_student("pico@blockpy.com")
        assert newbie.id == 50
        logs = role_logs(course_id=6, subject_id=newbie.id)
        assert len(logs) == 1
        assert (logs[0].event_type, logs[0].event_value, logs[0].authorizer_id) == (RoleLogEvent.GIVEN, "learner", 10)
        assert logs[0].role_id == newbie.get_course_roles(6)[0].id

    def test_remove_role_logs_removed(self, client, test_data, act_as):
        act_as(test_data.user("ada@blockpy.com"))
        response = client.post('/courses/remove_role/1000')
        assert response.status_code == 302
        assert Role.by_id(1000) is None
        logs = role_logs(role_id=1000)
        assert len(logs) == 1
        log = logs[0]
        assert (log.event_type, log.event_value, log.subject_id, log.authorizer_id, log.course_id) == \
               (RoleLogEvent.REMOVED, "learner", 100, 10, 6)

    def test_change_role_logs_changed(self, client, test_data, act_as):
        act_as(test_data.user("ada@blockpy.com"))
        client.post('/courses/change_role', data={"role_id": 1000, "new_role": "teachingassistant"})
        logs = role_logs(role_id=1000)
        assert [(log.event_type, log.event_value, log.authorizer_id) for log in logs] == \
               [(RoleLogEvent.CHANGED, "teachingassistant", 10)]

    def test_change_role_rejects_bogus_role(self, client, test_data, act_as):
        act_as(test_data.user("ada@blockpy.com"))
        response = client.post('/courses/change_role', data={"role_id": 1000, "new_role": "bogus"})
        assert response.get_json()["success"] is False
        assert role_logs(role_id=1000) == []
        assert Role.by_id(1000).name == UserRoles.LEARNER

    def test_lti_role_sync_logs_both_sides(self, app, test_data):
        lulu = test_data.user("lulu@blockpy.com")
        lulu.update_roles(["instructor"], 6)
        logs = role_logs(subject_id=100, course_id=6)
        assert [(log.event_type, log.event_value) for log in logs] == \
               [(RoleLogEvent.REMOVED, "learner"), (RoleLogEvent.GIVEN, "instructor")]
        assert {log.authorizer_id for log in logs} == {100}
        assert logs[0].role_id == 1000
        assert logs[1].role_id is not None
        assert Role.by_id(1000) is None
        assert lulu.is_instructor(6)

    def test_lti_role_sync_without_changes_logs_nothing(self, app, test_data):
        test_data.user("lulu@blockpy.com").update_roles(["Learner"], 6)
        assert role_logs(subject_id=100) == []
        assert Role.by_id(1000) is not None

    def test_global_role_is_not_logged(self, app, test_data):
        role = Role.new("admin", user_id=100)
        assert role.id is not None
        assert role_logs(subject_id=100) == []


class TestCourseLevelEvents:

    def test_fork_assignment_logs_on_target_course(self, client, test_data, act_as):
        act_as(test_data.user("ada@blockpy.com"))
        response = client.post('/assignments/fork', data={"assignment_id": 120, "course_id": 6})
        data = response.get_json()
        assert data["success"] is True
        logs = course_logs(6, CourseLogEvent.FORK)
        assert [(log.field, log.value, log.subject_id) for log in logs] == [("assignment_id", str(data["id"]), 10)]
        assert course_logs(3) == []

    def test_fork_group_logs_one_row(self, client, test_data, act_as):
        act_as(test_data.user("ada@blockpy.com"))
        response = client.post('/assignment_group/fork', data={"assignment_group_id": 1})
        data = response.get_json()
        assert data["success"] is True
        logs = course_logs(6, CourseLogEvent.FORK)
        assert [(log.field, log.value) for log in logs] == [("assignment_group_id", str(data["id"]))]

    def test_forking_menu_logs_on_target_course(self, client, test_data, act_as):
        act_as(test_data.user("ada@blockpy.com"))
        client.post('/assignment_group/forking_menu',
                    data={"assignment_group_id": 1, "target_course_id": 8,
                          "new_assignment_group_url": "hw1_forked", "new_assignment_group_name": "HW1 Forked",
                          "new_url[100]": "variables_forked"})
        forked = AssignmentGroup.by_url("hw1_forked")
        assert forked is not None and forked.course_id == 8
        logs = course_logs(8, CourseLogEvent.FORK)
        assert [(log.field, log.value) for log in logs] == [("assignment_group_id", str(forked.id))]
        assert course_logs(6) == []

    def test_bulk_transfer_logs_both_courses(self, client, test_data, act_as):
        act_as(test_data.user("ada@blockpy.com"))
        submission = Submission.load_or_new(Assignment.by_id(100), 100, 6)
        response = client.post('/assignments/bulk_transfer_course',
                               data={"source_course_id": 6, "assignment_group_id": 1, "destination_course_id": 8,
                                     "do-transfer": "1", f"transfer-submission-{submission.id}": "true"})
        assert response.status_code == 302
        assert Submission.get_submission(100, 100, 8) is not None
        for course_id, other_id in ((6, 8), (8, 6)):
            logs = course_logs(course_id, CourseLogEvent.TRANSFER)
            assert len(logs) == 1
            assert logs[0].field == "assignment_group_id"
            assert json.loads(logs[0].value) == {"assignment_group_id": 1, "other_course_id": other_id,
                                                 "submissions": 1}


class TestAdminCourseEdits:

    def test_owner_transfer_and_lock_are_logged(self, client, test_data, act_as):
        act_as(test_data.user("admin@blockpy.com"))
        form = scrape_form(client.get('/admin/course/edit/?id=6').data.decode())
        form["owner"] = "11"
        response = client.post('/admin/course/edit/?id=6', data=form)
        assert response.status_code == 302, response.data[:3000]
        assert Course.by_id(6).owner_id == 11
        assert [(log.event_type, log.value, log.subject_id) for log in course_logs(6)] == \
               [(CourseLogEvent.TRANSFER, "11", 1)]
        # Locking without touching the owner adds only the EDIT row
        form = scrape_form(client.get('/admin/course/edit/?id=6').data.decode())
        form["locked"] = "y"
        response = client.post('/admin/course/edit/?id=6', data=form)
        assert response.status_code == 302, response.data[:3000]
        assert Course.by_id(6).locked is True
        assert [(log.event_type, log.field, log.value) for log in course_logs(6)] == \
               [(CourseLogEvent.TRANSFER, None, "11"), (CourseLogEvent.EDIT, "locked", "True")]
        # Saving the form unchanged logs nothing further
        form = scrape_form(client.get('/admin/course/edit/?id=6').data.decode())
        client.post('/admin/course/edit/?id=6', data=form)
        assert len(course_logs(6)) == 2


class TestAssignmentLog:

    def test_new_assignment_logs_create(self, client, test_data, act_as):
        act_as(test_data.user("ada@blockpy.com"))
        response = client.post('/assignments/new', data={"course_id": 6, "name": "Logged", "type": "blockpy"})
        data = response.get_json()
        assert data["success"] is True
        logs = assignment_logs(data["id"])
        assert [(log.event_type, log.field, log.value, log.course_id, log.subject_id) for log in logs] == \
               [(AssignmentLogEvent.CREATE, None, None, 6, 10)]

    def test_remove_assignment_logs_delete(self, client, test_data, act_as):
        act_as(test_data.user("ada@blockpy.com"))
        response = client.post('/assignments/remove', data={"assignment_id": 100})
        assert response.get_json()["success"] is True
        assert Assignment.by_id(100) is None
        logs = assignment_logs(100)
        assert [(log.event_type, log.course_id, log.subject_id) for log in logs] == [(AssignmentLogEvent.DELETE, 6, 10)]

    def test_move_course_logs_edit(self, client, test_data, act_as):
        act_as(test_data.user("ada@blockpy.com"))
        response = client.post('/assignments/move_course', data={"assignment_id": 100, "new_course_id": 8})
        assert response.get_json()["success"] is True
        assert Assignment.by_id(100).course_id == 8
        logs = assignment_logs(100)
        assert [(log.event_type, log.field, log.value, log.course_id) for log in logs] == \
               [(AssignmentLogEvent.EDIT, "course_id", "8", 6)]

    def test_fork_logs_on_new_assignment(self, client, test_data, act_as):
        act_as(test_data.user("ada@blockpy.com"))
        response = client.post('/assignments/fork', data={"assignment_id": 120, "course_id": 6})
        new_id = response.get_json()["id"]
        logs = assignment_logs(new_id)
        assert [(log.event_type, log.field, log.value, log.course_id) for log in logs] == \
               [(AssignmentLogEvent.FORK, "forked_id", "120", 6)]
        assert assignment_logs(120) == []

    def test_fork_group_logs_each_new_assignment(self, client, test_data, act_as):
        act_as(test_data.user("ada@blockpy.com"))
        response = client.post('/assignment_group/fork', data={"assignment_group_id": 1})
        forked = AssignmentGroup.by_id(response.get_json()["id"]).get_assignments()
        assert len(forked) == 3
        for new_assignment in forked:
            logs = assignment_logs(new_assignment.id)
            assert [(log.event_type, log.field, log.value) for log in logs] == \
                   [(AssignmentLogEvent.FORK, "forked_id", str(new_assignment.forked_id))]

    def test_blockpy_fork_logs_each_new_assignment(self, client, test_data, act_as):
        act_as(test_data.user("ada@blockpy.com"))
        client.post('/blockpy/fork_assignment', data={"assignment_id": 120, "course_id": 6})
        logs = AssignmentLog.query.filter_by(event_type=AssignmentLogEvent.FORK).all()
        assert [(log.field, log.value, log.course_id) for log in logs] == [("forked_id", "120", 6)]

    def test_rename_instructor_file_logs_rename(self, client, test_data, act_as, app, tmp_path):
        app.config['UPLOADS_DIR'] = str(tmp_path)
        folder = tmp_path / 'files' / 'assignment' / '100'
        folder.mkdir(parents=True)
        (folder / 'old.txt').write_text('data')
        act_as(test_data.user("ada@blockpy.com"))
        response = client.post('/blockpy/rename_file',
                               data={"placement": "assignment", "directory": "100", "course_id": 6,
                                     "old_filename": "old.txt", "new_filename": "new.txt"})
        assert response.get_json()["success"] is True
        assert (folder / 'new.txt').exists()
        logs = assignment_logs(100)
        assert [(log.event_type, log.field, log.value, log.course_id, log.subject_id) for log in logs] == \
               [(AssignmentLogEvent.RENAME, "old.txt", "new.txt", 6, 10)]
