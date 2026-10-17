"""
Service layer for handling permissions and unified access to various models.

Ensures that the viewer has the necessary permissions to load/edit the requested model(s).

This is based on their role in relevant courses, the ownership of the model, and the visibility of the model.

The following models have permissions handled by this service:
- Course
- Assignment: hidden, ip_address, passcode
- AssignmentGroup
- AssignmentGroupMembership
- Submission
- User

Lower priority models that I may add later:
- Review
- Report
"""
from typing import TypeVar, Optional
from dataclasses import dataclass

from natsort import natsorted
from werkzeug.exceptions import HTTPException

from common.flask_extensions import safe_request
from flask import abort, jsonify, make_response

from controllers.helpers import make_log_entry
from models.user import User
from models.submission import Submission
from models.assignment import Assignment
from models.assignment_group import AssignmentGroup
from models.course import Course


class PermissionLayer:
    pass


ResourceType = TypeVar('ResourceType')

@dataclass(order=True)
class PermissionScope:
    level: int
    name: str
    can_view: bool = False
    can_edit: bool = False
    can_grade: bool = False


FULL = PermissionScope(5, 'grader', can_view=True, can_edit=True, can_grade=True)
DEVELOPER = PermissionScope(4, 'developer', can_view=True, can_edit=True, can_grade=False)
GRADER = PermissionScope(3, 'grader', can_view=True, can_edit=False, can_grade=True)
GRADER_SUBMISSION = PermissionScope(3, 'grader', can_view=True, can_edit=True, can_grade=True)
STUDENT_ASSIGNMENT = PermissionScope(2, 'student', can_view=True, can_edit=False, can_grade=False)
STUDENT_SUBMISSION = PermissionScope(2, 'student', can_view=True, can_edit=True, can_grade=False)
ANONYMOUS = PermissionScope(1, 'anonymous', can_view=True, can_edit=False, can_grade=False)



