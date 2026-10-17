"""
Tests for the admin-facing review of the audit tables: the Flask-Admin log views and
the /audit pages and feed. See docs/specs/audit-logging-review.md, phase 6.
"""
import json

import pytest

from models import db
from models.course import Course
from models.enums import CourseLogEvent, AssignmentLogEvent
from models.log_tables import CourseLog, AssignmentLog
from models.role import Role
from models.user import User


ADMIN_LOG_PAGES = ['/admin/submissionlog/', '/admin/courselog/', '/admin/rolelog/',
                   '/admin/assignmentlog/', '/admin/accesslog/', '/admin/errorlog/']


class TestAdminLogViews:

    @pytest.mark.parametrize("page", ADMIN_LOG_PAGES)
    def test_admin_can_list_every_log_table(self, client, test_data, act_as, page):
        act_as(test_data.user("admin@blockpy.com"))
        assert client.get(page).status_code == 200

    @pytest.mark.parametrize("page", ADMIN_LOG_PAGES)
    def test_non_admin_is_forbidden(self, client, test_data, act_as, page):
        act_as(test_data.user("ada@blockpy.com"))
        assert client.get(page).status_code == 403

    def test_audit_tables_are_read_only(self, client, test_data, act_as):
        act_as(test_data.user("admin@blockpy.com"))
        for page in ADMIN_LOG_PAGES[1:]:
            assert client.get(page + 'new/').status_code == 302


AUDIT_PAGES = ['/audit/', '/audit/events', '/audit/course/6', '/audit/user/100', '/audit/assignment/100',
               '/audit/errors']
ADMIN_ONLY_PAGES = ['/audit/', '/audit/events', '/audit/user/100', '/audit/errors',
                    '/audit/course/3', '/audit/assignment/120']


def feed(client, **params):
    response = client.get('/audit/feed', query_string=params)
    return response.status_code, response.get_json()


class TestAuditPageAccess:

    @pytest.mark.parametrize("page", AUDIT_PAGES)
    def test_student_is_forbidden(self, client, test_data, act_as, page):
        act_as(test_data.user("lulu@blockpy.com"))
        assert client.get(page).status_code == 403

    @pytest.mark.parametrize("page", AUDIT_PAGES)
    def test_admin_is_allowed(self, client, test_data, act_as, page):
        act_as(test_data.user("admin@blockpy.com"))
        response = client.get(page)
        assert response.status_code == 200
        assert b'<audit-review' in response.data

    def test_instructor_sees_own_course_and_assignment(self, client, test_data, act_as):
        act_as(test_data.user("ada@blockpy.com"))
        assert client.get('/audit/course/6').status_code == 200
        assert client.get('/audit/assignment/100').status_code == 200

    @pytest.mark.parametrize("page", ADMIN_ONLY_PAGES)
    def test_instructor_is_forbidden_elsewhere(self, client, test_data, act_as, page):
        act_as(test_data.user("ada@blockpy.com"))
        assert client.get(page).status_code == 403

    def test_adopting_does_not_grant_history(self, client, test_data, act_as):
        act_as(test_data.user("ada@blockpy.com"))
        client.post('/courses/adopt_assignments/6', data={"source_course_id": 3, "action": "adopt_assignment",
                                                          "assignment_id": 120}, follow_redirects=True)
        assert client.get('/audit/assignment/120').status_code == 403
        status, data = feed(client, assignment_id=120)
        assert status == 403 and data["success"] is False

    def test_missing_targets_are_404(self, client, test_data, act_as):
        act_as(test_data.user("admin@blockpy.com"))
        assert client.get('/audit/course/9999').status_code == 404
        assert client.get('/audit/assignment/9999').status_code == 404
        assert client.get('/audit/user/9999').status_code == 404


