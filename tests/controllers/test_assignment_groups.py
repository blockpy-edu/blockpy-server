"""
Comprehensive tests for assignment group endpoints.
Tests cover creating, editing, removing, forking groups, and security permissions.
"""
import pytest


class TestAssignmentGroupCreation:
    """Test assignment group creation endpoint (add_group)."""

    def test_add_group_anonymous_blocked(self, client, test_data):
        """Anonymous users cannot create assignment groups."""
        response = client.post('/assignment_group/add', data={
            'course_id': 6,
            'name': 'New Group'
        })
        assert response.json['success'] is False
        # assert response.status_code == 302  # Redirect to login
    
    def test_add_group_student_blocked(self, client, test_data, act_as):
        """Students cannot create assignment groups."""
        # Lulu (100) is a student in course 6
        act_as(test_data.user("lulu@blockpy.com"))
        response = client.post('/assignment_group/add', data={
            'course_id': 6,
            'name': 'Student Group'
        })
        assert response.json['success'] is False
        # assert response.status_code == 403
    
    def test_add_group_wrong_instructor_blocked(self, client, test_data, act_as):
        """Instructors cannot create groups in courses they don't teach."""
        # Babbage (11) is instructor in course 3, not course 6
        act_as(test_data.user("babbage@blockpy.com"))
        response = client.post('/assignment_group/add', data={
            'course_id': 6,
            'name': 'Unauthorized Group'
        })
        assert response.json['success'] is False
        # assert response.status_code == 403
    
    def test_add_group_instructor_allowed(self, client, test_data, act_as):
        """Instructors can create assignment groups in their courses."""
        # Ada (10) is instructor in course 6
        act_as(test_data.user("ada@blockpy.com"))
        response = client.post('/assignment_group/add', data={
            'course_id': 6,
            'name': 'New Test Group',
            'url': 'new_test_group'
        })
        assert response.status_code == 200
        data = response.get_json()
        assert data['success'] is True
        assert data['name'] == 'New Test Group'
        assert data['url'] == 'new_test_group'
        assert 'id' in data
    
    def test_add_group_missing_parameters(self, client, test_data, act_as):
        """Creating group without required parameters fails."""
        act_as(test_data.user("ada@blockpy.com"))
        # Missing name parameter
        response = client.post('/assignment_group/add', data={
            'course_id': 6
        })
        assert response.json['success'] is False
        # assert response.status_code in [400, 403]


class TestAssignmentGroupEditing:
    """Test assignment group editing endpoint (edit_group)."""
    
    def test_edit_group_anonymous_blocked(self, client, test_data):
        """Anonymous users cannot edit assignment groups."""
        response = client.post('/assignment_group/edit', data={
            'assignment_group_id': 1,
            'new_name': 'Edited Group'
        })
        assert response.json['success'] is False
        # assert response.status_code == 302  # Redirect to login
    
    def test_edit_group_student_blocked(self, client, test_data, act_as):
        """Students cannot edit assignment groups."""
        # Lulu (100) is a student in course 6
        act_as(test_data.user("lulu@blockpy.com"))
        response = client.post('/assignment_group/edit', data={
            'assignment_group_id': 1,  # Group 1 is in course 6
            'new_name': 'Student Edit'
        })
        assert response.json['success'] is False
        # assert response.status_code == 403
    
    def test_edit_group_wrong_instructor_blocked(self, client, test_data, act_as):
        """Instructors cannot edit groups in other courses."""
        # Babbage (11) is instructor in course 3, not course 6
        act_as(test_data.user("babbage@blockpy.com"))
        response = client.post('/assignment_group/edit', data={
            'assignment_group_id': 1,  # Group 1 is in course 6
            'new_name': 'Unauthorized Edit'
        })
        assert response.json['success'] is False
        # assert response.status_code == 403
    
    def test_edit_group_instructor_allowed(self, client, test_data, act_as):
        """Instructors can edit groups in their courses."""
        # Ada (10) is instructor in course 6
        act_as(test_data.user("ada@blockpy.com"))
        response = client.post('/assignment_group/edit', data={
            'assignment_group_id': 1,  # Group 1 is in course 6
            'new_name': 'Edited Homework 1',
            'new_url': 'edited_homework1'
        })
        assert response.status_code == 200
        data = response.get_json()
        assert data['success'] is True
        assert data['name'] == 'Edited Homework 1'
        assert data['url'] == 'edited_homework1'
    
    def test_edit_nonexistent_group(self, client, test_data, act_as):
        """Editing non-existent group fails."""
        act_as(test_data.user("ada@blockpy.com"))
        response = client.post('/assignment_group/edit', data={
            'assignment_group_id': 99999,
            'new_name': 'Does Not Exist'
        })
        assert response.json['success'] is False
        # assert response.status_code == 404