class ValidUserPermissionLayer(PermissionLayer):
    def __init__(self, user: User):
        self.user = user
        self.custom_message = None

    def get_user(self) -> tuple[User, int]:
        if self.user:
            return self.user, self.user.id
        self.abort_with_error("User not logged in, operation cannot be completed", 401)
        return None

    def check_resource_exists(self, resource: Optional[ResourceType], kind, resource_id) -> ResourceType:
        if not resource:
            message = f"The specified resource does not exist: {kind}(id={resource_id})"
            self.abort_with_error(message, 200)
        return resource

    def load_group_submissions(self, group_id: int, user_id: int, course_id: int) -> tuple[PermissionScope, AssignmentGroup, list[Assignment], list[Submission]]:
        group = AssignmentGroup.by_id(group_id)
        group = self.check_resource_exists(group, "AssignmentGroup", group_id)
        assignments = group.get_assignments()
        submissions = [assignment.load(user_id, course_id=course_id)
                       for assignment in assignments]
        for assignment, submission in zip(assignments, submissions):
            self.check_resource_exists(submission, "Submission", (assignment.id, course_id, user_id))
        checks = [self._submission_checks(submission) for submission in submissions]
        scopes = [check[0] for check in checks]
        return min(scopes), group, assignments, submissions


    def load_assignment_by_id(self, assignment_id: int, using_course_id: int = None) -> tuple[PermissionScope, Assignment]:
        assignment = Assignment.by_id(assignment_id)
        assignment = self.check_resource_exists(assignment, "Assignment", assignment_id)
        return self._assignment_checks(assignment, using_course_id)

    def _enforce_assignment_locks(self, assignment: Assignment):
        """ Abort unless the request passes the assignment's IP range and passcode locks. """
        if not assignment.is_allowed(safe_request.remote_addr):
            self.abort_with_error("You cannot access this assignment from your current location: " + safe_request.remote_addr, 403)
        possible_passcode = safe_request.get_maybe_str('passcode', '')
        if assignment.passcode_fails(possible_passcode):
            self.abort_with_error(f"Passcode '{possible_passcode}' rejected.", 200)

    def _may_adopt(self, assignment: Assignment) -> bool:
        """
        Whether the user is entitled to the assignment's content regardless of its locks: it is public,
        its home course is public, or they grade/adopt its home course (the same rule as
        courses.adopt_assignments). Anyone else who merely *uses* it in their own course gets grader
        powers over their own students' work, but must still satisfy the IP/passcode locks.
        """
        if assignment.public:
            return True
        if self.user.is_grader(assignment.course_id) or self.user.is_adopter(assignment.course_id):
            return True
        course = Course.by_id(assignment.course_id)
        return course is not None and course.visibility == 'public'

    def _grader_via_using_course(self, assignment: Assignment) -> tuple[PermissionScope, Assignment]:
        """
        GRADER scope obtained only through a course that uses the assignment. Locked assignments (IP
        ranges or passcode) keep their locks for users who could not adopt the assignment outright;
        otherwise any registered user could create a course, submit to the assignment there, and read
        a locked exam from anywhere without the passcode.
        """
        if (assignment.has_passcode() or (assignment.ip_ranges or '').strip()) and not self._may_adopt(assignment):
            self._enforce_assignment_locks(assignment)
        return GRADER, assignment

    def _assignment_checks(self, assignment: Assignment, using_course_id: Optional[int] = None) -> tuple[PermissionScope, Assignment]:
        # If the user is an admin, they can see everything. No questions asked.
        if self.user.is_admin():
            return FULL, assignment
        # If the user is an instructor of the assignment's course, they can see everything.
        assignment_course_id = assignment.course_id
        if self.user.is_instructor(assignment_course_id):
            return FULL, assignment
        # If the user is an instructor of the course the assignment is being used in, they can at least grade with it
        # ... but only if that course really uses the assignment; otherwise any instructor of any
        # course could read hidden/locked assignments just by naming their own course id.
        if using_course_id and self.user.is_instructor(using_course_id) and assignment.is_used_in_course(using_course_id):
            return self._grader_via_using_course(assignment)
        # For non-hidden assignments,
        if not assignment.hidden:
            # If the user is a grader (e.g., TA) in the course, they can see the assignment.
            if self.user.is_grader(assignment_course_id):
                return GRADER, assignment
            if (using_course_id and self.user.is_grader(using_course_id)
                    and assignment.is_used_in_course(using_course_id)):
                return self._grader_via_using_course(assignment)
        # Otherwise the assignment is hidden, so we have to do our security checks.
        self._enforce_assignment_locks(assignment)
        return STUDENT_ASSIGNMENT, assignment

    def log_submission_entry(self, submission: Submission, assignment: Assignment, event_type, message):
        make_log_entry(submission.id, submission.version, assignment.id, assignment.version, submission.course_id,
                       self.user.id, event_type, message)

    def log_assignment_entry(self, assignment: Assignment, event_type, message):
        pass

    def load_submission_by_course_user_assignment(self, course_id, user_id, assignment_id) -> tuple[PermissionScope, Submission]:
        submission = Submission.get_submission(assignment_id, user_id, course_id)
        submission = self.check_resource_exists(submission, "Submission", (assignment_id, course_id, user_id))
        return self._submission_checks(submission)

    def load_submission_by_id(self, submission_id: int) -> tuple[PermissionScope, Submission]:
        submission = Submission.by_id(submission_id)
        submission = self.check_resource_exists(submission, "Submission", submission_id)
        return self._submission_checks(submission)

    def _submission_checks(self, submission: Submission) -> tuple[PermissionScope, Submission]:
        # If the user is an admin, they can see everything. No questions asked.
        if self.user.is_admin():
            return FULL, submission
        # If the user is an instructor of the submission's course, they can see everything.
        submission_course_id = submission.course_id
        if self.user.is_instructor(submission_course_id):
            return FULL, submission
        # The remaining needs more information about the assignment.
        assignment = Assignment.by_id(submission.assignment_id)
        assignment = self.check_resource_exists(assignment, "Assignment", submission.assignment_id)
        # For non-hidden assignments,
        if not assignment.hidden:
            # If they own the submission
            if self.user.id == submission.user_id:
                # Still have to pass security checks
                if assignment.is_allowed(safe_request.remote_addr):
                    possible_passcode = safe_request.get_maybe_str('passcode', '')
                    if assignment.passcode_fails(possible_passcode):
                        self.abort_with_error(f"Passcode '{possible_passcode}' rejected.", 200)
                    if self.user.is_grader(submission_course_id):
                        return GRADER_SUBMISSION, submission
                    return STUDENT_SUBMISSION, submission
                else:
                    self.abort_with_error("You cannot access this assignment from your current location: " + safe_request.remote_addr, 403)
            # If the user is a grader (e.g., TA) in the course, they can see the submission.
            elif self.user.is_grader(submission_course_id):
                return GRADER, submission
            elif assignment.public:
                if assignment.is_allowed(safe_request.remote_addr):
                    possible_passcode = safe_request.get_maybe_str('passcode', '')
                    if assignment.passcode_fails(possible_passcode):
                        self.abort_with_error(f"Passcode '{possible_passcode}' rejected.", 200)
                    return ANONYMOUS, submission
                else:
                    self.abort_with_error("Cannot view submission. This is not a public submission, you are not an instructor in the course, and you do not own the submission.", 403)
        # If the user owns the submission, they can see it IF they pass security checks.
        if self.user.id == submission.user_id:
            if assignment.is_allowed(safe_request.remote_addr):
                possible_passcode = safe_request.get_maybe_str('passcode', '')
                if assignment.passcode_fails(possible_passcode):
                    self.abort_with_error(f"Passcode '{possible_passcode}' rejected.", 200)
                return STUDENT_SUBMISSION, submission
            else:
                self.abort_with_error("You cannot access this assignment from your current location: " + safe_request.remote_addr, 403)
        else:
            # If the user is not the owner, they cannot see the submission.
            self.abort_with_error("You cannot view this submission. You are not an instructor in the course, and you do not own the submission.", 403)

    def load_submitted_assignments_grouped(self, course_id: int, key = None, abort_on_error=True):
        if key is None:
            key = lambda r: (r.AssignmentGroup.name if r.AssignmentGroup is not None else "~~~~~~~~",
                             r.Assignment.name)
        course = Course.by_id(course_id)
        course = self.check_resource_exists(course, "Course", course_id)
        grouped_assignments = course.get_submitted_assignments_grouped()
        grouped_assignments = natsorted(grouped_assignments, key=key)
        kept = []
        errors = []
        scopes = []
        for ga in grouped_assignments:
            try:
                scope, _ = self._assignment_checks(ga.Assignment, using_course_id=course_id)
                scopes.append(scope)
                kept.append(ga)
            except HTTPException as e:
                if abort_on_error:
                    raise e
                else:
                    errors.append((ga, str(e)))
        # Return `kept` (not the full list) so it stays index-aligned with `scopes`;
        # otherwise a caller zipping the two would pair scopes with the wrong assignments.
        return kept, scopes, errors


    def abort_with_error(self, message, code):
        if self.custom_message:
            message = self.custom_message + "\n<br>\nAdditional information: " + message
        safe_request.abort_with_error(message, code)

class InvalidUserPermissionLayer(PermissionLayer):
    def __getattr__(self, name):
        safe_request.abort_with_error(f"Operation {name} is not allowed for unknown users.", 403)