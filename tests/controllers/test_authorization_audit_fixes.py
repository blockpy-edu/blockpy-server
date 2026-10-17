"""
Regression tests for the October 2026 authorization audit:
- the LTI shared secret is only shown to admins, and anonymous visitors no longer pass login_required
- instructors cannot remove or change site-wide (course-less) roles, nor grant admin
- grader scope on an assignment requires that the course actually uses it
- forking requires access to the source; assignments cannot be placed into other courses' groups
- bundle import cannot overwrite assignments the caller does not own, and `force` needs admin
"""
import io
import json

import pytest

from models.assignment import Assignment
from models.assignment_group_membership import AssignmentGroupMembership
from models.role import Role
from models.submission import Submission
from models.user import User
from models.enums import UserRoles


ADA = "ada@blockpy.com"          # instructor of course 6 (owns 100-106, group 1) and course 8 (owns 110)
CAPTAIN = "captain@blockpy.com"  # instructor of courses 2, 14, 15, 16
LULU = "lulu@blockpy.com"        # learner in course 6 (role 1000)


def make_admin(user_id=50):
    Role.new(UserRoles.ADMIN, user_id=user_id, course_id=None)
    return User.query.get(user_id)


class TestSecretAndLogin:

    def test_anonymous_is_redirected_from_add_canvas(self, client, test_data):
        response = client.get('/courses/add_canvas')
        assert response.status_code == 302
        assert 'login' in response.headers['Location']

    def test_anonymous_cannot_create_a_course(self, client, test_data):
        response = client.post('/courses/add', data={"name": "x", "url": "x"})
        assert response.status_code == 302
        assert 'login' in response.headers['Location']

    def test_instructor_does_not_see_the_secret(self, client, test_data, act_as, app):
        act_as(test_data.user(ADA))
        response = client.get('/courses/add_canvas')
        assert response.status_code == 200
        assert app.config['CONSUMER_KEY_SECRET'].encode() not in response.data
        assert b'ask your BlockPy administrator' in response.data

    def test_admin_sees_the_secret(self, client, test_data, act_as, app):
        act_as(make_admin())
        response = client.get('/courses/add_canvas')
        assert response.status_code == 200
        assert app.config['CONSUMER_KEY_SECRET'].encode() in response.data

    def test_anonymous_editor_routes_still_answer(self, client, test_data):
        # log_event / save_file are used by the try-it-out editor; they must not bounce to login
        response = client.post('/blockpy/log_event', data={})
        assert response.status_code != 302


class TestRoleRoutes:

    def test_instructor_cannot_remove_admin_role(self, client, test_data, act_as):
        admin = make_admin()
        admin_role = Role.query.filter_by(user_id=admin.id, course_id=None).first()
        act_as(test_data.user(CAPTAIN))
        response = client.get(f'/courses/remove_role/{admin_role.id}')
        assert Role.by_id(admin_role.id) is not None
        assert b'not an administrator' in response.data

    def test_instructor_cannot_change_admin_role(self, client, test_data, act_as):
        admin = make_admin()
        admin_role = Role.query.filter_by(user_id=admin.id, course_id=None).first()
        act_as(test_data.user(CAPTAIN))
        client.post('/courses/change_role', data={"role_id": admin_role.id, "new_role": "learner"})
        assert Role.by_id(admin_role.id).name == UserRoles.ADMIN

    def test_instructor_cannot_grant_admin(self, client, test_data, act_as):
        act_as(test_data.user(ADA))
        data = client.post('/courses/change_role', data={"role_id": 1000, "new_role": "admin"}).get_json()
        assert data['success'] is False
        assert Role.by_id(1000).name == UserRoles.LEARNER

    def test_instructor_can_still_change_roles_in_own_course(self, client, test_data, act_as):
        act_as(test_data.user(ADA))
        data = client.post('/courses/change_role', data={
            "role_id": 1000, "new_role": "teachingassistant"}).get_json()
        assert data['success'] is True
        assert Role.by_id(1000).name == UserRoles.TA

    def test_other_instructor_cannot_touch_course_roles(self, client, test_data, act_as):
        act_as(test_data.user(CAPTAIN))
        client.post('/courses/change_role', data={"role_id": 1000, "new_role": "instructor"})
        assert Role.by_id(1000).name == UserRoles.LEARNER
        client.get('/courses/remove_role/1000')
        assert Role.by_id(1000) is not None


