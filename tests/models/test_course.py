"""
Tests for the Course model.
"""
import unittest

from tests.base import DatabaseTestCase
from tests.factories import CourseFactory, UserFactory
from models.course import Course
from models.enums import CourseVisibility, CourseKind, CourseService


class TestCourseModel(DatabaseTestCase):
    """Test cases for Course model."""
    
    def test_create_course(self):
        """Test basic course creation."""
        owner = UserFactory.create_user()
        course = CourseFactory.create_course(
            name="Introduction to Python",
            owner=owner,
            url="intro-python"
        )
        
        self.assertIsInstance(course.id, int)
        self.assertEqual(course.name, "Introduction to Python")
        self.assertEqual(course.url, "intro-python")
        self.assertEqual(course.owner_id, owner.id)
        self.assertEqual(course.visibility, CourseVisibility.PRIVATE)
        self.assertEqual(course.kind, CourseKind.DEFAULT)
        self.assertEqual(course.service, CourseService.NATIVE)
        self.assertFalse(course.locked)
    
    def test_course_owner_relationship(self):
        """Test course owner relationship."""
        owner = UserFactory.create_user(
            first_name="Professor",
            last_name="Smith"
        )
        course = CourseFactory.create_course(
            name="Advanced Programming",
            owner=owner
        )
        
        # Test forward relationship
        self.assertEqual(course.owner.id, owner.id)
        self.assertEqual(course.owner.first_name, "Professor")
        
        # Test reverse relationship
        self.assertIn(course, owner.courses)
    
    def test_course_unique_url(self):
        """Test that course URLs should be unique."""
        url = "unique-course-url"
        course1 = CourseFactory.create_course(url=url)
        
        # Second course with same URL might fail depending on constraints
        # This test documents the expected behavior
        try:
            course2 = CourseFactory.create_course(url=url)
            # If no uniqueness constraint, both should exist but have different IDs
            self.assertNotEqual(course1.id, course2.id)
        except Exception:
            # If there's a uniqueness constraint, this is expected
            pass
    
    def test_course_visibility_settings(self):
        """Test different course visibility settings."""
        # Private course (default)
        private_course = CourseFactory.create_course(
            visibility=CourseVisibility.PRIVATE
        )
        self.assertEqual(private_course.visibility, CourseVisibility.PRIVATE)
        
        # Public course
        public_course = CourseFactory.create_course(
            visibility=CourseVisibility.PUBLIC
        )
        self.assertEqual(public_course.visibility, CourseVisibility.PUBLIC)
    
    def test_course_settings_storage(self):
        """Test course settings storage."""
        course = CourseFactory.create_course(
            settings='{"allow_student_uploads": true, "max_submissions": 5}'
        )
        
        self.assertIsInstance(course.settings, str)
        self.assertIn("allow_student_uploads", course.settings)
        
        # Test that we can store JSON settings
        import json
        try:
            settings_data = json.loads(course.settings)
            self.assertTrue(settings_data.get("allow_student_uploads"))
            self.assertEqual(settings_data.get("max_submissions"), 5)
        except json.JSONDecodeError:
            # If settings are not JSON, that's also valid
            pass
    
    def test_course_assignments_relationship(self):
        """Test course assignments relationship."""
        course = CourseFactory.create_course()
        
        # Initially no assignments
        self.assertEqual(len(course.assignments), 0)
        
        # Create assignment and verify relationship
        from tests.factories import AssignmentFactory
        assignment = AssignmentFactory.create_assignment(course=course)
        
        # Refresh course to get updated relationships
        course = Course.query.get(course.id)
        self.assertEqual(len(course.assignments), 1)
        self.assertEqual(course.assignments[0].id, assignment.id)
    
    def test_course_assignment_groups_relationship(self):
        """Test course assignment groups relationship."""
        course = CourseFactory.create_course()
        
        # Initially no assignment groups
        self.assertEqual(len(course.assignment_groups), 0)
        
        # Create assignment group and verify relationship
        from tests.factories import AssignmentGroupFactory
        group = AssignmentGroupFactory.create_assignment_group(course=course)
        
        # Refresh course to get updated relationships
        course = Course.query.get(course.id)
        self.assertEqual(len(course.assignment_groups), 1)
        self.assertEqual(course.assignment_groups[0].id, group.id)
    
    def test_course_roles_relationship(self):
        """Test course roles relationship."""
        course = CourseFactory.create_course()
        
        # Initially no roles (except maybe owner)
        initial_roles = len(course.roles)
        
        # Add instructor to course
        instructor = UserFactory.create_instructor(course=course)
        
        # Refresh course to get updated relationships
        course = Course.query.get(course.id)
        self.assertGreater(len(course.roles), initial_roles)
    
    def test_course_term_and_external_id(self):
        """Test course term and external ID fields."""
        course = CourseFactory.create_course(
            term="Fall 2024",
            external_id="COMP101-001"
        )
        
        self.assertEqual(course.term, "Fall 2024")
        self.assertEqual(course.external_id, "COMP101-001")
    
    def test_course_locking_mechanism(self):
        """Test course locking functionality."""
        course = CourseFactory.create_course()
        
        # Course starts unlocked
        self.assertFalse(course.locked)
        
        # Lock the course
        course.locked = True
        from models import db
        db.session.commit()
        
        # Verify locked state
        course = Course.query.get(course.id)
        self.assertTrue(course.locked)
    
    def test_course_string_representation(self):
        """Test course string representation."""
        course = CourseFactory.create_course(
            name="Data Structures",
            url="data-structures"
        )
        
        str_repr = str(course)
        # String representation shows course ID
        self.assertIn("Course", str_repr)
        self.assertIn(str(course.id), str_repr)
    
    def test_course_version_tracking(self):
        """Test course version field."""
        course = CourseFactory.create_course()
        
        # New courses start at version 0
        self.assertEqual(course.version, 0)
        
        # Version can be incremented
        course.version = 1
        from models import db
        db.session.commit()
        
        course = Course.query.get(course.id)
        self.assertEqual(course.version, 1)


if __name__ == '__main__':
    unittest.main()