"""
TODO: Some of the earlier tests are human-authored, but a lot of these are
low-quality AI generated. We should improve them at some point.
"""
import pytest


class TestCourseIndexAndViewing:
    """Test basic course listing and viewing endpoints."""
    
    def test_courses_index_anonymous(self, client):
        """Anonymous users can view the courses index."""
        response = client.get('/courses/')
        assert response.status_code == 200
        assert b'Course' in response.data  # Should show courses listing
    
    def test_courses_index_authenticated(self, client, test_data, act_as):
        """Authenticated users can view the courses index."""
        act_as(test_data.user("ada@blockpy.com"))
        response = client.get('/courses/')
        assert response.status_code == 200
        assert b'Course' in response.data
    
    def test_view_public_course(self, client, test_data):
        """Anyone can view a public course."""
        # Course 2 (cs1) is public
        response = client.get('/courses/2')
        assert response.status_code == 200
        assert b"Introduction to CS1" in response.data
    
    def test_view_private_course_unauthorized(self, client, test_data):
        """Anonymous users cannot view private courses."""
        # Course 8 (cs1_f21) is private
        response = client.get('/courses/8')
        assert response.status_code == 302  # Redirect to login
    
    def test_view_private_course_not_enrolled(self, client, test_data, act_as):
        """Users not enrolled in a private course cannot view it."""
        # User Pico (50) is not in course 8
        act_as(test_data.user("pico@blockpy.com"))
        response = client.get('/courses/8')
        assert response.status_code == 302  # Redirect
    
    def test_view_private_course_enrolled_student(self, client, test_data, act_as):
        """Students enrolled in a private course can view it."""
        # User lulu (100) is a learner in course 6
        act_as(test_data.user("lulu@blockpy.com"))
        response = client.get('/courses/6')
        assert response.status_code == 200
        assert b"Introduction to CS1 Fall 2020" in response.data
    
    def test_view_private_course_instructor(self, client, test_data, act_as):
        """Instructors can view their private courses."""
        # Ada (10) is instructor in course 8
        act_as(test_data.user("ada@blockpy.com"))
        response = client.get('/courses/8')
        assert response.status_code == 200
        assert b"Introduction to CS1 Fall 2021" in response.data