class TestAssignmentScope:

    def scope_for(self, user, assignment_id, course_id):
        from controllers.services import ValidUserPermissionLayer
        scope, _ = ValidUserPermissionLayer(user).load_assignment_by_id(assignment_id, course_id)
        return scope

    def test_instructor_of_unrelated_course_does_not_get_grader_scope(self, client, test_data):
        scope = self.scope_for(test_data.user(CAPTAIN), 110, 14)
        assert not scope.can_grade

    def test_course_that_uses_the_assignment_gets_grader_scope(self, client, test_data):
        captain = test_data.user(CAPTAIN)
        Submission.load_or_new(Assignment.by_id(110), captain.id, 14)
        assert self.scope_for(captain, 110, 14).can_grade

    def test_owner_course_still_gets_full_scope(self, client, test_data):
        assert self.scope_for(test_data.user(ADA), 110, 8).can_edit

    def test_is_used_in_course_covers_group_membership(self, client, test_data):
        assignment = Assignment.by_id(100)
        assert assignment.is_used_in_course(6)       # owner and group 1
        assert not assignment.is_used_in_course(14)
        assert not assignment.is_used_in_course(None)


class TestForkAndGroups:

    def test_cannot_fork_assignment_from_unrelated_course(self, client, test_data, act_as):
        act_as(test_data.user(CAPTAIN))
        before = Assignment.query.count()
        data = client.post('/assignments/fork', data={"assignment_id": 110, "course_id": 14}).get_json()
        assert data['success'] is False
        assert 'not an adopter' in data['message']
        assert Assignment.query.count() == before

    def test_public_assignment_can_be_forked(self, client, test_data, act_as):
        Assignment.by_id(110).edit({"public": True})
        act_as(test_data.user(CAPTAIN))
        data = client.post('/assignments/fork', data={"assignment_id": 110, "course_id": 14}).get_json()
        assert data['success'] is True
        assert Assignment.by_id(data['id']).course_id == 14

    def test_cannot_fork_group_from_unrelated_course(self, client, test_data, act_as):
        # blockpy.fork_assignment was removed; assignment_group.fork is the surviving route
        act_as(test_data.user(CAPTAIN))
        data = client.post('/assignment_group/fork', data={
            "assignment_group_id": 1, "course_id": 14}).get_json()
        assert data['success'] is False

    def test_cannot_put_new_assignment_into_another_courses_group(self, client, test_data, act_as):
        act_as(test_data.user(CAPTAIN))
        data = client.post('/assignments/new', data={
            "course_id": 14, "name": "Injected", "url": "injected_x", "group": 1}).get_json()
        assert data['success'] is False
        assert 'does not belong to course 14' in data['message']
        assert not AssignmentGroupMembership.query.filter_by(assignment_group_id=1).filter(
            AssignmentGroupMembership.assignment_id.notin_([100, 101, 102])).first()

    def test_own_group_still_works(self, client, test_data, act_as):
        act_as(test_data.user(ADA))
        data = client.post('/assignments/new', data={
            "course_id": 6, "name": "Fine", "url": "fine_x", "group": 1}).get_json()
        assert data['success'] is True
        assert AssignmentGroupMembership.query.filter_by(assignment_group_id=1, assignment_id=data['id']).first()


class TestBundleImport:

    @staticmethod
    def exportable(assignment):
        # encode_json emits naive timestamps that decode_json cannot parse; the import path
        # ignores dates anyway, so strip them for a valid bundle.
        return {key: value for key, value in assignment.encode_json().items() if 'date' not in key}

    def upload(self, client, course_id, bundle):
        return client.post(f'/assignments/bulk_upload?course_id={course_id}', data={
            "file": (io.BytesIO(json.dumps(bundle).encode()), "bundle.json")},
            content_type='multipart/form-data', follow_redirects=True)

    def test_cannot_overwrite_assignment_owned_elsewhere(self, client, test_data, act_as):
        original = Assignment.by_id(100)
        original_name, original_course = original.name, original.course_id
        act_as(test_data.user(CAPTAIN))
        item = self.exportable(original)
        item['name'] = "Hijacked"
        response = self.upload(client, 14, {"assignments": [item]})
        assert response.status_code == 200
        refreshed = Assignment.by_id(100)
        assert refreshed.name == original_name
        assert refreshed.course_id == original_course

    def test_force_settings_are_ignored_for_non_admins(self, client, test_data, act_as):
        act_as(test_data.user(CAPTAIN))
        item = self.exportable(Assignment.by_id(110))
        item['url'] = "forced_copy_x"
        item['name'] = "Forced copy"
        self.upload(client, 14, {"settings": {"force": {"course_id": 6, "owner_id": 10}},
                                 "assignments": [item]})
        created = Assignment.by_url("forced_copy_x")
        assert created is not None
        assert created.course_id == 14
        assert created.owner_id == test_data.user(CAPTAIN).id

    def test_garbage_file_does_not_500(self, client, test_data, act_as):
        act_as(test_data.user(CAPTAIN))
        response = client.post('/assignments/bulk_upload?course_id=14', data={
            "file": (io.BytesIO(b"not json"), "bundle.json")},
            content_type='multipart/form-data', follow_redirects=True)
        assert response.status_code == 200