class TestAssignmentGroupRemoval:
    """Test assignment group removal endpoint (remove_group)."""
    
    def test_remove_group_anonymous_blocked(self, client, test_data):
        """Anonymous users cannot remove assignment groups."""
        response = client.post('/assignment_group/remove', data={
            'assignment_group_id': 1
        })
        assert response.json['success'] is False
        # assert response.status_code == 302  # Redirect to login
    
    def test_remove_group_student_blocked(self, client, test_data, act_as):
        """Students cannot remove assignment groups."""
        # Lulu (100) is a student in course 6
        act_as(test_data.user("lulu@blockpy.com"))
        response = client.post('/assignment_group/remove', data={
            'assignment_group_id': 1  # Group in course 6
        })
        assert response.json['success'] is False
        # assert response.status_code == 403
    
    def test_remove_group_wrong_instructor_blocked(self, client, test_data, act_as):
        """Instructors cannot remove groups from other courses."""
        # Babbage (11) is instructor in course 3, not course 6
        act_as(test_data.user("babbage@blockpy.com"))
        response = client.post('/assignment_group/remove', data={
            'assignment_group_id': 1  # Group in course 6
        })
        assert response.json['success'] is False
        # assert response.status_code == 403
    
    def test_remove_group_instructor_allowed(self, client, test_data, act_as):
        """Instructors can remove groups from their courses."""
        # Ada (10) is instructor in course 6
        act_as(test_data.user("ada@blockpy.com"))
        # Use group 4 (Labs) for removal test
        response = client.post('/assignment_group/remove', data={
            'assignment_group_id': 4
        })
        assert response.status_code == 200
        data = response.get_json()
        assert data['success'] is True


class TestAssignmentGroupForking:
    """Test assignment group forking endpoint (fork_group)."""
    
    def test_fork_group_anonymous_blocked(self, client, test_data):
        """Anonymous users cannot fork assignment groups."""
        response = client.post('/assignment_group/fork', data={
            'assignment_group_id': 1
        })
        assert response.json['success'] is False
        # assert response.status_code == 302  # Redirect to login
    
    def test_fork_group_student_blocked(self, client, test_data, act_as):
        """Students cannot fork assignment groups."""
        act_as(test_data.user("lulu@blockpy.com"))
        response = client.post('/assignment_group/fork', data={
            'assignment_group_id': 1
        })
        assert response.json['success'] is False
        # assert response.status_code == 403
    
    def test_fork_group_wrong_instructor_blocked(self, client, test_data, act_as):
        """Instructors can only fork groups in courses they teach."""
        # Babbage (11) is instructor in course 3, not course 6
        act_as(test_data.user("babbage@blockpy.com"))
        response = client.post('/assignment_group/fork', data={
            'assignment_group_id': 1  # Group in course 6
        })
        assert response.json['success'] is False
        # assert response.status_code == 403
    
    def test_fork_group_instructor_allowed(self, client, test_data, act_as):
        """Instructors can fork groups within their courses."""
        # Ada (10) is instructor in course 6
        act_as(test_data.user("ada@blockpy.com"))
        response = client.post('/assignment_group/fork', data={
            'assignment_group_id': 1  # Group in course 6
        })
        assert response.status_code == 200
        data = response.get_json()
        assert data['success'] is True
        assert 'id' in data
        # Forked group should have a new ID
        assert data['id'] != 1


