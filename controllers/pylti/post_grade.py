from typing import Optional, Tuple
from quart import Blueprint, url_for, session, request, jsonify, g, render_template, redirect, Response, \
    send_from_directory, current_app
from common.urls import normalize_url
from common.filesystem import ensure_dirs
from controllers.auth import get_user, get_consumer_secrets
#from controllers.endpoints.blockpy import TransmissionStatuses
from controllers.helpers import (ajax_failure, parse_assignment_load, require_request_parameters,
                                 get_course_id, maybe_int, check_resource_exists, ajax_success,
                                 login_required, require_course_instructor, require_course_grader, maybe_bool,
                                 make_log_entry)
from controllers.jinja_filters import to_iso_time
from controllers.pylti.common import LTIPostMessageException
from controllers.pylti.flask import LTI
from models import Submission, User, GradeHistory
from models.assignment_group import AssignmentGroup
from models.course import Course
from dataclasses import dataclass

from models.generics.definitions import LogEventType
from models.enums import SubmissionStatuses, GradingStatuses


class TransmissionStatuses:
    SUCCESS = "success"
    FAILURE = "failure"
    UNCHANGED = "unchanged"
    # TBD if needed
    QUEUED = "queued"
    UNKNOWN = "unknown"


@dataclass
class GradePost:
    total_score: float
    view_url: str
    lis_result_sourcedid: str
    lis_outcome_service_url: str
    needs_review: bool
    date_submitted: str
    send_even_if_equal: bool
    overwrite_human_grades: bool

    def submit(self):
        lti = LTI(get_consumer_secrets(current_app))
        session['lis_outcome_service_url'] = self.lis_outcome_service_url
        if lti:
            existing_grade = lti.get_grade(endpoint=self.lis_result_sourcedid)
            if existing_grade == self.total_score and not self.send_even_if_equal:
                return TransmissionStatuses.UNCHANGED, "LTI Error while getting existing grade."
            successful = lti.post_grade(self.total_score, self.view_url,
                                        endpoint=self.lis_result_sourcedid, url=True,
                                        needs_review=self.needs_review,
                                        when_submitted_at=to_iso_time(self.date_submitted))
            if successful:
                return TransmissionStatuses.SUCCESS, ""
            else:
                return TransmissionStatuses.FAILURE, "LTI Error: perhaps invalid score?"
        return TransmissionStatuses.FAILURE, "LTI Error: perhaps invalid configuration?"


@dataclass
class GradingReport:
    assignment_id: int
    assignment_version: int
    assignment_group_id: int
    course_id: int
    grader_id: int
    student_id: int
    submission_id: int
    submission_version: int
    by_human: bool
    # Tracking client timestamps
    client_timestamp: str
    client_timezone: str
    # Outcomes
    correct: bool
    score: float
    view_url: str
    # Per-assignment custom feedback (e.g., from quizzes)
    feedbacks: any
    # Meta Status
    # An ordered, student-showable message for why things failed (first is most likely)
    failure_reasons: list[tuple[str, str]]
    # Whether there were errors during grading
    no_errors: bool
    # Whether the grade actually changed value
    changed: bool
    # Whether this was successfuly sent to the LMS
    submitted: bool
    # Whether to retry with delayed Task
    retrying: bool

    def add_reason(self, reason, details=""):
        self.no_errors = reason == FailureReasons.NO_GRADE_CHANGE
        self.failure_reasons.append((reason, details))
        return self

    def log(self, event_type, message, category='', label='', file_path='',
            when=None, when_timezone=None):
        return make_log_entry(self.submission_id, self.submission_version, self.assignment_id, self.assignment_version, self.course_id,
                              self.student_id, event_type, file_path, category, label,
                              message, when, when_timezone)

    def block_ip_address(self, ip_address):
        message = (f"Your ({self.grader_id}) IP address ({ip_address}) is not allowed "
                   f"and you are not a grader in this course ({self.course_id}).")
        self.log(LogEventType.IP_ADDRESS_BLOCKED, message)
        return self.add_reason(FailureReasons.INVALID_IP_ADDRESS, message)

    def create_grade_post(self, submission, course, send_even_if_equal, overwrite_human_grades, at_time):
        #   If the assignment is late, use alternate grading data
        #   Use the date_submitted, not the date_graded
        total_score, view_url, explanations = get_outcomes(submission,
                                             self.assignment_group_id,
                                             self.student_id,
                                             course.id,
                                             at_time)
        return GradePost(total_score, view_url,
                         submission.endpoint, course.endpoint,
                         submission.assignment.reviewed and not self.by_human,
                         submission.date_submitted,
                         send_even_if_equal,
                         overwrite_human_grades)

    def handle_transmission_result(self, transmission_status, error, submission, grade_post, submission_score):
        # If success, log the event
        if transmission_status == TransmissionStatuses.SUCCESS:
            self.submitted = True
            self.log(LogEventType.LMS_SUBMISSION, f"{grade_post.total_score}|{submission_score}")
            return True
        elif transmission_status == TransmissionStatuses.UNCHANGED:
            self.submitted = False
            self.log(LogEventType.LMS_UNCHANGED, f"{grade_post.total_score}|{submission_score}")
            return True
        # If it fails, queue another attempt
        elif transmission_status == TransmissionStatuses.FAILURE:
            self.no_errors = False
            self.submitted = False
            submission.update_grading_status(GradingStatuses.FAILED)
            self.log(LogEventType.LMS_FAILURE, error)
            return False

    def for_ajax(self):
        submission = Submission.by_id(self.submission_id)
        submission_status = submission.submission_status if submission is not None else ""
        grading_status = submission.grading_status if submission is not None else ""
        return {
            "submitted": self.submitted,
            "changed": self.changed,
            "correct": self.correct,
            "message": self.failure_reasons[0] if self.failure_reasons else "",
            "feedbacks": self.feedbacks,
            'submission_status': submission_status,
            "grading_status": grading_status
        }


