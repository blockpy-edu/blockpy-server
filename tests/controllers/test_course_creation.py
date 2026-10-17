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
