"""
Regression tests for the /courses/add hardening:
- the add form is a FlaskForm, so a POST without a CSRF token is rejected when CSRF is enabled
- name and URL are required, length-limited, and the URL is restricted to a slug alphabet
- duplicate URLs are rejected before Course.new runs
"""
from models.course import Course
from models.role import Role
from models.enums import UserRoles


ADA = "ada@blockpy.com"


def post_course(client, **overrides):
    data = {'name': 'Brand New Course', 'visibility': 'private', 'term': 'Fall 2026', 'url': 'brand_new_course'}
    data.update(overrides)
    return client.post('/courses/add', data=data)


class TestCourseCreationValidation:

    def test_valid_course_is_created_with_instructor_role(self, client, test_data, act_as):
        user = test_data.user(ADA)
        act_as(user)
        response = post_course(client, name='  Brand New Course  ')
        assert response.status_code == 302
        course = Course.by_url('brand_new_course')
        assert course is not None
        assert course.name == 'Brand New Course'
        assert course.owner_id == user.id
        assert Role.query.filter_by(user_id=user.id, course_id=course.id, name=UserRoles.INSTRUCTOR).first()

    def test_blank_name_is_rejected(self, client, test_data, act_as):
        act_as(test_data.user(ADA))
        response = post_course(client, name='   ')
        assert response.status_code == 200
        assert Course.by_url('brand_new_course') is None
        assert b'This field is required' in response.data

    def test_overlong_name_is_rejected(self, client, test_data, act_as):
        act_as(test_data.user(ADA))
        response = post_course(client, name='x' * 256)
        assert response.status_code == 200
        assert Course.by_url('brand_new_course') is None

    def test_blank_url_is_rejected(self, client, test_data, act_as):
        act_as(test_data.user(ADA))
        before = Course.query.count()
        response = post_course(client, url='')
        assert response.status_code == 200
        assert Course.query.count() == before

    def test_url_with_unsafe_characters_is_rejected(self, client, test_data, act_as):
        act_as(test_data.user(ADA))
        for bad_url in ('has space', 'has/slash', '<script>', 'http://spam.example', 'ünïcode'):
            response = post_course(client, url=bad_url)
            assert response.status_code == 200, bad_url
            assert Course.by_url(bad_url) is None, bad_url
        assert b'letters, numbers, underscores, hyphens, and periods' in response.data

    def test_all_digit_url_is_rejected(self, client, test_data, act_as):
        act_as(test_data.user(ADA))
        response = post_course(client, url='12345')
        assert response.status_code == 200
        assert Course.by_url('12345') is None
        assert b'only digits' in response.data

    def test_unknown_visibility_is_rejected(self, client, test_data, act_as):
        act_as(test_data.user(ADA))
        response = post_course(client, visibility='everyone')
        assert response.status_code == 200
        assert Course.by_url('brand_new_course') is None

    def test_duplicate_url_is_rejected(self, client, test_data, act_as):
        act_as(test_data.user(ADA))
        existing = Course.by_id(6)
        assert existing.url
        before = Course.query.count()
        response = post_course(client, url=existing.url)
        assert response.status_code == 200
        assert Course.query.count() == before
        assert b'already uses this URL' in response.data


class TestCourseCreationCsrf:

    def test_post_without_token_is_rejected_when_csrf_enabled(self, client, test_data, act_as, app):
        act_as(test_data.user(ADA))
        app.config['WTF_CSRF_ENABLED'] = True
        try:
            response = post_course(client)
        finally:
            app.config['WTF_CSRF_ENABLED'] = False
        assert response.status_code == 200
        assert Course.by_url('brand_new_course') is None
        assert b'security token' in response.data

    def test_form_renders_token_when_csrf_enabled(self, client, test_data, act_as, app):
        act_as(test_data.user(ADA))
        app.config['WTF_CSRF_ENABLED'] = True
        try:
            response = client.get('/courses/add')
        finally:
            app.config['WTF_CSRF_ENABLED'] = False
        assert response.status_code == 200
        assert b'name="csrf_token"' in response.data

    def test_post_with_token_succeeds_when_csrf_enabled(self, client, test_data, act_as, app):
        import re
        act_as(test_data.user(ADA))
        app.config['WTF_CSRF_ENABLED'] = True
        try:
            page = client.get('/courses/add')
            token = re.search(rb'name="csrf_token" type="hidden" value="([^"]+)"', page.data).group(1).decode()
            response = post_course(client, csrf_token=token)
        finally:
            app.config['WTF_CSRF_ENABLED'] = False
        assert response.status_code == 302
        assert Course.by_url('brand_new_course') is not None


