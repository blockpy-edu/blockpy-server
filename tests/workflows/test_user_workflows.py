"""
Tests for user workflow scenarios.
"""
import unittest

from tests.base import DatabaseTestCase
from tests.factories import (
    UserFactory, CourseFactory, AssignmentFactory, 
    SubmissionFactory, SampleDataGenerator
)
from models.user import User
from models.course import Course  
from models.assignment import Assignment
from models.submission import Submission
from models.role import Role
from models.enums.roles import UserRoles
from models.enums import (
    AssignmentStatus, AssignmentTypes, SubmissionStatuses, 
    GradingStatuses, CourseVisibility
)


class TestUserWorkflows(DatabaseTestCase):
    """Test cases for complete user workflows."""
    
    def test_instructor_course_creation_workflow(self):
        """Test complete instructor course creation and management workflow."""
        # Step 1: Create instructor
        instructor = UserFactory.create_instructor()
        
        self.assertEqual(instructor.first_name, "Instructor")
        self.assertTrue(instructor.active)
        
        # Step 2: Create course
        course = CourseFactory.create_course(
            name="Introduction to Programming",
            owner=instructor,
            visibility=CourseVisibility.PRIVATE
        )
        
        self.assertEqual(course.name, "Introduction to Programming")
        self.assertEqual(course.owner_id, instructor.id)
        self.assertEqual(course.visibility, CourseVisibility.PRIVATE)
        
        # Step 3: Create assignments
        assignment1 = AssignmentFactory.create_assignment(
            name="Hello World",
            course=course,
            owner=instructor,
            assignment_type=AssignmentTypes.PYTHON,
            instructions="Write a program that prints 'Hello, World!'"
        )
        
        assignment2 = AssignmentFactory.create_assignment(
            name="Variables and Math", 
            course=course,
            owner=instructor,
            assignment_type=AssignmentTypes.PYTHON,
            instructions="Create variables and perform basic math operations"
        )
        
        # Step 4: Verify course has assignments
        course = Course.query.get(course.id)
        self.assertEqual(len(course.assignments), 2)
        self.assertIn(assignment1, course.assignments)
        self.assertIn(assignment2, course.assignments)
        
        # Step 5: Verify instructor has multiple roles/courses
        instructor = User.query.get(instructor.id)
        self.assertEqual(len(instructor.courses), 1)
        self.assertEqual(len(instructor.assignments), 2)
    
    def test_student_enrollment_and_submission_workflow(self):
        """Test student enrollment and assignment submission workflow."""
        # Step 1: Create course and assignment
        course = CourseFactory.create_course(name="Python 101")
        assignment = AssignmentFactory.create_assignment(
            name="First Assignment",
            course=course,
            assignment_type=AssignmentTypes.PYTHON,
            status=AssignmentStatus.PUBLISHED
        )
        
        # Step 2: Create and enroll student
        student = UserFactory.create_student(course=course)
        
        # Verify enrollment
        student_roles = [role for role in student.roles if role.name == UserRoles.LEARNER]
        self.assertEqual(len(student_roles), 1)
        self.assertEqual(student_roles[0].course_id, course.id)
        
        # Step 3: Student starts assignment
        submission = SubmissionFactory.create_submission(
            assignment=assignment,
            user=student,
            course=course,
            code="# Starting my assignment",
            submission_status=SubmissionStatuses.STARTED
        )
        
        self.assertEqual(submission.submission_status, SubmissionStatuses.STARTED)
        self.assertEqual(submission.code, "# Starting my assignment")
        self.assertFalse(submission.correct)
        
        # Step 4: Student works on assignment (multiple saves)
        submission.code = "print('Hello, World!')"
        submission.submission_status = SubmissionStatuses.IN_PROGRESS
        from models import db
        db.session.commit()
        
        # Step 5: Student submits assignment
        submission.code = "print('Hello, World!')\nprint('Assignment complete!')"
        submission.submission_status = SubmissionStatuses.SUBMITTED
        submission.correct = True
        submission.score = 100
        db.session.commit()
        
        # Step 6: Verify final submission state
        final_submission = Submission.query.get(submission.id)
        self.assertEqual(final_submission.submission_status, SubmissionStatuses.SUBMITTED)
        self.assertTrue(final_submission.correct)
        self.assertEqual(final_submission.score, 100)
        
        # Step 7: Verify relationships
        self.assertEqual(final_submission.assignment.id, assignment.id)
        self.assertEqual(final_submission.user.id, student.id)
        self.assertEqual(final_submission.course.id, course.id)
    
    def test_grading_workflow(self):
        """Test assignment grading workflow."""
        # Step 1: Set up course with instructor and student
        sample_data = SampleDataGenerator.create_sample_course_with_data()
        course = sample_data['course']
        instructor = sample_data['instructor']
        students = sample_data['students']
        assignments = sample_data['assignments']
        
        # Step 2: Create submission needing grading
        student = students[0]
        assignment = assignments[0]
        
        submission = SubmissionFactory.create_submission(
            assignment=assignment,
            user=student,
            course=course,
            code="print('My solution')",
            submission_status=SubmissionStatuses.SUBMITTED,
            grading_status=GradingStatuses.NOT_READY,
            correct=False,
            score=0
        )
        
        # Step 3: Instructor reviews and grades submission
        submission.grading_status = GradingStatuses.PENDING
        from models import db
        db.session.commit()
        
        # Step 4: Instructor assigns grade
        submission.score = 85
        submission.correct = False  # Partial credit
        submission.grading_status = GradingStatuses.FULLY_GRADED
        db.session.commit()
        
        # Step 5: Mark as completed
        submission.submission_status = SubmissionStatuses.COMPLETED
        db.session.commit()
        
        # Step 6: Verify grading results
        graded_submission = Submission.query.get(submission.id)
        self.assertEqual(graded_submission.score, 85)
        self.assertEqual(graded_submission.grading_status, GradingStatuses.FULLY_GRADED)
        self.assertEqual(graded_submission.submission_status, SubmissionStatuses.COMPLETED)
    
    def test_multiple_students_same_assignment_workflow(self):
        """Test multiple students working on the same assignment."""
        # Step 1: Create course and assignment
        course = CourseFactory.create_course(name="Data Structures")
        assignment = AssignmentFactory.create_assignment(
            name="Implement Stack",
            course=course,
            assignment_type=AssignmentTypes.PYTHON
        )
        
        # Step 2: Create multiple students
        students = [
            UserFactory.create_student(course=course, first_name=f"Student{i}")
            for i in range(3)
        ]
        
        # Step 3: Each student submits solution
        submissions = []
        for i, student in enumerate(students):
            submission = SubmissionFactory.create_submission(
                assignment=assignment,
                user=student,
                course=course,
                code=f"# Solution by Student{i}\nclass Stack:\n    pass",
                correct=(i % 2 == 0),  # Every other student gets it right
                score=100 if (i % 2 == 0) else 60
            )
            submissions.append(submission)
        
        # Step 4: Verify all submissions exist
        assignment = Assignment.query.get(assignment.id)
        self.assertEqual(len(assignment.submissions), 3)
        
        # Step 5: Verify different scores
        scores = [s.score for s in submissions]
        self.assertEqual(scores, [100, 60, 100])
        
        # Step 6: Verify each student has their submission
        for student, submission in zip(students, submissions):
            student = User.query.get(student.id)
            self.assertIn(submission, student.submissions)
    
    def test_assignment_status_workflow(self):
        """Test assignment publication workflow."""
        # Step 1: Create draft assignment
        course = CourseFactory.create_course()
        assignment = AssignmentFactory.create_assignment(
            name="Draft Assignment",
            course=course,
            status=AssignmentStatus.DRAFT
        )
        
        self.assertEqual(assignment.status, AssignmentStatus.DRAFT)
        
        # Step 2: Move to pilot testing
        assignment.status = AssignmentStatus.PILOT
        from models import db
        db.session.commit()
        
        assignment = Assignment.query.get(assignment.id)
        self.assertEqual(assignment.status, AssignmentStatus.PILOT)
        
        # Step 3: Publish assignment
        assignment.status = AssignmentStatus.PUBLISHED
        db.session.commit()
        
        assignment = Assignment.query.get(assignment.id)
        self.assertEqual(assignment.status, AssignmentStatus.PUBLISHED)
        
        # Step 4: Archive old assignment
        assignment.status = AssignmentStatus.ARCHIVED
        db.session.commit()
        
        assignment = Assignment.query.get(assignment.id)
        self.assertEqual(assignment.status, AssignmentStatus.ARCHIVED)
    
    def test_course_management_workflow(self):
        """Test complete course management workflow."""
        # Step 1: Create instructor
        instructor = UserFactory.create_instructor()
        
        # Step 2: Create multiple courses
        courses = [
            CourseFactory.create_course(
                name=f"Course {i}",
                owner=instructor,
                term="Fall 2024"
            )
            for i in range(2)
        ]
        
        # Step 3: Add assignments to courses
        for course in courses:
            for j in range(2):
                AssignmentFactory.create_assignment(
                    name=f"Assignment {j+1}",
                    course=course,
                    owner=instructor
                )
        
        # Step 4: Enroll students in courses
        for course in courses:
            for k in range(2):
                UserFactory.create_student(
                    course=course,
                    first_name=f"Student{k}"
                )
        
        # Step 5: Verify instructor has multiple courses
        instructor = User.query.get(instructor.id)
        self.assertEqual(len(instructor.courses), 2)
        self.assertEqual(len(instructor.assignments), 4)  # 2 assignments × 2 courses
        
        # Step 6: Verify each course has students and assignments
        for course in courses:
            course = Course.query.get(course.id)
            self.assertEqual(len(course.assignments), 2)
            # Check roles for enrolled students
            student_roles = [r for r in course.roles if r.name == UserRoles.LEARNER]
            self.assertEqual(len(student_roles), 2)


if __name__ == '__main__':
    unittest.main()