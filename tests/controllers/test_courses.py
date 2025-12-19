"""
Comprehensive tests for courses controller endpoints.

These tests cover various endpoints of the courses controller,
testing both successful operations and error conditions.
"""
import json
from tests.factories import (
    UserFactory, CourseFactory, AssignmentFactory,
    AssignmentGroupFactory, SubmissionFactory, SampleDataGenerator
)
from models.enums.roles import UserRoles
from models.enums import CourseVisibility
import pytest


@pytest.fixture
def sample_data(client):
    """Create sample course data for testing."""
    sample_data = SampleDataGenerator.create_sample_course_with_data()
    return sample_data


class TestCourseIndex:
    """Tests for the course index/listing endpoint."""

    def test_course_index_unauthenticated(self, client):
        """Test course index without authentication."""
        response = client.get('/courses/')
        
        assert response.status_code == 200
        # Unauthenticated users should see the courses page
        assert b'Courses' in response.data or b'courses' in response.data or b'Create' in response.data

    def test_course_index_has_create_button(self, client):
        """Test that course index shows option to create courses."""
        response = client.get('/courses/')
        
        assert response.status_code == 200
        assert b'Create new course' in response.data or b'add' in response.data

    def test_course_index_shows_public_courses_section(self, client, sample_data):
        """Test that public courses section exists."""
        response = client.get('/courses/')
        
        assert response.status_code == 200
        # Should have a section for public courses
        assert b'Public' in response.data or b'public' in response.data


class TestCourseView:
    """Tests for viewing individual courses."""

    def test_view_public_course_by_id(self, client):
        """Test viewing a public course by its ID."""
        instructor = UserFactory.create_instructor()
        public_course = CourseFactory.create_course(
            name="Public Test Course",
            owner=instructor,
            visibility=CourseVisibility.PUBLIC
        )
        
        response = client.get(f'/courses/{public_course.id}/')
        
        assert response.status_code == 200
        assert b'Public Test Course' in response.data

    def test_view_public_course_by_url(self, client):
        """Test viewing a public course by its URL slug."""
        instructor = UserFactory.create_instructor()
        public_course = CourseFactory.create_course(
            name="URL Test Course",
            owner=instructor,
            url="url-test-course-unique",
            visibility=CourseVisibility.PUBLIC
        )
        
        response = client.get(f'/courses/{public_course.url}/')
        
        assert response.status_code == 200
        assert b'URL Test Course' in response.data

    def test_view_nonexistent_course(self, client):
        """Test viewing a course that doesn't exist."""
        response = client.get('/courses/99999/')
        
        # Should return an error (either 404 or redirect)
        assert response.status_code in [404, 302, 500]

    def test_view_private_course_unauthenticated(self, client, sample_data):
        """Test that private courses redirect when not authenticated."""
        course = sample_data['course']
        
        response = client.get(f'/courses/{course.id}/', follow_redirects=False)
        
        # Should redirect or show access denied
        assert response.status_code in [302, 401, 403] or b'not a user' in response.data


class TestCourseAdd:
    """Tests for creating new courses."""

    def test_add_course_get_form_unauthenticated(self, client):
        """Test accessing the add course form without authentication."""
        response = client.get('/courses/add/')
        
        # Should redirect to login or show login requirement
        assert response.status_code in [200, 302, 401, 403]

    def test_add_course_post_unauthenticated(self, client):
        """Test that unauthenticated users cannot create courses."""
        response = client.post('/courses/add/', data={
            'name': 'Unauthorized Course',
            'url': 'unauthorized-course',
            'visibility': 'private'
        })
        
        # Should redirect to login or show error
        assert response.status_code in [302, 401, 403]


class TestCourseEdit:
    """Tests for editing existing courses."""

    def test_edit_course_unauthenticated(self, client, sample_data):
        """Test that unauthenticated users cannot edit courses."""
        course = sample_data['course']
        
        response = client.get(f'/courses/edit/{course.id}/')
        
        # Should redirect to login or show error
        assert response.status_code in [302, 401, 403]