# ---------------------------------------------------------------------------------------------
# Anti-spam limits: new accounts get one course, everyone else a daily quota, public needs an
# established account. Fixture users/courses are dated 2020-01-01, so they count as established.
# ---------------------------------------------------------------------------------------------
import uuid
from datetime import datetime, timedelta, timezone

from common.course_creation import (CreatorStanding, creation_block_reason, allowed_visibility,
                                    is_established, is_new_account)
from models import db
from models.enums.courses import CourseVisibility
from models.user import User


def make_user(hours_old=0, email=None):
    user = User(first_name='Fresh', last_name='Face', email=email or f'{uuid.uuid4().hex[:8]}@example.com',
                password='x', active=True, anonymous=False, fs_uniquifier=uuid.uuid4().hex)
    db.session.add(user)
    db.session.flush()
    user.date_created = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(hours=hours_old)
    db.session.commit()
    return user


class TestCreationPolicyPure:

    def standing(self, **overrides):
        base = dict(exempt=False, confirmed=False, account_age=timedelta(days=30), courses_owned=0, courses_last_day=0)
        base.update(overrides)
        return CreatorStanding(**base)

    def test_new_account_detection(self):
        assert is_new_account(self.standing(account_age=timedelta(hours=1)))
        assert not is_new_account(self.standing(account_age=timedelta(hours=25)))
        assert not is_new_account(self.standing(account_age=None))

    def test_new_account_gets_one_course(self):
        young = self.standing(account_age=timedelta(hours=2))
        assert creation_block_reason(young) is None
        assert 'first 24 hours' in creation_block_reason(self.standing(account_age=timedelta(hours=2), courses_owned=1))

    def test_daily_quota(self):
        assert creation_block_reason(self.standing(courses_last_day=4)) is None
        assert 'last 24 hours' in creation_block_reason(self.standing(courses_last_day=5))

    def test_exempt_accounts_have_no_limits(self):
        exempt = self.standing(exempt=True, account_age=timedelta(minutes=1), courses_owned=50, courses_last_day=50)
        assert creation_block_reason(exempt) is None
        assert allowed_visibility(exempt, 'public') == ('public', None)

    def test_limits_can_be_disabled_through_settings(self):
        young = self.standing(account_age=timedelta(hours=2), courses_owned=3, courses_last_day=9)
        assert creation_block_reason(young, {'COURSE_CREATION_NEW_ACCOUNT_LIMIT': 0,
                                             'COURSE_CREATION_DAILY_LIMIT': 0}) is None

    def test_public_requires_established_account(self):
        young = self.standing(account_age=timedelta(days=2))
        visibility, note = allowed_visibility(young, 'public')
        assert visibility == 'private' and 'kept private' in note
        assert allowed_visibility(young, 'private') == ('private', None)
        assert allowed_visibility(young, 'archived') == ('archived', None)
        assert allowed_visibility(self.standing(account_age=timedelta(days=8)), 'public') == ('public', None)
        assert allowed_visibility(self.standing(account_age=timedelta(days=2), confirmed=True), 'public') == ('public', None)
        assert is_established(self.standing(account_age=None))