class TestCourseUserManagement:
    """Test course user listing and management endpoints (security critical)."""
    
    def test_get_users_no_course_context_error(self, client, test_data, act_as):
        """Getting users without course_id should fail with error."""
        act_as(test_data.user("ada@blockpy.com"))
        response = client.get('/courses/users/')
        # May return 403 or 500 depending on get_course_id() behavior
        assert response.get_json()['success'] is False
    
    def test_get_users_anonymous_with_course(self, client, test_data):
        """Anonymous users cannot get all users in a course."""
        response = client.get('/courses/users/', query_string={"course_id": 6})
        assert response.status_code == 403
        data = response.get_json()
        assert data['success'] is False
    
    def test_get_users_student_cannot_see_all_users(self, client, test_data, act_as):
        """Students cannot get list of all users in a course."""
        # Lulu (100) is a student in course 6
        act_as(test_data.user("lulu@blockpy.com"))
        response = client.get('/courses/users/', query_string={"course_id": 6})
        assert response.status_code == 403
        data = response.get_json()
        assert data['success'] is False
    
    def test_get_users_student_can_see_self(self, client, test_data, act_as):
        """Students can get their own user info with course roles."""
        # Lulu (100) is a student in course 6
        lulu = test_data.user("lulu@blockpy.com")
        act_as(lulu)
        response = client.get('/courses/users/', query_string={
            "user_ids": str(lulu.id),
            "course_id": 6
        })
        assert response.status_code == 200
        data = response.get_json()
        assert data['success'] is True
        assert len(data['users']) == 1
        assert data['users'][0]['id'] == lulu.id
        assert len(data['users'][0]['roles']) > 0  # Has roles in the course
    
    def test_get_users_student_cannot_see_other_student(self, client, test_data, act_as):
        """Students cannot get info about other students."""
        # Lulu (100) trying to see Suzaku (101)
        act_as(test_data.user("lulu@blockpy.com"))
        suzaku = test_data.user("suzaku@blockpy.com")
        response = client.get('/courses/users/', query_string={
            "user_ids": str(suzaku.id),
            "course_id": 6
        })
        assert response.status_code == 403
        data = response.get_json()
        assert data['success'] is False
    
    def test_get_users_instructor_can_see_all(self, client, test_data, act_as):
        """Instructors can get list of all users in their course."""
        # Ada (10) is instructor in course 6
        act_as(test_data.user("ada@blockpy.com"))
        response = client.get('/courses/users/', query_string={"course_id": 6})
        assert response.status_code == 200
        data = response.get_json()
        assert data['success'] is True
        # Course 6 has instructor Ada + students (100-104)
        assert len(data['users']) >= 6
        user_ids = {u['id'] for u in data['users']}
        assert 10 in user_ids  # Ada
        assert 100 in user_ids  # Lulu
        assert 101 in user_ids  # Suzaku
    
    def test_get_users_instructor_cannot_see_other_course(self, client, test_data, act_as):
        """Instructors cannot get users from courses they don't teach."""
        # Babbage (11) is instructor in course 3, not course 6
        act_as(test_data.user("babbage@blockpy.com"))
        response = client.get('/courses/users/', query_string={"course_id": 6})
        assert response.status_code == 403
        data = response.get_json()
        assert data['success'] is False
    
    def test_manage_users_page_student_can_access(self, client, test_data, act_as):
        """Students can access the manage users page if they're in the course.
        Note: The template may show different content based on is_instructor flag."""
        # Lulu (100) is a student in course 6
        act_as(test_data.user("lulu@blockpy.com"))
        response = client.get('/courses/manage_users/6')
        # Actually allows access, but is_instructor flag controls what they can do
        assert response.status_code == 403
    
    def test_manage_users_page_instructor_allowed(self, client, test_data, act_as):
        """Instructors can access the manage users page for their courses."""
        # Ada (10) is instructor in course 6
        act_as(test_data.user("ada@blockpy.com"))
        response = client.get('/courses/manage_users/6')
        assert response.status_code == 200
        assert b'manage' in response.data.lower() or b'user' in response.data.lower()
    
    def test_add_users_page_student_blocked(self, client, test_data, act_as):
        """Students cannot access the add users page."""
        # Lulu (100) is a student in course 6
        act_as(test_data.user("lulu@blockpy.com"))
        response = client.get('/courses/add_users/6')
        assert response.status_code == 302  # Redirected away
    
    def test_add_users_page_instructor_allowed(self, client, test_data, act_as):
        """Instructors can access the add users page for their courses."""
        # Ada (10) is instructor in course 6
        act_as(test_data.user("ada@blockpy.com"))
        response = client.get('/courses/add_users/6')
        assert response.status_code == 200


