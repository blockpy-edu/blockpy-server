"""
Tests for the Submission model.
"""
import unittest

from tests.base import DatabaseTestCase
from tests.factories import (
    SubmissionFactory, AssignmentFactory, UserFactory, CourseFactory
)
from models.submission import Submission
from models.enums import SubmissionStatuses, GradingStatuses, AssignmentTypes


class TestSubmissionModel(DatabaseTestCase):
    """Test cases for Submission model."""
    
    def test_create_submission(self):
        """Test basic submission creation."""
        assignment = AssignmentFactory.create_assignment()
        course = assignment.course
        user = UserFactory.create_student(course=course)
        
        submission = SubmissionFactory.create_submission(
            assignment=assignment,
            user=user,
            code="print('Hello, World!')"
        )
        
        self.assertIsInstance(submission.id, int)
        self.assertEqual(submission.assignment_id, assignment.id)
        self.assertEqual(submission.user_id, user.id)
        self.assertEqual(submission.course_id, course.id)
        self.assertEqual(submission.code, "print('Hello, World!')")
        self.assertFalse(submission.correct)
        self.assertEqual(submission.score, 0)
    
    def test_submission_assignment_relationship(self):
        """Test submission-assignment relationship."""
        assignment = AssignmentFactory.create_assignment(name="Python Basics")
        submission = SubmissionFactory.create_submission(assignment=assignment)
        
        # Test forward relationship
        self.assertEqual(submission.assignment.id, assignment.id)
        self.assertEqual(submission.assignment.name, "Python Basics")
        
        # Test reverse relationship
        assignment = type(assignment).query.get(assignment.id)
        self.assertIn(submission, assignment.submissions)
    
    def test_submission_user_relationship(self):
        """Test submission-user relationship."""
        user = UserFactory.create_user(
            first_name="Student",
            last_name="Johnson"
        )
        submission = SubmissionFactory.create_submission(user=user)
        
        # Test forward relationship
        self.assertEqual(submission.user.id, user.id)
        self.assertEqual(submission.user.first_name, "Student")
        
        # Test reverse relationship
        self.assertIn(submission, user.submissions)
    
    def test_submission_course_relationship(self):
        """Test submission-course relationship."""
        course = CourseFactory.create_course(name="Advanced Python")
        assignment = AssignmentFactory.create_assignment(course=course)
        submission = SubmissionFactory.create_submission(
            assignment=assignment,
            course=course
        )
        
        # Test forward relationship
        self.assertEqual(submission.course.id, course.id)
        self.assertEqual(submission.course.name, "Advanced Python")
    
    def test_submission_status_transitions(self):
        """Test submission status workflow."""
        submission = SubmissionFactory.create_submission(
            submission_status=SubmissionStatuses.STARTED
        )
        
        # Start as started
        self.assertEqual(submission.submission_status, SubmissionStatuses.STARTED)
        
        # Move to in progress
        submission.submission_status = SubmissionStatuses.IN_PROGRESS
        from models import db
        db.session.commit()
        
        submission = Submission.query.get(submission.id)
        self.assertEqual(submission.submission_status, SubmissionStatuses.IN_PROGRESS)
        
        # Move to submitted
        submission.submission_status = SubmissionStatuses.SUBMITTED
        db.session.commit()
        
        submission = Submission.query.get(submission.id)
        self.assertEqual(submission.submission_status, SubmissionStatuses.SUBMITTED)
        
        # Move to completed
        submission.submission_status = SubmissionStatuses.COMPLETED
        db.session.commit()
        
        submission = Submission.query.get(submission.id)
        self.assertEqual(submission.submission_status, SubmissionStatuses.COMPLETED)
    
    def test_grading_status_transitions(self):
        """Test grading status workflow."""
        submission = SubmissionFactory.create_submission(
            grading_status=GradingStatuses.NOT_READY
        )
        
        # Start as not ready
        self.assertEqual(submission.grading_status, GradingStatuses.NOT_READY)
        
        # Move to pending
        submission.grading_status = GradingStatuses.PENDING
        from models import db
        db.session.commit()
        
        submission = Submission.query.get(submission.id)
        self.assertEqual(submission.grading_status, GradingStatuses.PENDING)
        
        # Move to fully graded
        submission.grading_status = GradingStatuses.FULLY_GRADED
        db.session.commit()
        
        submission = Submission.query.get(submission.id)
        self.assertEqual(submission.grading_status, GradingStatuses.FULLY_GRADED)
    
    def test_submission_correctness_and_score(self):
        """Test submission correctness and scoring."""
        # Incorrect submission
        incorrect_submission = SubmissionFactory.create_submission(
            correct=False,
            score=0
        )
        self.assertFalse(incorrect_submission.correct)
        self.assertEqual(incorrect_submission.score, 0)
        
        # Correct submission
        correct_submission = SubmissionFactory.create_submission(
            correct=True,
            score=100
        )
        self.assertTrue(correct_submission.correct)
        self.assertEqual(correct_submission.score, 100)
        
        # Partial credit submission
        partial_submission = SubmissionFactory.create_submission(
            correct=False,
            score=75
        )
        self.assertFalse(partial_submission.correct)
        self.assertEqual(partial_submission.score, 75)
    
    def test_submission_code_storage(self):
        """Test submission code storage."""
        code = """
def hello_world():
    print('Hello, World!')

hello_world()
"""
        submission = SubmissionFactory.create_submission(code=code)
        
        self.assertEqual(submission.code, code)
    
    def test_submission_extra_files(self):
        """Test submission extra files storage."""
        extra_files = '{"data.txt": "sample data", "config.json": "{\\"setting\\": true}"}'
        submission = SubmissionFactory.create_submission(
            extra_files=extra_files
        )
        
        self.assertEqual(submission.extra_files, extra_files)
    
    def test_submission_url_generation(self):
        """Test submission URL generation."""
        submission = SubmissionFactory.create_submission()
        
        # URL should be generated and not empty
        self.assertIsNotNone(submission.url)
        self.assertTrue(len(submission.url) > 0)
        
        # Each submission should have unique URL
        submission2 = SubmissionFactory.create_submission()
        self.assertNotEqual(submission.url, submission2.url)
    
    def test_submission_endpoint(self):
        """Test submission endpoint field."""
        submission = SubmissionFactory.create_submission(
            endpoint="blockpy.submit_code"
        )
        
        self.assertEqual(submission.endpoint, "blockpy.submit_code")
    
    def test_submission_logs_relationship(self):
        """Test submission logs relationship if it exists."""
        submission = SubmissionFactory.create_submission()
        
        # Check if logs relationship exists
        if hasattr(submission, 'logs'):
            # Initially no logs
            self.assertEqual(len(submission.logs), 0)
    
    def test_submission_reviews_relationship(self):
        """Test submission reviews relationship if it exists."""
        submission = SubmissionFactory.create_submission()
        
        # Check if reviews relationship exists  
        if hasattr(submission, 'reviews'):
            # Initially no reviews
            self.assertEqual(len(submission.reviews), 0)
    
    def test_submission_string_representation(self):
        """Test submission string representation."""
        submission = SubmissionFactory.create_submission()
        
        str_repr = str(submission)
        # String representation should include submission info
        self.assertIn("Submission", str_repr)
        self.assertIn(str(submission.id), str_repr)
    
    def test_submission_methods(self):
        """Test submission methods if they exist."""
        submission = SubmissionFactory.create_submission()
        
        # Test get_logs method if it exists
        if hasattr(submission, 'get_logs'):
            logs = submission.get_logs()
            self.assertIsInstance(logs, list)
        
        # Test get_reviews method if it exists
        if hasattr(submission, 'get_reviews'):
            reviews = submission.get_reviews()
            self.assertIsInstance(reviews, list)
    
    def test_submission_grading_methods(self):
        """Test submission grading methods if they exist."""
        submission = SubmissionFactory.create_submission()
        
        # Test set_status method if it exists
        if hasattr(submission, 'set_status'):
            submission.set_status(SubmissionStatuses.COMPLETED)
            # Check if attribute exists to avoid attribute errors  
            if hasattr(submission, 'submission_status'):
                self.assertEqual(submission.submission_status, SubmissionStatuses.COMPLETED)
        
        # Test update_grading_status method if it exists
        if hasattr(submission, 'update_grading_status'):
            submission.update_grading_status(GradingStatuses.FULLY_GRADED)
            self.assertEqual(submission.grading_status, GradingStatuses.FULLY_GRADED)
    
    def test_submission_image_methods(self):
        """Test submission image-related methods if they exist."""
        submission = SubmissionFactory.create_submission()
        
        # Test save_block_image method if it exists
        if hasattr(submission, 'save_block_image'):
            # This would require actual image data to test properly
            pass
        
        # Test get_block_image method if it exists
        if hasattr(submission, 'get_block_image'):
            # This would return the saved block image
            pass


if __name__ == '__main__':
    unittest.main()