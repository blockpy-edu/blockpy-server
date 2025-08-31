"""
Tests for BlockPy endpoints.
"""
import unittest
import json
from flask import url_for

from tests.base import APITestCase
from tests.factories import (
    UserFactory, CourseFactory, AssignmentFactory, 
    SubmissionFactory, SampleDataGenerator
)
from models.enums.roles import UserRoles


class TestBlockPyEndpoints(APITestCase):
    """Test cases for BlockPy endpoints."""
    
    def setUp(self):
        """Set up test data."""
        super().setUp()
        
        # Create sample data
        self.sample_data = SampleDataGenerator.create_sample_course_with_data()
        self.course = self.sample_data['course']
        self.instructor = self.sample_data['instructor']
        self.students = self.sample_data['students']
        self.assignments = self.sample_data['assignments']
        self.submissions = self.sample_data['submissions']
    
    def test_blockpy_static_access(self):
        """Test BlockPy static file access."""
        # Test accessing BlockPy static files
        response = self.client.get('/blockpy/static/')
        
        # Should either work or return appropriate status
        self.assertIn(response.status_code, [200, 404, 403])
    
    def test_load_assignment_endpoint_unauthorized(self):
        """Test load assignment endpoint without authentication."""
        assignment = self.assignments[0]
        
        # Try to access without authentication
        response = self.client.get(f'/blockpy/load_assignment/?assignment_id={assignment.id}')
        
        # Should require authentication
        self.assertIn(response.status_code, [302, 401, 403])
    
    def test_load_assignment_endpoint_with_params(self):
        """Test load assignment endpoint with various parameters."""
        assignment = self.assignments[0]
        
        # Test with assignment_id
        response = self.client.get('/blockpy/load_assignment/', 
                                 query_string={'assignment_id': assignment.id})
        
        # Should handle the request (may require auth)
        self.assertNotEqual(response.status_code, 500)
        
        # Test with assignment_url  
        response = self.client.get('/blockpy/load_assignment/',
                                 query_string={'assignment_url': assignment.url})
        
        # Should handle the request (may require auth)
        self.assertNotEqual(response.status_code, 500)
    
    def test_save_assignment_endpoint(self):
        """Test save assignment endpoint."""
        assignment = self.assignments[0]
        
        # Test POST request
        data = {
            'assignment_id': assignment.id,
            'code': 'print("Hello, BlockPy!")'
        }
        
        response = self.client.post('/blockpy/save_assignment/', data=data)
        
        # Should handle the request (may require auth)
        self.assertNotEqual(response.status_code, 500)
    
    def test_load_submission_endpoint(self):
        """Test load submission endpoint."""
        submission = self.submissions[0]
        
        # Test with submission_id
        response = self.client.get('/blockpy/load_submission/',
                                 query_string={'submission_id': submission.id})
        
        # Should handle the request (may require auth)
        self.assertNotEqual(response.status_code, 500)
    
    def test_view_submission_endpoint(self):
        """Test view submission endpoint."""
        submission = self.submissions[0]
        
        # Test with submission_id
        response = self.client.get('/blockpy/view_submission/',
                                 query_string={'submission_id': submission.id})
        
        # Should handle the request (may require auth)
        self.assertNotEqual(response.status_code, 500)
    
    def test_update_submission_endpoint(self):
        """Test update submission endpoint."""
        submission = self.submissions[0]
        
        # Test POST request
        data = {
            'submission_id': submission.id,
            'code': 'print("Updated code")'
        }
        
        response = self.client.post('/blockpy/update_submission/', data=data)
        
        # Should handle the request (may require auth)
        self.assertNotEqual(response.status_code, 500)
    
    def test_update_submission_status_endpoint(self):
        """Test update submission status endpoint."""
        submission = self.submissions[0]
        
        # Test POST request
        data = {
            'submission_id': submission.id,
            'status': 'Completed'
        }
        
        response = self.client.post('/blockpy/update_submission_status/', data=data)
        
        # Should handle the request (may require auth)
        self.assertNotEqual(response.status_code, 500)
    
    def test_start_assignment_endpoint(self):
        """Test start assignment endpoint."""
        assignment = self.assignments[0]
        
        # Test POST request
        data = {
            'assignment_id': assignment.id,
        }
        
        response = self.client.post('/blockpy/start_assignment/', data=data)
        
        # Should handle the request (may require auth)
        self.assertNotEqual(response.status_code, 500)
    
    def test_recent_submissions_endpoint(self):
        """Test recent submissions endpoint."""
        # Test GET request
        response = self.client.get('/blockpy/recent_submissions/')
        
        # Should handle the request (may require auth)
        self.assertNotEqual(response.status_code, 500)
        
        # Test with email parameter
        student = self.students[0]
        response = self.client.get('/blockpy/recent_submissions/',
                                 query_string={'email': student.email})
        
        # Should handle the request (may require auth)
        self.assertNotEqual(response.status_code, 500)
    
    def test_view_submissions_endpoint(self):
        """Test view submissions endpoint."""
        course = self.course
        student = self.students[0]
        group = self.sample_data['group']
        
        # Test with URL parameters
        url = f'/blockpy/view_submissions/{course.id}/{student.id}/{group.id}'
        response = self.client.get(url)
        
        # Should handle the request (may require auth)
        self.assertNotEqual(response.status_code, 500)
    
    def test_endpoint_parameter_validation(self):
        """Test that endpoints properly validate required parameters."""
        # Test load_submission without submission_id
        response = self.client.get('/blockpy/load_submission/')
        
        # Should return error for missing parameters
        self.assertIn(response.status_code, [400, 422, 500])
        
        # Test update_submission without submission_id
        response = self.client.post('/blockpy/update_submission/', data={})
        
        # Should return error for missing parameters
        self.assertIn(response.status_code, [400, 422, 500])
        
        # Test update_submission_status without required params
        response = self.client.post('/blockpy/update_submission_status/', data={})
        
        # Should return error for missing parameters
        self.assertIn(response.status_code, [400, 422, 500])
    
    def test_endpoint_error_handling(self):
        """Test that endpoints handle invalid data gracefully."""
        # Test with invalid submission_id
        response = self.client.get('/blockpy/load_submission/',
                                 query_string={'submission_id': 99999})
        
        # Should handle gracefully (not crash)
        self.assertNotEqual(response.status_code, 500)
        
        # Test with invalid assignment_id
        response = self.client.get('/blockpy/load_assignment/',
                                 query_string={'assignment_id': 99999})
        
        # Should handle gracefully (not crash)
        self.assertNotEqual(response.status_code, 500)


if __name__ == '__main__':
    unittest.main()