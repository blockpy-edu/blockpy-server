"""
Regression tests for the third batch of audit fixes:
- the JSON API never treats the anonymous visitor as an authenticated caller
- /api/import requires instructor of the destination course and admin for a `course` record
- debug routes are admin-only
- banned accounts trigger one admin email per session, not one per request
- static file requests do not create anonymous user rows
"""
import json

import pytest

from models.assignment import Assignment
from models.course import Course
from models.role import Role
from models.user import User
from models.enums import UserRoles


ADA = "ada@blockpy.com"
CAPTAIN = "captain@blockpy.com"


def post_json(client, url, payload):
    return client.post(url, data=json.dumps(payload), content_type='application/json')


class TestApiImport:

    def test_anonymous_cannot_rewrite_a_course(self, client, test_data):
        course = Course.by_id(6)
        original_name, original_owner = course.name, course.owner_id
        response = post_json(client, '/api/import', {
            "course_id": 1,
            "course": {"_schema_version": 2, "url": course.url, "name": "pwned", "visibility": "public",
                       "endpoint": "https://attacker.example/"}})
        assert response.status_code == 401
        refreshed = Course.by_id(6)
        assert refreshed.name == original_name
        assert refreshed.owner_id == original_owner

    def test_anonymous_api_calls_are_rejected(self, client, test_data):
        assert post_json(client, '/api/list/courses', {}).status_code == 401

    def test_wrong_password_does_not_reveal_which_part_failed(self, client, test_data):
        bad_user = post_json(client, '/api/list/courses', {"email": "nobody@example.com", "password": "x"})
        bad_pass = post_json(client, '/api/list/courses', {"email": ADA, "password": "x"})
        assert bad_user.status_code == bad_pass.status_code == 401
        assert bad_user.data == bad_pass.data

    def test_instructor_cannot_import_a_course_record(self, client, test_data, act_as):
        act_as(test_data.user(ADA))
        response = post_json(client, '/api/import', {
            "course_id": 6, "course": {"_schema_version": 2, "url": "cs1_f20", "name": "renamed"}})
        assert response.status_code == 403
        assert Course.by_id(6).name != "renamed"

    def test_instructor_cannot_import_into_someone_elses_course(self, client, test_data, act_as):
        act_as(test_data.user(CAPTAIN))
        response = post_json(client, '/api/import', {"course_id": 6, "assignments": []})
        assert response.status_code == 403

    def test_instructor_cannot_move_own_assignment_into_foreign_course(self, client, test_data, act_as):
        # Captain instructs 14 but not 6; an existing url they own cannot be re-homed into 6
        act_as(test_data.user(CAPTAIN))
        mine = Assignment.new(owner_id=12, course_id=14, url="captains_own_x", type="blockpy", name="Mine")
        response = post_json(client, '/api/import', {
            "course_id": 6, "assignments": [{"_schema_version": 2, "url": "captains_own_x", "name": "Moved"}]})
        assert response.status_code == 403
        assert Assignment.by_id(mine.id).course_id == 14

    def test_instructor_can_still_import_into_own_course(self, client, test_data, act_as):
        act_as(test_data.user(ADA))
        item = {key: value for key, value in Assignment.by_id(110).encode_json().items() if 'date' not in key}
        item['url'] = "imported_into_six_x"
        item['name'] = "Imported"
        response = post_json(client, '/api/import', {"course_id": 6, "assignments": [item]})
        assert response.status_code == 200
        created = Assignment.by_url("imported_into_six_x")
        assert created is not None and created.course_id == 6

    def test_garbage_body_is_a_400(self, client, test_data, act_as):
        act_as(test_data.user(ADA))
        response = client.post('/api/import', data="not json", content_type='application/json')
        assert response.status_code in (400, 401)


class TestDebugRoutes:

    def test_site_map_and_whoops_need_admin(self, client, test_data, act_as):
        for url in ('/site-map', '/whoops'):
            data = client.get(url).get_json()
            assert data['success'] is False
        act_as(test_data.user(ADA))
        for url in ('/site-map', '/whoops'):
            data = client.get(url).get_json()
            assert data['success'] is False

    def test_admin_can_see_site_map(self, client, test_data, act_as):
        Role.new(UserRoles.ADMIN, user_id=50, course_id=None)
        act_as(test_data.user("pico@blockpy.com"))
        response = client.get('/site-map')
        assert response.status_code == 200
        assert b'<table>' in response.data


class TestAbuseLimits:

    def test_static_requests_do_not_create_anonymous_users(self, client, test_data):
        before = User.query.count()
        for _ in range(3):
            client.get('/static/favicon.ico')
        assert User.query.count() == before

    def test_banned_user_notifies_once_per_session(self, client, test_data, act_as, monkeypatch):
        sent = []
        import controllers.auth as auth
        monkeypatch.setattr(auth, "notify_admin", lambda: sent.append(1))
        user = test_data.user("lulu@blockpy.com")
        user.banned = True
        from models.generics.models import db
        db.session.commit()
        act_as(user)
        for _ in range(3):
            assert client.get('/').status_code == 403
        assert len(sent) == 1


class TestReviewFollowUps:

    def test_quiz_answer_key_with_regex_chars_does_not_crash(self, client, test_data):
        from controllers.jinja_filters import make_readonly_quiz_body
        question = {"type": "fill_in_multiple_blanks_question", "body": "x [(] y"}
        html = make_readonly_quiz_body(question, {}, {"(": "ans"}, {"correct": {"(": ["ans"]}}, True)
        assert "ans" in html

    def test_student_garbage_start_time_is_not_a_500(self, client, test_data, act_as):
        from models.submission import Submission
        lulu = test_data.user("lulu@blockpy.com")
        for aid in (100, 101, 102):
            Submission.load_or_new(Assignment.by_id(aid), lulu.id, 6)
        act_as(lulu)
        response = client.post('/blockpy/start_assignment', data={
            "assignment_group_id": 1, "course_id": 6, "date_started": "garbage"})
        assert response.status_code == 200
        assert response.get_json()['success'] is True

    def test_malformed_bundle_upload_is_not_a_500(self, client, test_data, act_as):
        import io
        act_as(test_data.user(ADA))
        for bundle in ({"assignments": 5}, {"assignments": [{"url": "zz_x"}]}, {"course": {"url": "cs1_f20"}}):
            response = client.post('/assignments/bulk_upload?course_id=6', data={
                "file": (io.BytesIO(json.dumps(bundle).encode()), "b.json")},
                content_type='multipart/form-data', follow_redirects=True)
            assert response.status_code == 200, bundle