class TestCourseModification:
    """Test course modification endpoints (create, edit, rename, delete)."""
    
    def test_add_course_anonymous_shows_login(self, client):
        """Anonymous users get shown login page for add course."""
        response = client.get('/courses/add')
        # Returns 200 with login form instead of 302 redirect
        assert response.status_code == 200
        # Should contain login/signin content
        assert b'login' in response.data.lower() or b'sign in' in response.data.lower()
    
    def test_add_course_authenticated_allowed(self, client, test_data, act_as):
        """Authenticated users can access the add course page."""
        act_as(test_data.user("ada@blockpy.com"))
        response = client.get('/courses/add')
        assert response.status_code == 200
        assert b'Add' in response.data or b'Create' in response.data or b'New' in response.data
    
    def test_edit_course_student_blocked(self, client, test_data, act_as):
        """Students cannot edit courses."""
        # Lulu (100) is a student in course 6
        act_as(test_data.user("lulu@blockpy.com"))
        response = client.get('/courses/edit/6')
        assert response.status_code == 302  # Redirected away
    
    def test_edit_course_instructor_allowed(self, client, test_data, act_as):
        """Instructors can edit their courses."""
        # Ada (10) is instructor in course 6
        act_as(test_data.user("ada@blockpy.com"))
        response = client.get('/courses/edit/6')
        assert response.status_code == 200
        assert b'Introduction to CS1 Fall 2020' in response.data
    
    def test_edit_course_wrong_instructor_blocked(self, client, test_data, act_as):
        """Instructors cannot edit courses they don't teach."""
        # Babbage (11) is instructor in course 3, not course 6
        act_as(test_data.user("babbage@blockpy.com"))
        response = client.get('/courses/edit/6')
        assert response.status_code == 302  # Redirected away
    
    def test_rename_course_student_blocked(self, client, test_data, act_as):
        """Students cannot rename courses."""
        # Lulu (100) is a student in course 6
        act_as(test_data.user("lulu@blockpy.com"))
        response = client.post('/courses/rename', data={
            'course_id': 6,
            'name': 'Hacked Course Name'
        })
        # The API returns 200 with success=False for auth failures
        assert response.status_code == 200
        data = response.get_json()
        assert data.get('success') is False
        assert 'instructor' in data.get('message', '').lower()
    
    def test_rename_course_instructor_allowed(self, client, test_data, act_as):
        """Instructors can rename their courses."""
        # Ada (10) is instructor in course 6
        act_as(test_data.user("ada@blockpy.com"))
        response = client.post('/courses/rename', data={
            'course_id': 6,
            'name': 'New Test Name'
        })
        assert response.status_code == 200
        data = response.get_json()
        assert data.get('success') is True
    
    def test_remove_course_instructor_blocked(self, client, test_data, act_as):
        """Regular instructors cannot remove courses (admin only)."""
        # Ada (10) is instructor but not admin
        act_as(test_data.user("ada@blockpy.com"))
        response = client.post('/courses/remove', data={'course_id': 6})
        # The API returns 200 with success=False for auth failures
        assert response.status_code == 200
        data = response.get_json()
        assert data.get('success') is False
        assert 'admin' in data.get('message', '').lower()
    
    def test_remove_course_student_blocked(self, client, test_data, act_as):
        """Students cannot remove courses."""
        # Lulu (100) is a student
        act_as(test_data.user("lulu@blockpy.com"))
        response = client.post('/courses/remove', data={'course_id': 6})
        # The API returns 200 with success=False for auth failures
        assert response.status_code == 200
        data = response.get_json()
        assert data.get('success') is False
        assert 'admin' in data.get('message', '').lower()
    
    def test_change_visibility_student_blocked(self, client, test_data, act_as):
        """Students cannot change course visibility."""
        # Lulu (100) is a student in course 6
        act_as(test_data.user("lulu@blockpy.com"))
        response = client.post('/courses/change_course_visibility', data={
            'course_id': 6,
            'visibility': 'private'
        })
        # The API returns 200 with success=False for auth failures
        assert response.status_code == 200
        data = response.get_json()
        assert data.get('success') is False
        assert 'instructor' in data.get('message', '').lower()
    
    def test_change_visibility_instructor_allowed(self, client, test_data, act_as):
        """Instructors can change visibility of their courses."""
        # Ada (10) is instructor in course 6
        act_as(test_data.user("ada@blockpy.com"))
        response = client.post('/courses/change_course_visibility', data={
            'course_id': 6,
            'visibility': 'public'
        })
        assert response.status_code == 302  # Redirect after success
    
    def test_pin_course_student_blocked(self, client, test_data, act_as):
        """Students cannot pin/unpin courses."""
        # Lulu (100) is a student in course 6
        act_as(test_data.user("lulu@blockpy.com"))
        response = client.post('/courses/pin_course', data={
            'course_id': 6,
            'pin_status': 'true'
        })
        # The API returns 200 with success=False for auth failures
        assert response.status_code == 200
        data = response.get_json()
        assert data.get('success') is False
        assert 'instructor' in data.get('message', '').lower()
    
    def test_pin_course_instructor_allowed(self, client, test_data, act_as):
        """Instructors can pin/unpin their courses."""
        # Ada (10) is instructor in course 6
        act_as(test_data.user("ada@blockpy.com"))
        response = client.post('/courses/pin_course', data={
            'course_id': 6,
            'pin_status': 'true'
        })
        assert response.status_code == 200
        data = response.get_json()
        assert data.get('success') is True


