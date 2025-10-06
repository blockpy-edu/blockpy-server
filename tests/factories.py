"""
Sample data factories for creating test data.
"""
import uuid
from datetime import datetime, timezone
from typing import Optional, Dict, Any

from flask_security.utils import hash_password

from models import db
from models.user import User
from models.course import Course
from models.assignment import Assignment
from models.assignment_group import AssignmentGroup
from models.submission import Submission
from models.role import Role
from models.enums.roles import UserRoles
from models.enums import (
    CourseVisibility, CourseKind, CourseService, AssignmentStatus, 
    AssignmentTypes, SubmissionStatuses, GradingStatuses, AssignmentGroupCategory
)


class UserFactory:
    """Factory for creating test users."""
    
    @staticmethod
    def create_user(
        email: Optional[str] = None,
        first_name: str = "Test", 
        last_name: str = "User",
        password: str = "testpassword",
        active: bool = True,
        **kwargs
    ) -> User:
        """Create a test user."""
        if email is None:
            email = f"test_{uuid.uuid4().hex[:8]}@example.com"
        
        user = User(
            email=email,
            first_name=first_name,
            last_name=last_name,
            password=hash_password(password),
            active=active,
            fs_uniquifier=uuid.uuid4().hex,
            **kwargs
        )
        db.session.add(user)
        db.session.commit()
        return user
    
    @staticmethod
    def create_instructor(
        course: Optional[Course] = None,
        **kwargs
    ) -> User:
        """Create a test instructor user."""
        # Set default name if not provided
        if 'first_name' not in kwargs:
            kwargs['first_name'] = "Instructor"
        if 'last_name' not in kwargs:
            kwargs['last_name'] = "Test"
        
        user = UserFactory.create_user(**kwargs)
        
        if course:
            role = Role(
                user_id=user.id,
                course_id=course.id,
                name=UserRoles.INSTRUCTOR
            )
            db.session.add(role)
            db.session.commit()
        
        return user
    
    @staticmethod
    def create_student(
        course: Optional[Course] = None,
        **kwargs
    ) -> User:
        """Create a test student user."""
        # Set default name if not provided
        if 'first_name' not in kwargs:
            kwargs['first_name'] = "Student"
        if 'last_name' not in kwargs:
            kwargs['last_name'] = "Test"
        
        user = UserFactory.create_user(**kwargs)
        
        if course:
            role = Role(
                user_id=user.id,
                course_id=course.id,
                name=UserRoles.LEARNER
            )
            db.session.add(role)
            db.session.commit()
        
        return user


class CourseFactory:
    """Factory for creating test courses."""
    
    @staticmethod
    def create_course(
        name: str = "Test Course",
        owner: Optional[User] = None,
        url: Optional[str] = None,
        visibility: CourseVisibility = CourseVisibility.PRIVATE,
        **kwargs
    ) -> Course:
        """Create a test course."""
        if owner is None:
            owner = UserFactory.create_instructor()
        
        if url is None:
            url = f"test-course-{uuid.uuid4().hex[:8]}"
        
        course = Course(
            name=name,
            owner_id=owner.id,
            url=url,
            visibility=visibility,
            kind=CourseKind.DEFAULT,
            service=CourseService.NATIVE,
            **kwargs
        )
        db.session.add(course)
        db.session.commit()
        return course


class AssignmentGroupFactory:
    """Factory for creating test assignment groups."""
    
    @staticmethod
    def create_assignment_group(
        name: str = "Test Assignment Group",
        course: Optional[Course] = None,
        owner: Optional[User] = None,
        url: Optional[str] = None,
        **kwargs
    ) -> AssignmentGroup:
        """Create a test assignment group."""
        if course is None:
            course = CourseFactory.create_course()
        
        if owner is None:
            owner = course.owner
        
        if url is None:
            url = f"test-group-{uuid.uuid4().hex[:8]}"
        
        # Set default category if not provided in kwargs
        if 'category' not in kwargs:
            kwargs['category'] = AssignmentGroupCategory.NONE
        
        group = AssignmentGroup(
            name=name,
            course_id=course.id,
            owner_id=owner.id,
            url=url,
            **kwargs
        )
        db.session.add(group)
        db.session.commit()
        return group


