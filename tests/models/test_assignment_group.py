"""
Tests for the AssignmentGroup model.
"""
import unittest

from tests.base import DatabaseTestCase
from tests.factories import (
    AssignmentGroupFactory, CourseFactory, UserFactory, AssignmentFactory
)
from models.assignment_group import AssignmentGroup
from models.enums import AssignmentGroupCategory


class TestAssignmentGroupModel(DatabaseTestCase):
    """Test cases for AssignmentGroup model."""
    
    def test_create_assignment_group(self):
        """Test basic assignment group creation."""
        course = CourseFactory.create_course()
        group = AssignmentGroupFactory.create_assignment_group(
            name="Week 1 Assignments",
            course=course
        )
        
        self.assertIsInstance(group.id, int)
        self.assertEqual(group.name, "Week 1 Assignments")
        self.assertEqual(group.course_id, course.id)
        self.assertEqual(group.category, AssignmentGroupCategory.NONE)
        self.assertEqual(group.position, 0)
        self.assertEqual(group.version, 0)
    
    def test_assignment_group_course_relationship(self):
        """Test assignment group-course relationship."""
        course = CourseFactory.create_course(name="Python Programming")
        group = AssignmentGroupFactory.create_assignment_group(course=course)
        
        # Test forward relationship
        self.assertEqual(group.course.id, course.id)
        self.assertEqual(group.course.name, "Python Programming")
        
        # Test reverse relationship (requires refresh)
        course = type(course).query.get(course.id)
        self.assertIn(group, course.assignment_groups)
    
    def test_assignment_group_owner_relationship(self):
        """Test assignment group-owner relationship."""
        owner = UserFactory.create_user(
            first_name="Instructor",
            last_name="Smith"
        )
        group = AssignmentGroupFactory.create_assignment_group(owner=owner)
        
        # Test forward relationship
        self.assertEqual(group.owner.id, owner.id)
        self.assertEqual(group.owner.first_name, "Instructor")
        
        # Test reverse relationship
        self.assertIn(group, owner.assignment_groups)
    
    def test_assignment_group_categories(self):
        """Test different assignment group categories."""
        course = CourseFactory.create_course()
        
        # Homework category
        homework_group = AssignmentGroupFactory.create_assignment_group(
            name="Homework Assignments",
            course=course,
            category=AssignmentGroupCategory.HOMEWORK
        )
        self.assertEqual(homework_group.category, AssignmentGroupCategory.HOMEWORK)
        
        # Lab category
        lab_group = AssignmentGroupFactory.create_assignment_group(
            name="Lab Exercises",
            course=course,
            category=AssignmentGroupCategory.LAB
        )
        self.assertEqual(lab_group.category, AssignmentGroupCategory.LAB)
        
        # Quiz category
        quiz_group = AssignmentGroupFactory.create_assignment_group(
            name="Weekly Quizzes",
            course=course,
            category=AssignmentGroupCategory.QUIZ
        )
        self.assertEqual(quiz_group.category, AssignmentGroupCategory.QUIZ)
        
        # Exam category
        exam_group = AssignmentGroupFactory.create_assignment_group(
            name="Midterm Exam",
            course=course,
            category=AssignmentGroupCategory.EXAM
        )
        self.assertEqual(exam_group.category, AssignmentGroupCategory.EXAM)
    
    def test_assignment_group_url_generation(self):
        """Test assignment group URL generation."""
        group = AssignmentGroupFactory.create_assignment_group()
        
        # URL should be generated and not empty
        self.assertIsNotNone(group.url)
        self.assertTrue(len(group.url) > 0)
        
        # Each group should have unique URL
        group2 = AssignmentGroupFactory.create_assignment_group()
        self.assertNotEqual(group.url, group2.url)
    
    def test_assignment_group_custom_url(self):
        """Test assignment group with custom URL."""
        group = AssignmentGroupFactory.create_assignment_group(
            url="custom-group-url"
        )
        
        self.assertEqual(group.url, "custom-group-url")
    
    def test_assignment_group_positioning(self):
        """Test assignment group position ordering."""
        course = CourseFactory.create_course()
        
        # Create groups with different positions
        group1 = AssignmentGroupFactory.create_assignment_group(
            name="First Group",
            course=course,
            position=1
        )
        group2 = AssignmentGroupFactory.create_assignment_group(
            name="Second Group", 
            course=course,
            position=2
        )
        group0 = AssignmentGroupFactory.create_assignment_group(
            name="Intro Group",
            course=course,
            position=0
        )
        
        # Verify positions are set correctly
        self.assertEqual(group0.position, 0)
        self.assertEqual(group1.position, 1)
        self.assertEqual(group2.position, 2)
    
    def test_assignment_group_versioning(self):
        """Test assignment group version tracking."""
        group = AssignmentGroupFactory.create_assignment_group()
        
        # New groups start at version 0
        self.assertEqual(group.version, 0)
        
        # Version can be incremented
        group.version = 1
        from models import db
        db.session.commit()
        
        group = AssignmentGroup.query.get(group.id)
        self.assertEqual(group.version, 1)
    
    def test_assignment_group_forking(self):
        """Test assignment group forking functionality."""
        # Create original group
        original_group = AssignmentGroupFactory.create_assignment_group(
            name="Original Group"
        )
        
        # Create forked group
        forked_group = AssignmentGroupFactory.create_assignment_group(
            name="Forked Group",
            forked_id=original_group.id,
            forked_version=original_group.version
        )
        
        # Test forking relationship
        self.assertEqual(forked_group.forked_id, original_group.id)
        self.assertEqual(forked_group.forked_version, original_group.version)
        
        # Test forked relationship (if properly set up in model)
        if hasattr(forked_group, 'forked') and forked_group.forked:
            self.assertEqual(forked_group.forked.id, original_group.id)
    
    def test_assignment_group_memberships_relationship(self):
        """Test assignment group memberships relationship."""
        group = AssignmentGroupFactory.create_assignment_group()
        
        # Initially no memberships
        self.assertEqual(len(group.memberships), 0)
        
        # Note: AssignmentGroupMembership creation would go here
        # if we had a factory for it
    
    def test_assignment_group_submissions_relationship(self):
        """Test assignment group submissions relationship."""
        group = AssignmentGroupFactory.create_assignment_group()
        
        # Initially no submissions
        self.assertEqual(len(group.submissions), 0)
        
        # Create submission linked to this group
        from tests.factories import SubmissionFactory
        submission = SubmissionFactory.create_submission(
            assignment_group=group
        )
        
        # Refresh group to get updated relationships
        group = AssignmentGroup.query.get(group.id)
        self.assertEqual(len(group.submissions), 1)
        self.assertEqual(group.submissions[0].id, submission.id)
    
    def test_assignment_group_string_representation(self):
        """Test assignment group string representation."""
        group = AssignmentGroupFactory.create_assignment_group(
            name="Python Fundamentals"
        )
        
        str_repr = str(group)
        # String representation includes group info
        self.assertIn("Group", str_repr)
        self.assertIn("Python Fundamentals", str_repr)
    
    def test_assignment_group_encode_json(self):
        """Test assignment group JSON encoding if method exists."""
        group = AssignmentGroupFactory.create_assignment_group(
            name="Test Group"
        )
        
        # Test JSON encoding method if it exists
        if hasattr(group, 'encode_json'):
            json_data = group.encode_json()
            self.assertIsInstance(json_data, dict)
            self.assertIn('_schema_version', json_data)


if __name__ == '__main__':
    unittest.main()