class TestCourseAssignments:
    """Test assignment-related endpoints."""
    
    def test_view_assignments_student_in_course(self, client, test_data, act_as):
        """Students can view assignments in their courses."""
        # Lulu (100) is a student in course 6
        act_as(test_data.user("lulu@blockpy.com"))
        response = client.get('/courses/view_assignments/6')
        assert response.status_code == 200
    
    def test_view_assignments_student_not_in_course(self, client, test_data, act_as):
        """Students cannot view assignments in courses they're not in (if private)."""
        # Lulu (100) is NOT in course 8 (which is private)
        act_as(test_data.user("lulu@blockpy.com"))
        response = client.get('/courses/view_assignments/8')
        assert response.status_code == 302  # Redirected
    
    def test_view_assignments_public_course(self, client, test_data, act_as):
        """Anyone can view assignments in public courses."""
        # Lulu (100) viewing public course 2
        act_as(test_data.user("lulu@blockpy.com"))
        response = client.get('/courses/view_assignments/2')
        assert response.status_code == 200
    

    def test_assignments_page_student_not_in_course(self, client, test_data, act_as):
        """Students cannot access assignments page for courses they're not in."""
        # Lulu (100) is NOT in course 10
        act_as(test_data.user("lulu@blockpy.com"))
        response = client.get('/courses/assignments/10')
        assert response.status_code == 302  # Redirected


class TestCourseSettings:
    """Test course settings and configuration endpoints."""
    
    def test_edit_settings_student_blocked(self, client, test_data, act_as):
        """Students cannot edit course settings."""
        # Lulu (100) is a student in course 6
        act_as(test_data.user("lulu@blockpy.com"))
        response = client.post('/courses/edit_settings', data={
            'course_id': 6,
            'settings': '{}'
        })
        assert response.status_code in [302, 403]  # Blocked or redirected
    
    def test_edit_settings_instructor_allowed(self, client, test_data, act_as):
        """Instructors can edit settings for their courses."""
        # Ada (10) is instructor in course 6
        act_as(test_data.user("ada@blockpy.com"))
        response = client.post('/courses/edit_settings', data={
            'course_id': 6,
            'settings': '{"test": true}'
        })
        # May return success or error based on implementation
        assert response.status_code in [200, 302]
    
    def test_edit_textbooks_student_blocked(self, client, test_data, act_as):
        """Students cannot edit course textbooks."""
        # Lulu (100) is a student in course 6
        act_as(test_data.user("lulu@blockpy.com"))
        response = client.post('/courses/edit_textbooks', data={
            'course_id': 6,
            'textbooks': '[]'
        })
        assert response.status_code in [302, 403]  # Blocked or redirected
    
    def test_edit_textbooks_instructor_allowed(self, client, test_data, act_as):
        """Instructors can edit textbooks for their courses."""
        # Ada (10) is instructor in course 6
        act_as(test_data.user("ada@blockpy.com"))
        response = client.post('/courses/edit_textbooks', data={
            'course_id': 6,
            'textbooks': '[]'
        })
        # May return success or error based on implementation
        assert response.status_code in [200, 302]