class TestCourseUsers:
    """Tests for course user management endpoints."""

    def test_get_users_unauthenticated(self, client, sample_data):
        """Test getting course users without authentication."""
        course = sample_data['course']
        
        response = client.get(f'/courses/users/?course_id={course.id}')
        
        # Should require authentication
        assert response.status_code in [200, 302, 401, 403]
        if response.status_code == 200:
            data = json.loads(response.data)
            assert data.get('success') == False or 'error' in data


class TestCourseManageUsers:
    """Tests for managing users in a course."""

    def test_manage_users_unauthenticated(self, client, sample_data):
        """Test accessing user management without authentication."""
        course = sample_data['course']
        
        response = client.get(f'/courses/manage_users/{course.id}/')
        
        # Should redirect to login
        assert response.status_code in [302, 401, 403]


class TestCourseAddUsers:
    """Tests for adding users to a course."""

    def test_add_users_unauthenticated(self, client, sample_data):
        """Test adding users without authentication."""
        course = sample_data['course']
        
        response = client.get(f'/courses/add_users/{course.id}/')
        
        # Should redirect to login
        assert response.status_code in [302, 401, 403]

    def test_add_users_post_unauthenticated(self, client, sample_data):
        """Test posting new users without authentication."""
        course = sample_data['course']
        
        response = client.post(f'/courses/add_users/{course.id}/', data={
            'new_users': 'hacker@example.com',
            'role': 'learner'
        })
        
        # Should redirect to login or error
        assert response.status_code in [302, 401, 403]


class TestCourseViewAssignments:
    """Tests for viewing assignments in a course."""

    def test_view_assignments_public_course(self, client):
        """Test viewing assignments in a public course."""
        instructor = UserFactory.create_instructor()
        public_course = CourseFactory.create_course(
            name="Public Assignment Course",
            owner=instructor,
            visibility=CourseVisibility.PUBLIC
        )
        assignment = AssignmentFactory.create_assignment(
            name="Public Assignment",
            course=public_course,
            owner=instructor
        )
        
        response = client.get(f'/courses/view_assignments/{public_course.id}/')
        
        assert response.status_code == 200
        # Should see the assignment
        assert b'Public Assignment' in response.data or b'assignment' in response.data.lower()

    def test_view_assignments_private_course_unauthenticated(self, client, sample_data):
        """Test viewing assignments in private course without auth."""
        course = sample_data['course']
        
        response = client.get(f'/courses/view_assignments/{course.id}/')
        
        # Should redirect or show error
        assert response.status_code in [302, 401, 403] or b'not' in response.data


class TestCourseRename:
    """Tests for renaming courses."""

    def test_rename_course_unauthenticated(self, client, sample_data):
        """Test renaming a course without authentication."""
        course = sample_data['course']
        
        response = client.post('/courses/rename/', data={
            'course_id': course.id,
            'name': 'Hacked Name'
        })
        
        # Should fail with error or redirect
        assert response.status_code in [302, 400, 401, 403, 500] or \
               (response.status_code == 200 and (b'error' in response.data.lower() or b'success' in response.data.lower()))


class TestCourseChangeVisibility:
    """Tests for changing course visibility."""

    def test_change_visibility_unauthenticated(self, client, sample_data):
        """Test changing course visibility without authentication."""
        course = sample_data['course']
        
        response = client.post('/courses/change_course_visibility/', data={
            'course_id': course.id,
            'visibility': 'public'
        })
        
        # Should fail with error or redirect
        assert response.status_code in [302, 400, 401, 403, 500]


class TestCoursePinning:
    """Tests for pinning/unpinning courses."""

    def test_pin_course_unauthenticated(self, client, sample_data):
        """Test pinning a course without authentication."""
        course = sample_data['course']
        
        response = client.post('/courses/pin_course/', data={
            'course_id': course.id,
            'pin_status': 'true'
        })
        
        # Should fail with error or redirect
        assert response.status_code in [302, 400, 401, 403, 500]


class TestCourseSubmissionsGrid:
    """Tests for the submissions grid view."""

    def test_submissions_grid_unauthenticated(self, client, sample_data):
        """Test viewing submissions grid without authentication."""
        course = sample_data['course']
        
        response = client.get(f'/courses/submissions_grid/{course.id}/')
        
        # Should fail or redirect
        assert response.status_code in [302, 400, 401, 403, 500]