class TestCreationLimitsInRoutes:

    def test_new_account_may_create_exactly_one_course(self, client, test_data, act_as):
        user = make_user()
        act_as(user)
        assert post_course(client, url='first_course').status_code == 302
        assert Course.by_url('first_course').owner_id == user.id
        response = post_course(client, url='second_course')
        assert response.status_code == 200
        assert Course.by_url('second_course') is None
        assert b'first 24 hours' in response.data

    def test_day_old_account_has_a_daily_quota(self, client, test_data, act_as):
        user = make_user(hours_old=48)
        act_as(user)
        for i in range(5):
            assert post_course(client, url=f'quota_course_{i}').status_code == 302
        response = post_course(client, url='quota_course_5')
        assert response.status_code == 200
        assert Course.by_url('quota_course_5') is None
        assert b'last 24 hours' in response.data

    def test_established_fixture_account_is_not_blocked(self, client, test_data, act_as):
        act_as(test_data.user(ADA))
        assert post_course(client).status_code == 302
        assert Course.by_url('brand_new_course') is not None

    def test_admin_is_exempt(self, client, test_data, act_as):
        user = make_user()
        Role.new(UserRoles.ADMIN, user_id=user.id, course_id=None)
        act_as(user)
        for i in range(7):
            assert post_course(client, url=f'admin_course_{i}', visibility='public').status_code == 302
        assert Course.by_url('admin_course_6').visibility == CourseVisibility.PUBLIC

    def test_lms_staff_is_exempt(self, client, test_data, act_as):
        user = make_user()
        lms_course = Course.new_lti_course('canvas', 'ctx-123', 'Canvas Course', user.id)
        Role.new(UserRoles.INSTRUCTOR, user_id=user.id, course_id=lms_course.id)
        assert user.is_lms_staff()
        act_as(user)
        for i in range(3):
            assert post_course(client, url=f'lms_staff_course_{i}', visibility='public').status_code == 302
        assert Course.by_url('lms_staff_course_2').visibility == CourseVisibility.PUBLIC

    def test_native_instructor_role_does_not_exempt(self, client, test_data, act_as):
        user = make_user()
        Role.new(UserRoles.INSTRUCTOR, user_id=user.id, course_id=6)
        assert not user.is_lms_staff()

    def test_new_account_public_request_is_downgraded_to_private(self, client, test_data, act_as):
        user = make_user(hours_old=72)
        act_as(user)
        response = post_course(client, visibility='public', url='wants_public')
        assert response.status_code == 302
        assert Course.by_url('wants_public').visibility == CourseVisibility.PRIVATE

    def test_week_old_account_may_publish(self, client, test_data, act_as):
        user = make_user(hours_old=24 * 8)
        act_as(user)
        assert post_course(client, visibility='public', url='old_enough').status_code == 302
        assert Course.by_url('old_enough').visibility == CourseVisibility.PUBLIC

    def test_change_course_visibility_cannot_bypass(self, client, test_data, act_as):
        user = make_user(hours_old=48)
        course = Course.new(name='Mine', owner_id=user.id, visibility='private', term='', url='mine_x')
        db.session.commit()
        act_as(user)
        response = client.post('/courses/change_course_visibility', data={'course_id': course.id, 'visibility': 'public'})
        assert response.status_code == 302
        assert Course.by_id(course.id).visibility == CourseVisibility.PRIVATE
        # but private -> archived is fine
        client.post('/courses/change_course_visibility', data={'course_id': course.id, 'visibility': 'archived'})
        assert Course.by_id(course.id).visibility == CourseVisibility.ARCHIVED

    def test_edit_cannot_bypass(self, client, test_data, act_as):
        user = make_user(hours_old=48)
        course = Course.new(name='Mine', owner_id=user.id, visibility='private', term='', url='mine_y')
        db.session.commit()
        act_as(user)
        response = client.post(f'/courses/edit/{course.id}', data={'id': course.id, 'name': 'Mine', 'visibility': 'public',
                                                                  'term': '', 'url': 'mine_y', 'settings': '{}'})
        assert response.status_code == 200
        assert Course.by_id(course.id).visibility == CourseVisibility.PRIVATE
        assert b'kept private' in response.data

    def test_established_instructor_can_still_publish_via_change_visibility(self, client, test_data, act_as):
        act_as(test_data.user(ADA))
        Course.change_course_visibility(8, 'private', 10)
        client.post('/courses/change_course_visibility', data={'course_id': 8, 'visibility': 'public'})
        assert Course.by_id(8).visibility == CourseVisibility.PUBLIC