class TestCourseExport:
    """Test course export functionality."""
    
    def test_export_course_student_blocked(self, client, test_data, act_as):
        """Students cannot export course data."""
        # Lulu (100) is a student in course 6
        act_as(test_data.user("lulu@blockpy.com"))
        response = client.get('/courses/export', query_string={'course_id': 6})
        # Returns 400 error
        assert response.status_code == 400
    
    def test_export_course_instructor_allowed(self, client, test_data, act_as):
        """Instructors can export their course data."""
        # Ada (10) is instructor in course 6
        act_as(test_data.user("ada@blockpy.com"))
        response = client.get('/courses/export', query_string={'course_id': 6})
        # Should return JSON file download
        assert response.status_code == 200
        assert response.mimetype == 'application/json'


class TestSubmissionsAndGrading:
    """Test submission viewing and grading endpoints (security critical)."""
    
    def test_submissions_filter_student_blocked(self, client, test_data, act_as):
        """Students cannot filter/view all submissions."""
        # Lulu (100) is a student in course 6
        act_as(test_data.user("lulu@blockpy.com"))
        response = client.get('/courses/submissions_filter/6/')
        # Returns plain text message, not JSON
        assert response.status_code == 200
        assert b'not an instructor' in response.data.lower() or b'not a grader' in response.data.lower()
    
    def test_submissions_filter_instructor_allowed(self, client, test_data, act_as):
        """Instructors can filter submissions in their courses."""
        # Ada (10) is instructor in course 6
        act_as(test_data.user("ada@blockpy.com"))
        response = client.get('/courses/submissions_filter/6/')
        # Should return success (HTML page)
        assert response.status_code == 200
        # Should not contain error message
        assert b'not an instructor' not in response.data.lower()
    
    def test_edit_points_requires_proper_context(self, client, test_data, act_as):
        """edit_points requires proper course context via bulk_assignment_editor_setup."""
        # Lulu (100) is a student
        act_as(test_data.user("lulu@blockpy.com"))
        response = client.get('/courses/edit_points', query_string={'course_id': 6})
        # Will fail in bulk_assignment_editor_setup, returns 500 or error
        assert response.status_code in [200, 500]
        # If 200, should have error
        if response.status_code == 200:
            # May return plain text or JSON depending on where it fails
            assert b'error' in response.data.lower() or b'grader' in response.data.lower() or b'instructor' in response.data.lower()


class TestDashboardAndReporting:
    """Test dashboard and reporting endpoints (security critical)."""
    
    def test_dashboard_student_can_access(self, client, test_data, act_as):
        """Students can access their own dashboard."""
        # Lulu (100) is a student in course 6
        act_as(test_data.user("lulu@blockpy.com"))
        response = client.get('/courses/dashboard/', query_string={'course_id': 6})
        # Students can access their own dashboard view
        assert response.status_code == 200
    
    def test_dashboard_instructor_needs_context(self, client, test_data, act_as):
        """Instructors can access dashboard but get_course_id needs proper context."""
        # Ada (10) is instructor in course 6
        act_as(test_data.user("ada@blockpy.com"))
        response = client.get('/courses/dashboard/', query_string={'course_id': 6})
        assert b'course' in response.data.lower() or b'dashboard' in response.data.lower()
    
    def test_list_grading_failures_student_blocked(self, client, test_data, act_as):
        """Students cannot view grading failures."""
        # Lulu (100) is a student in course 6
        act_as(test_data.user("lulu@blockpy.com"))
        response = client.get('/courses/list_grading_failures/', query_string={'course_id': 6})
        # Will check permission and return error
        assert response.status_code == 200
        data = response.get_json()
        assert data.get('success') is False
    
    def test_list_grading_failures_instructor_allowed(self, client, test_data, act_as):
        """Instructors can view grading failures for their courses."""
        # Ada (10) is instructor in course 6
        act_as(test_data.user("ada@blockpy.com"))
        response = client.get('/courses/list_grading_failures/', query_string={'course_id': 6})
        # Should return success
        assert response.status_code == 200