class FailureReasons:
    NO_SUBMISSION = "No submission found"
    NO_ASSIGNMENT = "No assignment or assignment group was found for this submission"
    NO_COURSE = "No course was found for this submission"
    NO_STUDENT = "No student was found for this submission"
    NO_USER = "User was not logged in"
    INVALID_PERMISSIONS = "User does not own submission and is not a grader in this course"
    NO_GRADING_CONTEXT = "This course is not connected to an LTI gradebook"
    NOT_GRADED_ASSIGNMENT = "You did not launch this assignment from the Modules view"
    NOT_STUDENT = "There was no LTI submission because you are not a student"
    NO_GRADE_CHANGE = "The grade did not change"
    INVALID_IP_ADDRESS = "The IP address was not allowed"
    PASSWORD_INCORRECT = "The password was incorrect"
    LTI_FAILURE = "The LTI request failed"
    BROKEN_QUIZ_ASSIGNMENT = "The quiz's grading is broken"
    BROKEN_QUIZ_SUBMISSION = "Your quiz submission was broken"
    INVALID_SUBMISSION_STATUS = "The given submission status is invalid"


def grade_submission(submission_id: int, assignment_group_id,
                     grader: User, ip_address: str,
                     client_score, client_correct, client_status, image,
                     force_update, by_human=False,
                     date_submitted=None,
                     overwrite_human_grades=False, must_be_grader=False):
    """
    Main grading logic for a submission. This can be called more than once, if
    a transfer request is being attempted again.

    If a submission is part of a group, this will update the submission but
    will not modify any of the other submissions. They are part of the total
    calculation, however.

    Will update the submission's score, correct, date_submitted, if values changed.
    The date_submitted will also update if this is reviewed and the human did not submit the grade.
    If the grade changes, then the GradeHistory will be updated to reflect this.

    :param must_be_grader:
    :param overwrite_human_grades:
    :param client_status:
    :param date_submitted:
    :param grader:
    :param ip_address:
    :param by_human: Effectively, whether a human grader sent this in.
    :param submission_id:
    :param assignment_group_id: Might be None if not given by query, in which
        case use the submission's assignment's group. Might still be none too.
    :param client_score:
    :param client_correct:
    :param image:
    :param force_update:
    :return:
    """
    submission = Submission.by_id(submission_id)
    # Create the GradingReport, prepopulated with some information
    report = GradingReport(None, None,
                           assignment_group_id,
                           None, None, None, submission_id, 0,
                           by_human,
                           request.values.get('timestamp'), request.values.get('timezone'),
                           client_correct, client_score, None, {}, [],
                           True, None, None, None)
    # Check if the submission exists
    if submission is None:
        return report.add_reason(FailureReasons.NO_SUBMISSION)
    report.assignment_id = submission.assignment_id
    report.assignment_version = submission.assignment_version
    report.submission_version = submission.version
    if assignment_group_id is None:
        report.assignment_group_id = submission.assignment_group_id
    if client_correct is None:
        report.correct = submission.correct
    if client_score is None:
        report.score = submission.score
    report.course_id = submission.course_id
    report.student_id = submission.user_id
    # Check assignment, course, and student exist
    assignment = submission.assignment
    if assignment is None:
        return report.add_reason(FailureReasons.NO_ASSIGNMENT)
    course = submission.course
    if course is None:
        return report.add_reason(FailureReasons.NO_COURSE)
    student = submission.user
    if student is None:
        return report.add_reason(FailureReasons.NO_STUDENT)
    # Check grader exists
    if grader is None:
        return report.add_reason(FailureReasons.NO_USER)
    report.grader_id = grader.id
    # Verify all permissions needed
    is_grader_for_submission = grader.is_grader(course.id)
    if (not is_grader_for_submission and
            (submission.user_id != grader.id or must_be_grader)):
        return report.add_reason(FailureReasons.INVALID_PERMISSIONS)
    # Check IP address stuff
    if not assignment.is_allowed(ip_address):
        if not is_grader_for_submission:
            return report.block_ip_address(ip_address)
    # TODO: Check password stuff
    # If quiz, do the backend grading (might eventually support other kinds)
    quiz = submission.regrade_if_quiz()
    if quiz is not False:
        if quiz.graded_successfully:
            report.score = quiz.score
            report.correct = quiz.correct
            report.feedbacks = quiz.feedbacks
        else:
            submission.update_grading_status(GradingStatuses.FAILED)
            report.log(LogEventType.QUIZ_GRADE_FAILURE, quiz.error)
            return report.add_reason(FailureReasons.BROKEN_QUIZ_ASSIGNMENT, quiz.error)
    # Otherwise, just update the grade using client information
    if client_score or client_correct or quiz:
        report.changed = submission.update_submission(report.score,
                                                      report.correct, report.by_human,
                                                      date_submitted)
    elif client_status:
        valid_status = submission.update_submission_status(client_status)
        report.log(LogEventType.SUBMIT, f"{client_status}|{valid_status}")
        if not valid_status:
            return report.add_reason(FailureReasons.INVALID_SUBMISSION_STATUS)
    else:
        report.changed = False
    # Handle human grading
    if by_human:
        submission.update_grading_status(GradingStatuses.FULLY_GRADED)
    # Save the block image, if it was provided
    if image:
        submission.save_block_image(image)
    # Stop if no change and not force_update (NO_GRADE_CHANGE)
    if not report.changed and not force_update:
        return report.add_reason(FailureReasons.NO_GRADE_CHANGE)
    # Create the LTI submission bundle
    grade_post = report.create_grade_post(submission, course, force_update, overwrite_human_grades, date_submitted)
    # Grade change officially happened! Add this outcome to the grade history
    submission_score = submission.full_score()
    GradeHistory.remember(submission.id, grader.id, submission.full_score(), date_submitted)
    # Stop if the LTI stuff is not available (NOT_GRADED_ASSIGNMENT, NO_GRADING_CONTEXT)
    if not submission.endpoint:
        # Stop if the submission user is a grader (NOT_STUDENT)
        if student.is_grader(course.id):
            return report.add_reason(FailureReasons.NOT_STUDENT)
        return report.add_reason(FailureReasons.NOT_GRADED_ASSIGNMENT)
    if not course.endpoint:
        return report.add_reason(FailureReasons.NO_GRADING_CONTEXT)
    # Try to send the LTI submission bundle
    try:
        transmission_status, error = grade_post.submit()
    except LTIPostMessageException as e:
        transmission_status = TransmissionStatuses.FAILURE
        error = str(e)
    # Handle the result
    transmission_successful = report.handle_transmission_result(transmission_status, error, submission, grade_post, submission_score)
    if not transmission_successful:
        report.retrying = True
        from tasks.tasks import queue_grade_submission
        queue_grade_submission(report, 3, force_update, overwrite_human_grades, submission_score, date_submitted)
        return report.add_reason(FailureReasons.LTI_FAILURE, error)
    return report


