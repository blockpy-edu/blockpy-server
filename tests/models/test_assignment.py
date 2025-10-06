"""
Tests for the Assignment model.
"""
import unittest

from tests.base import DatabaseTestCase
from tests.factories import AssignmentFactory, CourseFactory, UserFactory
from models.assignment import Assignment
from models.enums import AssignmentStatus, AssignmentTypes


class TestAssignmentModel(DatabaseTestCase):
    """Test cases for Assignment model."""
    
    def test_create_assignment(self):
        """Test basic assignment creation."""
        course = CourseFactory.create_course()
        assignment = AssignmentFactory.create_assignment(
            name="Python Basics",
            course=course,
            assignment_type=AssignmentTypes.PYTHON
        )
        
        self.assertIsInstance(assignment.id, int)
        self.assertEqual(assignment.name, "Python Basics")
        self.assertEqual(assignment.course_id, course.id)
        self.assertEqual(assignment.type, AssignmentTypes.PYTHON)
        self.assertEqual(assignment.status, AssignmentStatus.PUBLISHED)
        self.assertFalse(assignment.reviewed)
    
    def test_assignment_course_relationship(self):
        """Test assignment-course relationship."""
        course = CourseFactory.create_course(name="Advanced Python")
        assignment = AssignmentFactory.create_assignment(course=course)
        
        # Test forward relationship
        self.assertEqual(assignment.course.id, course.id)
        self.assertEqual(assignment.course.name, "Advanced Python")
        
        # Test reverse relationship (requires refresh)
        course = type(course).query.get(course.id)
        self.assertIn(assignment, course.assignments)
    
    def test_assignment_owner_relationship(self):
        """Test assignment-owner relationship."""
        owner = UserFactory.create_user(
            first_name="Professor",
            last_name="Johnson"
        )
        assignment = AssignmentFactory.create_assignment(owner=owner)
        
        # Test forward relationship
        self.assertEqual(assignment.owner.id, owner.id)
        self.assertEqual(assignment.owner.first_name, "Professor")
        
        # Test reverse relationship
        self.assertIn(assignment, owner.assignments)
    
    def test_assignment_status_workflow(self):
        """Test assignment status transitions."""
        assignment = AssignmentFactory.create_assignment(
            status=AssignmentStatus.DRAFT
        )
        
        # Start as draft
        self.assertEqual(assignment.status, AssignmentStatus.DRAFT)
        
        # Move to published
        assignment.status = AssignmentStatus.PUBLISHED
        from models import db
        db.session.commit()
        
        assignment = Assignment.query.get(assignment.id)
        self.assertEqual(assignment.status, AssignmentStatus.PUBLISHED)
        
        # Move to archived
        assignment.status = AssignmentStatus.ARCHIVED
        db.session.commit()
        
        assignment = Assignment.query.get(assignment.id)
        self.assertEqual(assignment.status, AssignmentStatus.ARCHIVED)
    
    def test_assignment_types(self):
        """Test different assignment types."""
        course = CourseFactory.create_course()
        
        # Python assignment
        python_assignment = AssignmentFactory.create_assignment(
            name="Python Exercise",
            course=course,
            assignment_type=AssignmentTypes.PYTHON
        )
        self.assertEqual(python_assignment.type, AssignmentTypes.PYTHON)
        
        # Quiz assignment
        quiz_assignment = AssignmentFactory.create_assignment(
            name="Python Quiz",
            course=course,
            assignment_type=AssignmentTypes.QUIZ
        )
        self.assertEqual(quiz_assignment.type, AssignmentTypes.QUIZ)
        
        # Reading assignment
        reading_assignment = AssignmentFactory.create_assignment(
            name="Chapter 1 Reading",
            course=course,
            assignment_type=AssignmentTypes.READING
        )
        self.assertEqual(reading_assignment.type, AssignmentTypes.READING)
    
    def test_assignment_instructions(self):
        """Test assignment instructions field."""
        assignment = AssignmentFactory.create_assignment(
            instructions="Write a Python program that prints 'Hello, World!'"
        )
        
        self.assertEqual(
            assignment.instructions,
            "Write a Python program that prints 'Hello, World!'"
        )
    
    def test_assignment_reviewed_flag(self):
        """Test assignment reviewed flag."""
        # Default not reviewed
        assignment = AssignmentFactory.create_assignment()
        self.assertFalse(assignment.reviewed)
        
        # Explicitly reviewed
        reviewed_assignment = AssignmentFactory.create_assignment(
            reviewed=True
        )
        self.assertTrue(reviewed_assignment.reviewed)
    
    def test_assignment_url_generation(self):
        """Test assignment URL generation."""
        assignment = AssignmentFactory.create_assignment()
        
        # URL should be generated and not empty
        self.assertIsNotNone(assignment.url)
        self.assertTrue(len(assignment.url) > 0)
        
        # Each assignment should have unique URL
        assignment2 = AssignmentFactory.create_assignment()
        self.assertNotEqual(assignment.url, assignment2.url)
    
    def test_assignment_custom_url(self):
        """Test assignment with custom URL."""
        assignment = AssignmentFactory.create_assignment(
            url="custom-assignment-url"
        )
        
        self.assertEqual(assignment.url, "custom-assignment-url")
    
    def test_assignment_submissions_relationship(self):
        """Test assignment-submissions relationship."""
        assignment = AssignmentFactory.create_assignment()
        
        # Initially no submissions
        self.assertEqual(len(assignment.submissions), 0)
        
        # Create submission and verify relationship
        from tests.factories import SubmissionFactory
        submission = SubmissionFactory.create_submission(assignment=assignment)
        
        # Refresh assignment to get updated relationships
        assignment = Assignment.query.get(assignment.id)
        self.assertEqual(len(assignment.submissions), 1)
        self.assertEqual(assignment.submissions[0].id, submission.id)
    
    def test_assignment_string_representation(self):
        """Test assignment string representation."""
        assignment = AssignmentFactory.create_assignment(
            name="Data Types Assignment"
        )
        
        str_repr = str(assignment)
        # String representation should include assignment info
        self.assertIn("Assignment", str_repr)
        self.assertIn(str(assignment.id), str_repr)
    
    def test_assignment_version_tracking(self):
        """Test assignment version field if it exists."""
        assignment = AssignmentFactory.create_assignment()
        
        # Check if version field exists and has expected default
        if hasattr(assignment, 'version'):
            self.assertEqual(assignment.version, 0)
            
            # Version can be incremented
            assignment.version = 1
            from models import db
            db.session.commit()
            
            assignment = Assignment.query.get(assignment.id)
            self.assertEqual(assignment.version, 1)


if __name__ == '__main__':
    unittest.main()