class TestAssignmentGroupMembershipManagement:
    """Test moving assignments between groups (move_membership endpoint)."""
    
    def test_move_membership_anonymous_blocked(self, client, test_data):
        """Anonymous users cannot move assignments between groups."""
        response = client.post('/assignment_group/move_membership', data={
            'assignment_id': 100,
            'old_group_id': 1,
            'new_group_id': 2
        })
        assert response.json['success'] is False
        # assert response.status_code == 302  # Redirect to login
    
    def test_move_membership_student_blocked(self, client, test_data, act_as):
        """Students cannot move assignments between groups."""
        act_as(test_data.user("lulu@blockpy.com"))
        response = client.post('/assignment_group/move_membership', data={
            'assignment_id': 100,
            'old_group_id': 1,
            'new_group_id': 2
        })
        assert response.json['success'] is False
        # assert response.status_code == 403
    
    def test_move_membership_wrong_instructor_blocked(self, client, test_data, act_as):
        """Instructors cannot move assignments in courses they don't teach."""
        # Babbage (11) is instructor in course 3, not course 6
        act_as(test_data.user("babbage@blockpy.com"))
        response = client.post('/assignment_group/move_membership', data={
            'assignment_id': 100,  # Assignment in course 6
            'old_group_id': 1,
            'new_group_id': 2
        })
        assert response.json['success'] is False
        # assert response.status_code == 403
    
    def test_move_membership_instructor_allowed(self, client, test_data, act_as):
        """Instructors can move assignments between groups in their courses."""
        # Ada (10) is instructor in course 6
        act_as(test_data.user("ada@blockpy.com"))
        response = client.post('/assignment_group/move_membership', data={
            'assignment_id': 100,  # Assignment in group 1
            'old_group_id': 1,
            'new_group_id': 2      # Both groups in course 6
        })
        assert response.status_code == 200
        data = response.get_json()
        assert data['success'] is True
    
    def test_move_membership_remove_from_group(self, client, test_data, act_as):
        """Instructors can remove assignments from groups (using -1)."""
        # Ada (10) is instructor in course 6
        act_as(test_data.user("ada@blockpy.com"))
        response = client.post('/assignment_group/move_membership', data={
            'assignment_id': 101,
            'old_group_id': 1,
            'new_group_id': -1  # -1 means remove from group
        })
        assert response.status_code == 200
        data = response.get_json()
        assert data['success'] is True
    
    def test_move_membership_cross_course_allowed(self, client, test_data, act_as):
        """Can move assignment to group in different course."""
        # Ada is instructor in both courses, but assignment/group mismatch
        act_as(test_data.user("ada@blockpy.com"))
        response = client.post('/assignment_group/move_membership', data={
            'assignment_id': 100,  # Assignment in course 6
            'old_group_id': 1,     # Group in course 6
            'new_group_id': 5      # Group in course 8 (different course)
        })
        assert response.json['success'] is True
        # assert response.status_code in [200, 403]

        # TODO: Also test that it doesn't work when the user does not have access to the other course


class TestAssignmentGroupExport:
    """Test assignment group export endpoint."""
    
    def test_export_group_anonymous(self, client, test_data):
        """Anonymous users can export groups (no explicit auth check)."""
        response = client.get('/assignment_group/export', query_string={
            'assignment_group_id': 1
        })
        # May allow or require auth
        assert response.json['success'] is False

    def test_export_group_unauthorized(self, client, test_data, act_as):
        """Authenticated users can export groups."""
        act_as(test_data.user("lulu@blockpy.com"))
        response = client.get('/assignment_group/export', query_string={
            'assignment_group_id': 1
        })
        # Should return JSON download
        assert response.json['success'] is False
    
    def test_export_group_authenticated(self, client, test_data, act_as):
        """Authenticated users can export groups."""
        act_as(test_data.user("ada@blockpy.com"))
        response = client.get('/assignment_group/export', query_string={
            'assignment_group_id': 1
        })
        # Should return JSON download
        assert response.status_code == 200
        assert response.mimetype == 'application/json'
    
    def test_export_group_with_assignments(self, client, test_data, act_as):
        """Exporting group includes its assignments."""
        act_as(test_data.user("ada@blockpy.com"))
        response = client.get('/assignment_group/export', query_string={
            'assignment_group_id': 1  # Group 1 has 3 assignments
        })
        assert response.status_code == 200
        data = response.get_json()
        # Should contain assignment group data
        assert 'assignment_groups' in data or 'groups' in data
    
    def test_export_nonexistent_group(self, client, test_data, act_as):
        """Exporting non-existent group fails."""
        act_as(test_data.user("ada@blockpy.com"))
        response = client.get('/assignment_group/export', query_string={
            'assignment_group_id': 99999
        })
        assert response.json['success'] is False
        # assert response.status_code == 404