class TestAuditFeed:

    def test_instructor_feed_is_scoped(self, client, test_data, act_as):
        act_as(test_data.user("ada@blockpy.com"))
        client.post('/courses/rename', data={"course_id": 6, "name": "Renamed"})
        status, data = feed(client, course_id=6)
        assert status == 200 and data["success"] is True and data["is_admin"] is False
        assert [event["event_type"] for event in data["events"]] == ["rename"]
        assert feed(client)[0] == 403
        assert feed(client, course_id=3)[0] == 403

    def test_subject_filter_is_applied_on_top_of_scope(self, client, test_data, act_as):
        act_as(test_data.user("ada@blockpy.com"))
        client.post('/courses/rename', data={"course_id": 6, "name": "Renamed"})
        CourseLog.new(6, 11, CourseLogEvent.RENAME, value="By Babbage")
        CourseLog.new(3, 11, CourseLogEvent.RENAME, value="Elsewhere")
        status, data = feed(client, course_id=6, subject_id=11)
        assert [(event["course"]["id"], event["subject"]["id"], event["value"]) for event in data["events"]] == \
               [(6, 11, "By Babbage")]

    def test_feed_is_newest_first_with_relations(self, client, test_data, act_as):
        act_as(test_data.user("ada@blockpy.com"))
        client.post('/courses/rename', data={"course_id": 6, "name": "Renamed"})
        client.post('/courses/change_course_visibility', data={"course_id": 6, "visibility": "private"})
        client.post('/courses/pin_course', data={"course_id": 6, "pin_status": "true"})
        client.post('/courses/add_users/6', data={"new_users": "pico@blockpy.com", "role": "learner"})
        status, data = feed(client, course_id=6)
        events = data["events"]
        assert [event["table"] for event in events] == ["role_log", "course_log", "course_log", "course_log"]
        assert [event["event_type"] for event in events] == ["given", "edit", "edit", "rename"]
        whens = [event["when"] for event in events]
        assert whens == sorted(whens, reverse=True)
        for event in events:
            assert event["subject"]["email"] and event["course"]["url"] == "cs1_f20"
        assert events[0]["authorizer"]["id"] == 10 and events[0]["subject"]["id"] == 50
        assert events[1]["authorizer"] is None
        assert {event["course_id"] for event in events} == {6}

    def test_tables_filter(self, client, test_data, act_as):
        Course.rename(6, "Renamed", 10)
        Role.by_id(1000).update_role("teachingassistant", authorizer_id=10)
        act_as(test_data.user("admin@blockpy.com"))
        status, data = feed(client, tables="role_log")
        assert [(event["table"], event["value"]) for event in data["events"]] == [("role_log", "teachingassistant")]
        status, data = feed(client)
        assert data["is_admin"] is True
        assert {event["table"] for event in data["events"]} == {"role_log", "course_log"}

    def test_actor_filter_covers_role_authorizer(self, client, test_data, act_as):
        act_as(test_data.user("ada@blockpy.com"))
        client.post('/courses/add_users/6', data={"new_users": "pico@blockpy.com", "role": "learner"})
        client.post('/courses/rename', data={"course_id": 6, "name": "Renamed"})
        status, data = feed(client, course_id=6, actor_id=10)
        assert sorted(event["table"] for event in data["events"]) == ["course_log", "role_log"]
        status, data = feed(client, course_id=6, subject_id=10)
        assert [event["table"] for event in data["events"]] == ["course_log"]

    def test_event_types_search_and_time_filters(self, client, test_data, act_as):
        Course.rename(6, "Needle", 10)
        Course.change_course_visibility(6, "private", 10)
        act_as(test_data.user("admin@blockpy.com"))
        assert [e["event_type"] for e in feed(client, event_types="rename")[1]["events"]] == ["rename"]
        assert [e["value"] for e in feed(client, search="needle")[1]["events"]] == ["Needle"]
        assert feed(client, since="2999-01-01T00:00:00Z")[1]["events"] == []
        assert feed(client, before="2000-01-01T00:00:00Z")[1]["events"] == []
        assert len(feed(client, since="2000-01-01T00:00:00Z")[1]["events"]) == 2

    def test_long_values_are_truncated_in_feed_only(self, client, test_data, act_as):
        act_as(test_data.user("admin@blockpy.com"))
        log = CourseLog.new(6, 10, CourseLogEvent.EDIT, field="settings", value="x" * 600)
        status, data = feed(client, course_id=6)
        assert data["events"][0]["value_truncated"] is True
        assert len(data["events"][0]["value"]) == 500
        response = client.get(f'/audit/event/course_log/{log.id}')
        event = response.get_json()["event"]
        assert event["value_truncated"] is False and len(event["value"]) == 600
        assert client.get('/audit/event/course_log/9999').status_code == 404
        assert client.get('/audit/event/bogus/1').status_code == 404

    def test_event_detail_is_scoped(self, client, test_data, act_as):
        log = CourseLog.new(3, 11, CourseLogEvent.RENAME, value="Elsewhere")
        act_as(test_data.user("ada@blockpy.com"))
        assert client.get(f'/audit/event/course_log/{log.id}').status_code == 403

    def test_limit_is_capped(self, client, test_data, act_as):
        act_as(test_data.user("admin@blockpy.com"))
        assert feed(client, limit=9999)[1]["limit"] == 500
        assert feed(client, limit=0)[1]["limit"] == 1
        assert feed(client)[1]["limit"] == 100


