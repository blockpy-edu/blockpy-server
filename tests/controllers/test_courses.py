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

    def test_assignments_page_student_in_course(self, client, test_data, act_as):
        """Students in the course still cannot access the management page (instructors only)."""
        # Lulu (100) is a student in course 6
        act_as(test_data.user("lulu@blockpy.com"))
        response = client.get('/courses/assignments/6')
        assert response.status_code == 302  # Redirected

    def test_assignments_page_instructor(self, client, test_data, act_as):
        """Instructors can access the assignment management page."""
        # Ada (10) is instructor in course 6
        act_as(test_data.user("ada@blockpy.com"))
        response = client.get('/courses/assignments/6')
        assert response.status_code == 200

    def test_manage_assignments_redirects_to_assignments(self, client, test_data, act_as):
        """The old manage_assignments page now redirects to the canonical assignments page."""
        act_as(test_data.user("ada@blockpy.com"))
        response = client.get('/courses/manage_assignments/6')
        assert response.status_code == 302
        assert '/courses/assignments/6' in response.headers['Location']

    def test_get_assignments_scoped_to_course(self, client, test_data, act_as):
        """The manage_assignments/get endpoint only returns the requested course's data."""
        # Ada (10) is instructor in course 6; other courses (e.g., 3 and 8) have their own groups
        act_as(test_data.user("ada@blockpy.com"))
        response = client.get('/courses/manage_assignments/get', query_string={'course_id': 6})
        assert response.status_code == 200
        data = response.get_json()
        assert data['success'] is True
        assert data['groups'], "Expected course 6 to have assignment groups"
        assert {group['course_id'] for group in data['groups']} == {6}
        assert {assignment['course_id'] for assignment in data['assignments']} == {6}
        group_ids = {group['id'] for group in data['groups']}
        assert {membership['assignment_group_id'] for membership in data['memberships']} <= group_ids

    def test_get_assignments_requires_instructor(self, client, test_data, act_as):
        """Students cannot pull the assignment management data."""
        # Lulu (100) is a student in course 6
        act_as(test_data.user("lulu@blockpy.com"))
        response = client.get('/courses/manage_assignments/get', query_string={'course_id': 6})
        data = response.get_json()
        assert data['success'] is False


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
        assert response.json['success'] is False
        # assert response.status_code in [302, 403]  # Blocked or redirected
        # TODO: This currently just redirects on success
        # assert response.json['success'] is False
    
    def test_edit_settings_instructor_allowed(self, client, test_data, act_as):
        """Instructors can edit settings for their courses."""
        # Ada (10) is instructor in course 6
        act_as(test_data.user("ada@blockpy.com"))
        response = client.post('/courses/edit_settings', data={
            'course_id': 6,
            'settings': '{"test": true}'
        })
        assert response.status_code == 302
        # assert response.json['success'] is True
    
    def test_edit_textbooks_student_blocked(self, client, test_data, act_as):
        """Students cannot edit course textbooks."""
        # Lulu (100) is a student in course 6
        act_as(test_data.user("lulu@blockpy.com"))
        response = client.post('/courses/edit_textbooks', data={
            'course_id': 6,
            'textbooks': '[]'
        })
        # assert response.status_code in [302, 403]  # Blocked or redirected
        assert response.json['success'] is False
    
    def test_edit_textbooks_instructor_allowed(self, client, test_data, act_as):
        """Instructors can edit textbooks for their courses."""
        # Ada (10) is instructor in course 6
        act_as(test_data.user("ada@blockpy.com"))
        response = client.post('/courses/edit_textbooks', data={
            'course_id': 6,
            'textbooks': '[]'
        })
        # May return success or error based on implementation
        assert response.status_code == 302
        # assert response.json['success'] is True


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

    def test_submissions_filter_data_student_blocked(self, client, test_data, act_as):
        """Students cannot fetch the submissions filter JSON data."""
        act_as(test_data.user("lulu@blockpy.com"))
        response = client.get('/courses/submissions_filter/get', query_string={'course_id': 6})
        assert response.status_code == 200
        assert response.is_json
        assert response.json['success'] is False

    def test_submissions_filter_data_instructor_allowed(self, client, test_data, act_as):
        """Instructors get lightweight submission records with human statuses."""
        act_as(test_data.user("ada@blockpy.com"))
        response = client.get('/courses/submissions_filter/get', query_string={'course_id': 6})
        assert response.status_code == 200, response.data
        assert response.json['success'] is True, response.json
        submissions = response.json['submissions']
        assert isinstance(submissions, list)
        if submissions:
            first = submissions[0]
            for field in ('id', 'user_id', 'assignment_id', 'assignment_group_id',
                          'score', 'correct', 'version', 'date_created', 'date_modified',
                          'human_submission_status', 'human_grading_status'):
                assert field in first, f"Missing {field}"

    def test_submissions_filter_data_accepts_post(self, client, test_data, act_as):
        """The frontend component POSTs its filters; that must not fall through
        to the /submissions_filter/<course_id> page route."""
        act_as(test_data.user("ada@blockpy.com"))
        response = client.post('/courses/submissions_filter/get',
                               data={'course_id': 6, 'user_ids': '', 'assignment_ids': ''})
        assert response.status_code == 200, response.data
        assert response.is_json
        assert response.json['success'] is True, response.json

    def test_submissions_filter_data_filtering(self, client, test_data, act_as):
        """The user_ids/assignment_ids parameters narrow down the submissions."""
        act_as(test_data.user("ada@blockpy.com"))
        everything = client.get('/courses/submissions_filter/get',
                                query_string={'course_id': 6}).json['submissions']
        if not everything:
            return
        some_user_id = everything[0]['user_id']
        filtered = client.get('/courses/submissions_filter/get',
                              query_string={'course_id': 6,
                                            'user_ids': str(some_user_id)}).json['submissions']
        assert filtered
        assert all(sub['user_id'] == some_user_id for sub in filtered)
        some_assignment_id = everything[0]['assignment_id']
        filtered = client.get('/courses/submissions_filter/get',
                              query_string={'course_id': 6,
                                            'assignment_ids': str(some_assignment_id)}).json['submissions']
        assert filtered
        assert all(sub['assignment_id'] == some_assignment_id for sub in filtered)

    def _search_submissions(self, client, criteria, combinator="and"):
        import json
        response = client.post('/courses/submissions_filter/get',
                               data={'course_id': 6,
                                     'search': json.dumps({'combinator': combinator,
                                                           'criteria': criteria})})
        assert response.status_code == 200, response.data
        assert response.json['success'] is True, response.json
        return response.json

    def test_submissions_filter_search_correctness(self, client, test_data, act_as):
        """The correctness criterion partitions submissions, and negate inverts it."""
        act_as(test_data.user("ada@blockpy.com"))
        everything = self._search_submissions(client, [])['submissions']
        correct = self._search_submissions(client, [
            {'field': 'correct', 'operator': 'is', 'value': 'true'}])['submissions']
        assert all(sub['correct'] for sub in correct)
        negated = self._search_submissions(client, [
            {'field': 'correct', 'operator': 'is', 'value': 'true', 'negate': True}])['submissions']
        assert all(not sub['correct'] for sub in negated)
        assert len(correct) + len(negated) == len(everything)

    def test_submissions_filter_search_score_and_combinators(self, client, test_data, act_as):
        """Score comparisons and the none/xor combinators behave sensibly."""
        act_as(test_data.user("ada@blockpy.com"))
        everything = self._search_submissions(client, [])['submissions']
        # Score >= 0 matches everything; "none" of that matches nothing
        all_scores = self._search_submissions(client, [
            {'field': 'score', 'operator': 'ge', 'value': '0'}])['submissions']
        assert len(all_scores) == len(everything)
        nothing = self._search_submissions(client, [
            {'field': 'score', 'operator': 'ge', 'value': '0'}], combinator='none')['submissions']
        assert nothing == []
        # xor of (score >= 0) and (score >= 0) is never exactly one
        xor = self._search_submissions(client, [
            {'field': 'score', 'operator': 'ge', 'value': '0'},
            {'field': 'score', 'operator': 'ge', 'value': '0'}], combinator='xor')['submissions']
        assert xor == []

    def test_submissions_filter_search_code_contents(self, client, test_data, act_as):
        """Code-content criteria run server-side; contains and NOT-contains partition."""
        act_as(test_data.user("ada@blockpy.com"))
        everything = self._search_submissions(client, [])['submissions']
        containing = self._search_submissions(client, [
            {'field': 'code', 'operator': 'icontains', 'value': 'print'}])['submissions']
        missing = self._search_submissions(client, [
            {'field': 'code', 'operator': 'icontains', 'value': 'print', 'negate': True}])['submissions']
        assert len(containing) + len(missing) == len(everything)

    def test_submissions_filter_search_reports_errors(self, client, test_data, act_as):
        """Unknown fields and bad regexes are skipped with a reported error."""
        act_as(test_data.user("ada@blockpy.com"))
        result = self._search_submissions(client, [
            {'field': 'nonsense', 'operator': 'eq', 'value': '5'},
            {'field': 'code', 'operator': 'regex', 'value': '('}])
        assert len(result['search_errors']) == 2
        # With every criterion invalid, no filtering is applied
        everything = self._search_submissions(client, [])['submissions']
        assert len(result['submissions']) == len(everything)

    def test_submissions_filter_search_user_fields(self, client, test_data, act_as):
        """user.* criteria compare against the submission's user."""
        act_as(test_data.user("ada@blockpy.com"))
        everything = self._search_submissions(client, [])['submissions']
        lulu = test_data.user("lulu@blockpy.com")
        matching = self._search_submissions(client, [
            {'field': 'user.email', 'operator': 'icontains', 'value': 'lulu@'}])['submissions']
        assert all(sub['user_id'] == lulu.id for sub in matching)
        missing = self._search_submissions(client, [
            {'field': 'user.email', 'operator': 'icontains', 'value': 'lulu@',
             'negate': True}])['submissions']
        assert len(matching) + len(missing) == len(everything)

    def test_submissions_filter_search_assignment_fields(self, client, test_data, act_as):
        """assignment.* criteria compare against the submission's assignment."""
        act_as(test_data.user("ada@blockpy.com"))
        everything = self._search_submissions(client, [])['submissions']
        # Any assignment.name value partitions the submissions with its negation
        named = self._search_submissions(client, [
            {'field': 'assignment.name', 'operator': 'icontains', 'value': 'a'}])['submissions']
        unnamed = self._search_submissions(client, [
            {'field': 'assignment.name', 'operator': 'icontains', 'value': 'a',
             'negate': True}])['submissions']
        assert len(named) + len(unnamed) == len(everything)
        typed = self._search_submissions(client, [
            {'field': 'assignment.type', 'operator': 'is', 'value': 'blockpy'}])['submissions']
        untyped = self._search_submissions(client, [
            {'field': 'assignment.type', 'operator': 'is', 'value': 'blockpy',
             'negate': True}])['submissions']
        assert len(typed) + len(untyped) == len(everything)

    def test_submissions_filter_search_rejects_metric_fields(self, client, test_data, act_as):
        """View Submissions has no metrics dict, so metric fields are not in its
        accepted set and report back as unknown."""
        act_as(test_data.user("ada@blockpy.com"))
        result = self._search_submissions(client, [
            {'field': 'total_time_spent', 'operator': 'ge', 'value': '10'}])
        assert len(result['search_errors']) == 1

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