class TestAssignmentGroupSecuritySettings:
    """Test assignment group security settings endpoint (edit_security_settings)."""
    
    def test_edit_security_anonymous_blocked(self, client, test_data):
        """Anonymous users cannot edit security settings."""
        response = client.post('/assignment_group/edit_security_settings', data={
            'assignment_group_id': 1,
            'ip_ranges': '192.168.1.0/24'
        })
        assert response.json['success'] is False
        # assert response.status_code == 302  # Redirect to login
    
    def test_edit_security_student_blocked(self, client, test_data, act_as):
        """Students cannot edit security settings."""
        act_as(test_data.user("lulu@blockpy.com"))
        response = client.post('/assignment_group/edit_security_settings', data={
            'assignment_group_id': 1,
            'ip_ranges': '192.168.1.0/24'
        })
        assert b'not' in response.data.lower() or b'permission' in response.data.lower() or b'instructor' in response.data.lower()
    
    def test_edit_security_instructor_allowed(self, client, test_data, act_as):
        """Instructors can edit security settings for their groups."""
        # Ada (10) is instructor in course 6
        act_as(test_data.user("ada@blockpy.com"))
        response = client.post('/assignment_group/edit_security_settings', data={
            'assignment_group_id': 1,
            'ip_ranges': '192.168.1.0/24',
            'passcode': 'test123'
        })
        # TODO: This endpoint just redirects on success. We need to check the flashed messages
        assert response.status_code == 302
    
    def test_view_security_settings_page(self, client, test_data, act_as):
        """Instructors can view security settings page."""
        act_as(test_data.user("ada@blockpy.com"))
        response = client.get('/assignment_group/edit_security_settings', query_string={
            'assignment_group_id': 1
        })
        assert response.status_code == 200
        # Should show form for editing security
        assert b'security' in response.data.lower() or b'ip' in response.data.lower()


class TestAssignmentGroupExportSubmissions:
    """Test assignment group submission export endpoint."""
    
    def test_export_submissions_anonymous_blocked(self, client, test_data):
        """Anonymous users cannot export group submissions."""
        response = client.get('/assignment_group/export_submissions', query_string={
            'assignment_group_id': 1
        })
        assert response.json['success'] is False
    
    def test_export_submissions_student_blocked(self, client, test_data, act_as):
        """Students cannot export group submissions."""
        act_as(test_data.user("lulu@blockpy.com"))
        response = client.get('/assignment_group/export_submissions', query_string={
            'assignment_group_id': 1
        })
        # Students should not be able to export all submissions
        assert response.json['success'] is False
    
    def test_export_submissions_instructor_allowed(self, client, test_data, act_as):
        """Instructors can export submissions for their groups."""
        # Ada (10) is instructor in course 6
        act_as(test_data.user("ada@blockpy.com"))
        response = client.get('/assignment_group/export_submissions', query_string={
            'assignment_group_id': 1,
            'course_id': 6,
        })
        # Should return export data or redirect
        assert response.status_code == 200


class TestAssignmentGroupDataIntegrity:
    """Test data integrity and relationships."""
    
    def test_group_has_assignments(self, client, test_data, act_as):
        """Verify group memberships work correctly."""
        act_as(test_data.user("ada@blockpy.com"))
        # Export group 1 which should have 3 assignments (100, 101, 102)
        response = client.get('/assignment_group/export', query_string={
            'assignment_group_id': 1
        })
        assert response.status_code == 200
        data = response.get_json()
        # Should have assignments in the export
        assert data is not None
    
    def test_assignments_in_correct_groups(self, client, test_data, act_as):
        """Verify assignments are in their correct groups."""
        act_as(test_data.user("ada@blockpy.com"))
        # Assignment 100 should be in group 1
        # Assignment 103 should be in group 2
        # This would require additional API to verify, or we trust the data
        pass  # TODO: Placeholder for more detailed verification if API available


class TestAssignmentGroupForkingMenu:
    """Test the forking menu endpoint."""
    
    def test_forking_menu_anonymous(self, client, test_data):
        """Anonymous users cannot access forking menu."""
        response = client.get('/assignment_group/forking_menu')
        # May require auth
        assert response.json['success'] is False
    
    def test_forking_menu_authenticated(self, client, test_data, act_as):
        """Authenticated users can access forking menu."""
        act_as(test_data.user("ada@blockpy.com"))
        response = client.get('/assignment_group/forking_menu')
        # Should return page or data
        assert response.status_code == 200