class AssignmentFactory:
    """Factory for creating test assignments."""
    
    @staticmethod
    def create_assignment(
        name: str = "Test Assignment",
        course: Optional[Course] = None,
        owner: Optional[User] = None,
        url: Optional[str] = None,
        assignment_type: AssignmentTypes = AssignmentTypes.PYTHON,
        **kwargs
    ) -> Assignment:
        """Create a test assignment."""
        if course is None:
            course = CourseFactory.create_course()
        
        if owner is None:
            owner = course.owner
        
        if url is None:
            url = f"test-assignment-{uuid.uuid4().hex[:8]}"
        
        # Set default status if not provided in kwargs
        if 'status' not in kwargs:
            kwargs['status'] = AssignmentStatus.PUBLISHED
        
        # Set default instructions if not provided in kwargs
        if 'instructions' not in kwargs:
            kwargs['instructions'] = "This is a test assignment."
        
        assignment = Assignment(
            name=name,
            course_id=course.id,
            owner_id=owner.id,
            url=url,
            type=assignment_type,
            **kwargs
        )
        db.session.add(assignment)
        db.session.commit()
        return assignment


class SubmissionFactory:
    """Factory for creating test submissions."""
    
    @staticmethod
    def create_submission(
        assignment: Optional[Assignment] = None,
        user: Optional[User] = None,
        course: Optional[Course] = None,
        assignment_group: Optional[AssignmentGroup] = None,
        code: str = "print('Hello, World!')",
        correct: bool = False,
        **kwargs
    ) -> Submission:
        """Create a test submission."""
        if assignment is None:
            assignment = AssignmentFactory.create_assignment()
        
        if course is None:
            course = assignment.course
        
        if user is None:
            user = UserFactory.create_student(course=course)
        
        submission_kwargs = {
            "assignment_id": assignment.id,
            "user_id": user.id,
            "course_id": course.id,
            "code": code,
            "correct": correct,
            "submission_status": SubmissionStatuses.COMPLETED if correct else SubmissionStatuses.STARTED,
            "grading_status": GradingStatuses.FULLY_GRADED if correct else GradingStatuses.NOT_READY,
            "url": f"submission-{uuid.uuid4().hex[:8]}",
            **kwargs
        }
        
        # Add assignment_group_id if provided
        if assignment_group:
            submission_kwargs["assignment_group_id"] = assignment_group.id
        
        submission = Submission(**submission_kwargs)
        db.session.add(submission)
        db.session.commit()
        return submission


class SampleDataGenerator:
    """Generate comprehensive sample data for testing."""
    
    @staticmethod
    def create_sample_course_with_data() -> Dict[str, Any]:
        """Create a complete course with users, assignments, and submissions."""
        # Create course and instructor
        instructor = UserFactory.create_instructor()
        course = CourseFactory.create_course(
            name="Introduction to Programming",
            owner=instructor
        )
        
        # Create students
        students = [
            UserFactory.create_student(course=course, first_name=f"Student{i}")
            for i in range(3)
        ]
        
        # Create assignment group
        group = AssignmentGroupFactory.create_assignment_group(
            name="Programming Basics",
            course=course,
            owner=instructor
        )
        
        # Create assignments
        assignments = [
            AssignmentFactory.create_assignment(
                name="Hello World",
                course=course,
                owner=instructor,
                type=AssignmentTypes.PYTHON
            ),
            AssignmentFactory.create_assignment(
                name="Variables and Types",
                course=course,
                owner=instructor,
                type=AssignmentTypes.PYTHON
            ),
            AssignmentFactory.create_assignment(
                name="Control Structures",
                course=course,
                owner=instructor,
                type=AssignmentTypes.PYTHON
            )
        ]
        
        # Create submissions
        submissions = []
        for student in students:
            for assignment in assignments:
                submission = SubmissionFactory.create_submission(
                    assignment=assignment,
                    user=student,
                    course=course,
                    code=f"# Solution by {student.first_name}\nprint('Assignment: {assignment.name}')",
                    correct=(student.id + assignment.id) % 2 == 0  # Some correct, some not
                )
                submissions.append(submission)
        
        return {
            'course': course,
            'instructor': instructor,
            'students': students,
            'group': group,
            'assignments': assignments,
            'submissions': submissions
        }