def get_groups_submissions(group_id, user_id, course_id):
    group = AssignmentGroup.by_id(group_id)
    check_resource_exists(group, "AssignmentGroup", group_id)
    assignments = group.get_assignments()
    submissions = [assignment.load(user_id, course_id=course_id) for assignment in assignments]
    return group, assignments, submissions


def calculate_submissions_score(assignments, submissions, at_time):
    total_possible, total_score, all_explanations = 0, 0, {}
    for submission, assignment in zip(submissions, assignments):
        if submission is None:
            continue
        penalized_score, explanations = submission.penalized_full_score(at_time)
        total_score += penalized_score
        all_explanations[assignment.id] = explanations
        total_possible += assignment.get_points()
    if total_score < 0:
        total_score = 0
    return total_score, total_possible, all_explanations


def get_outcomes(submission, assignment_group_id, user_id, course_id, at_time) -> 'Tuple[float, str, list[str]]':
    if assignment_group_id is None:
        penalized_score, explanations = submission.penalized_full_score(at_time)
        score = round(penalized_score, 2)
        url = url_for("assignments.load", _external=True, embed=True,
                      submission_id=submission.id, grade_mode="single",
                      _scheme="https")
    else:
        group, assignments, submissions = get_groups_submissions(assignment_group_id, user_id, course_id)
        total, possible, explanations = calculate_submissions_score(assignments, submissions, at_time)
        score = round(total / possible, 2)
        url = url_for("assignments.load", _external=True, embed=True,
                      assignment_group_id=assignment_group_id,
                      course_id=course_id, grade_mode="group", graded_user_id=user_id,
                      _scheme="https",
                      #single_arg_hack=f"true-group-{assignment_group_id}-{course_id}-{user_id}"
                      )
    return score, url, explanations