class TestAuditDiffAndSummary:

    def save_settings(self, client, settings):
        return client.post('/blockpy/save_assignment',
                           data={"assignment_id": 100, "course_id": 6, "name": "Variables and Types",
                                 "settings": json.dumps(settings)})

    def test_diff_between_consecutive_settings_edits(self, client, test_data, act_as):
        act_as(test_data.user("ada@blockpy.com"))
        assert self.save_settings(client, {"a": 1, "b": 2}).get_json()["success"] is True
        assert self.save_settings(client, {"a": 1, "b": 3}).get_json()["success"] is True
        status, data = feed(client, assignment_id=100, tables="assignment_log")
        second, first = data["events"][0], data["events"][1]
        assert first["field"] == "assignment_settings.blockpy"
        diff = client.get(f'/audit/diff/assignment_log/{second["id"]}').get_json()
        assert diff["previous_id"] == first["id"]
        changed = [(line["kind"], line["text"]) for line in diff["lines"] if line["kind"] in ("add", "remove")]
        assert len(changed) == 2
        assert changed[0][0] == "remove" and '"b\\": 2' in changed[0][1]
        assert changed[1][0] == "add" and '"b\\": 3' in changed[1][1]
        assert all("name" not in text for kind, text in changed)
        # The first edit has nothing before it
        diff = client.get(f'/audit/diff/assignment_log/{first["id"]}').get_json()
        assert diff["previous_id"] is None
        assert all(line["kind"] in ("add", "header") for line in diff["lines"])

    def test_diff_rejects_other_tables(self, client, test_data, act_as):
        act_as(test_data.user("admin@blockpy.com"))
        assert client.get('/audit/diff/course_log/1').status_code == 400

    def test_summary_counts(self, client, test_data, act_as):
        Course.rename(6, "Renamed", 10)
        Role.by_id(1000).remove(authorizer_id=10)
        User.find_student("pico@blockpy.com").add_role("instructor", 6, authorizer_id=10)
        AssignmentLog.new(100, 1, 6, 10, AssignmentLogEvent.CREATE, None, None, "", "")
        act_as(test_data.user("admin@blockpy.com"))
        data = client.get('/audit/summary').get_json()
        assert (data["tables"]["course_log"]["since"], data["tables"]["role_log"]["since"],
                data["tables"]["assignment_log"]["since"]) == (1, 2, 1)
        assert data["tables"]["course_log"]["week"] == 1
        assert sum(day["count"] for day in data["tables"]["role_log"]["days"]) == 2
        assert [(e["table"], e["event_type"]) for e in data["destructive"]] == [("role_log", "removed")]
        assert [(e["value"], e["subject"]["id"]) for e in data["privilege"]] == [("instructor", 50)]
        assert data["errors"]["since"] == 0

    def test_summary_lookup_and_errors_are_admin_only(self, client, test_data, act_as):
        act_as(test_data.user("ada@blockpy.com"))
        assert client.get('/audit/summary').status_code == 403
        assert client.get('/audit/lookup', query_string={"q": "100"}).status_code == 403
        assert client.get('/audit/error_groups').status_code == 403

    def test_lookup(self, client, test_data, act_as):
        act_as(test_data.user("admin@blockpy.com"))
        matches = client.get('/audit/lookup', query_string={"q": "lulu@blockpy.com"}).get_json()["matches"]
        assert [m["url"] for m in matches] == ["/audit/user/100"]
        matches = client.get('/audit/lookup', query_string={"q": "cs1_f20"}).get_json()["matches"]
        assert [m["url"] for m in matches] == ["/audit/course/6"]
        matches = client.get('/audit/lookup', query_string={"q": "100"}).get_json()["matches"]
        assert {m["kind"] for m in matches} == {"assignment", "user"}

    def test_error_groups_empty(self, client, test_data, act_as):
        act_as(test_data.user("admin@blockpy.com"))
        data = client.get('/audit/error_groups').get_json()
        assert data["groups"] == [] and data["total"] == 0