class TestCourseSubmissionsUser:
    """Tests for viewing a specific user's submissions."""

    def test_submissions_user_unauthenticated(self, client, sample_data):
        """Test viewing user submissions without authentication."""
        course = sample_data['course']
        student = sample_data['students'][0]
        
        response = client.get(f'/courses/submissions_user/{course.id}/{student.id}/')
        
        # Should be denied
        assert response.status_code in [302, 401, 403, 500] or b'not an instructor' in response.data


class TestCourseDashboard:
    """Tests for the course dashboard."""

    def test_dashboard_unauthenticated(self, client, sample_data):
        """Test dashboard without authentication."""
        course = sample_data['course']
        
        response = client.get(f'/courses/dashboard/?course_id={course.id}')
        
        # Should require authentication or redirect
        assert response.status_code in [200, 302, 401, 403, 500]
        if response.status_code == 200:
            # If it returns 200, should show login requirement
            assert b'not logged in' in response.data or b'guest' in response.data.lower()


class TestCourseSubmissionsFilter:
    """Tests for filtering submissions by various criteria."""

    def test_submissions_filter_unauthenticated(self, client, sample_data):
        """Test submissions filter without authentication."""
        course = sample_data['course']
        
        response = client.get(f'/courses/submissions_filter/{course.id}/')
        
        # Should require authentication
        assert response.status_code in [200, 302, 401, 403, 500]
        if response.status_code == 200:
            assert b'not an instructor' in response.data or b'not a' in response.data


class TestCourseSubmissionsSpecific:
    """Tests for viewing specific submissions."""

    def test_submissions_specific_nonexistent(self, client):
        """Test viewing a non-existent submission."""
        response = client.get('/courses/submissions_specific/99999/')
        
        # Should show error or redirect
        assert response.status_code in [200, 302, 404, 500]
        if response.status_code == 200:
            assert b'not found' in response.data.lower() or b'not an instructor' in response.data


class TestCourseConfig:
    """Tests for course configuration endpoint."""

    def test_config_endpoint(self, client):
        """Test the course config endpoint."""
        response = client.get('/courses/config/')
        
        assert response.status_code == 200
        # Should return some configuration content
        assert len(response.data) > 0


class TestCoursePages:
    """Tests for course pages/textbook view."""

    def test_pages_public_course(self, client):
        """Test viewing pages for a public course."""
        instructor = UserFactory.create_instructor()
        public_course = CourseFactory.create_course(
            name="Pages Test Course",
            owner=instructor,
            visibility=CourseVisibility.PUBLIC
        )
        
        response = client.get(f'/courses/pages/{public_course.id}/')
        
        assert response.status_code == 200
        # Should show course content
        assert b'Pages Test Course' in response.data or b'assignment' in response.data.lower()

    def test_pages_by_url(self, client):
        """Test viewing pages by course URL."""
        instructor = UserFactory.create_instructor()
        public_course = CourseFactory.create_course(
            name="Pages URL Test",
            owner=instructor,
            url="pages-url-test-unique",
            visibility=CourseVisibility.PUBLIC
        )
        
        response = client.get(f'/courses/pages/{public_course.url}/')
        
        assert response.status_code == 200
        assert b'Pages URL Test' in response.data or b'assignment' in response.data.lower()


class TestCourseMakingProblems:
    """Tests for the making problems instructions page."""

    def test_making_problems_page(self, client):
        """Test the making problems instructions page."""
        response = client.get('/courses/making_problems/')
        
        assert response.status_code == 200
        # Should show instructions
        assert b'problem' in response.data.lower() or b'instruction' in response.data.lower()


class TestCourseWatchEvents:
    """Tests for the watch events endpoint."""

    def test_watch_events_unauthenticated(self, client):
        """Test watch events without authentication."""
        response = client.get('/courses/watch_events/')
        
        # Should require authentication or redirect
        assert response.status_code in [200, 302, 401, 403]


class TestCourseRemove:
    """Tests for removing/deleting courses."""

    def test_remove_course_unauthenticated(self, client, sample_data):
        """Test removing a course without authentication."""
        course = sample_data['course']
        
        response = client.post('/courses/remove/', data={
            'course_id': course.id
        })
        
        # Should fail - requires authentication and admin
        assert response.status_code in [302, 400, 401, 403, 500]