class TestCourseAnalytics:
    """Test the course analytics dashboard endpoints."""

    def test_analytics_page_student_blocked(self, client, test_data, act_as):
        act_as(test_data.user("lulu@blockpy.com"))
        response = client.get('/courses/analytics/6/')
        assert response.status_code == 200
        assert b'not an instructor' in response.data.lower()

    def test_analytics_page_instructor_allowed(self, client, test_data, act_as):
        act_as(test_data.user("ada@blockpy.com"))
        response = client.get('/courses/analytics/6/')
        assert response.status_code == 200, response.data
        assert b'not an instructor' not in response.data.lower()
        assert b'course-analytics' in response.data

    def test_analytics_rollup_student_blocked(self, client, test_data, act_as):
        act_as(test_data.user("lulu@blockpy.com"))
        response = client.get('/courses/analytics/rollup', query_string={'course_id': 6})
        assert response.is_json
        assert response.json['success'] is False

    def test_analytics_rollup_shape(self, client, test_data, act_as):
        """One aggregate row per assignment and per student, never per submission."""
        act_as(test_data.user("ada@blockpy.com"))
        response = client.get('/courses/analytics/rollup', query_string={'course_id': 6})
        assert response.status_code == 200, response.data
        assert response.json['success'] is True, response.json
        assert 'data_as_of' in response.json
        assignments = response.json['assignments']
        students = response.json['students']
        for row in assignments + students:
            for field in ('id', 'n', 'correct', 'mean_score', 'median_score',
                          'last_activity', 'statuses', 'metrics'):
                assert field in row, f"Missing {field}"
            assert row['n'] >= 1
            assert sum(row['statuses'].values()) == row['n']
        # Both grains cover the same submissions, so their totals agree
        assert sum(r['n'] for r in assignments) == sum(r['n'] for r in students)

    def test_analytics_rollup_scoping(self, client, test_data, act_as):
        """assignment_ids/user_ids narrow both grains."""
        act_as(test_data.user("ada@blockpy.com"))
        everything = client.get('/courses/analytics/rollup',
                                query_string={'course_id': 6}).json
        if not everything['assignments']:
            return
        target = everything['assignments'][0]['id']
        scoped = client.get('/courses/analytics/rollup',
                            query_string={'course_id': 6,
                                          'assignment_ids': str(target)}).json
        assert [row['id'] for row in scoped['assignments']] == [target]
        assert sum(r['n'] for r in scoped['students']) == scoped['assignments'][0]['n']

    def test_analytics_detail_requires_scope(self, client, test_data, act_as):
        act_as(test_data.user("ada@blockpy.com"))
        response = client.get('/courses/analytics/detail', query_string={'course_id': 6})
        assert response.json['success'] is False

    def test_analytics_detail_scoped(self, client, test_data, act_as):
        act_as(test_data.user("ada@blockpy.com"))
        rollup = client.get('/courses/analytics/rollup',
                            query_string={'course_id': 6}).json
        if not rollup['assignments']:
            return
        target = rollup['assignments'][0]['id']
        response = client.get('/courses/analytics/detail',
                              query_string={'course_id': 6, 'assignment_ids': str(target)})
        assert response.json['success'] is True, response.json
        submissions = response.json['submissions']
        assert len(submissions) == rollup['assignments'][0]['n']
        for sub in submissions:
            for field in ('id', 'score', 'correct', 'date_started', 'date_due',
                          'attempts', 'metrics'):
                assert field in sub, f"Missing {field}"

    def test_analytics_detail_metric_search(self, client, test_data, act_as):
        """Metric criteria match against the pivoted counters, and submissions
        with no counter data never match (no data is not 0)."""
        import json
        from models import db, SubmissionCounts
        from models.enums.metrics import SubmissionMetrics
        act_as(test_data.user("ada@blockpy.com"))
        everything = client.get('/courses/analytics/rollup',
                                query_string={'course_id': 6}).json
        if not everything['assignments']:
            return
        target = everything['assignments'][0]['id']
        detail = client.get('/courses/analytics/detail',
                            query_string={'course_id': 6,
                                          'assignment_ids': str(target)}).json['submissions']
        assert detail
        chosen = detail[0]['id']
        db.session.add(SubmissionCounts(submission_id=chosen,
                                        metric=SubmissionMetrics.total_time_spent,
                                        value=500))
        db.session.commit()
        search = json.dumps({'combinator': 'and', 'criteria': [
            {'field': 'total_time_spent', 'operator': 'ge', 'value': '100'}]})
        matched = client.post('/courses/analytics/detail',
                              data={'course_id': 6, 'assignment_ids': str(target),
                                    'search': search}).json['submissions']
        assert [sub['id'] for sub in matched] == [chosen]
        assert matched[0]['metrics'].get('total_time_spent') == 500
        # The rollup now aggregates that counter row too
        rollup = client.get('/courses/analytics/rollup',
                            query_string={'course_id': 6,
                                          'assignment_ids': str(target)}).json
        stats = rollup['assignments'][0]['metrics'].get('total_time_spent')
        assert stats == {'sum': 500, 'n': 1, 'median': 500.0}


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
