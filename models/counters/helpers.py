"""
Helper functions for updating counts tables with running statistics.

These functions implement incremental algorithms for computing running sums, averages,
and standard deviations without needing to recompute from all historical data.
"""
from datetime import datetime
from typing import Optional
from sqlalchemy_utc import utcnow
from sqlalchemy import func, or_

from models.generics.models import db
import models


def ensure_submission_counts(submission_id: int) -> "models.SubmissionCounts":
    """
    Ensure a SubmissionCounts record exists for the given submission.
    Creates one if it doesn't exist.
    
    Args:
        submission_id: The ID of the submission
        
    Returns:
        The SubmissionCounts object
    """
    from models.counters.submission_counts import SubmissionCounts
    
    counts = SubmissionCounts.query.filter_by(submission_id=submission_id).first()
    if counts is None:
        counts = SubmissionCounts(submission_id=submission_id)
        db.session.add(counts)
        db.session.commit()
    return counts


def ensure_assignment_counts(assignment_id: int) -> "models.AssignmentCounts":
    """
    Ensure an AssignmentCounts record exists for the given assignment.
    Creates one if it doesn't exist.
    
    Args:
        assignment_id: The ID of the assignment
        
    Returns:
        The AssignmentCounts object
    """
    from models.counters.assignment_counts import AssignmentCounts
    
    counts = AssignmentCounts.query.filter_by(assignment_id=assignment_id).first()
    if counts is None:
        counts = AssignmentCounts(assignment_id=assignment_id)
        db.session.add(counts)
        db.session.commit()
    return counts


def ensure_course_counts(course_id: int) -> "models.CourseCounts":
    """
    Ensure a CourseCounts record exists for the given course.
    Creates one if it doesn't exist.
    
    Args:
        course_id: The ID of the course
        
    Returns:
        The CourseCounts object
    """
    from models.counters.course_counts import CourseCounts
    
    counts = CourseCounts.query.filter_by(course_id=course_id).first()
    if counts is None:
        counts = CourseCounts(course_id=course_id)
        db.session.add(counts)
        db.session.commit()
    return counts


def ensure_user_counts(user_id: int) -> "models.UserCounts":
    """
    Ensure a UserCounts record exists for the given user.
    Creates one if it doesn't exist.
    
    Args:
        user_id: The ID of the user
        
    Returns:
        The UserCounts object
    """
    from models.counters.user_counts import UserCounts
    
    counts = UserCounts.query.filter_by(user_id=user_id).first()
    if counts is None:
        counts = UserCounts(user_id=user_id)
        db.session.add(counts)
        db.session.commit()
    return counts


def update_edit_time(submission_id: int, time_delta: float):
    """
    Update the average edit time for a submission using Welford's online algorithm.
    
    This computes the running average without storing all historical values.
    
    Args:
        submission_id: The ID of the submission
        time_delta: The time in seconds since the last edit
    """
    counts = ensure_submission_counts(submission_id)
    
    # Increment the run count (we use runs as proxy for edits)
    counts.runs += 1
    
    # Update average edit time using Welford's algorithm
    # new_avg = old_avg + (new_value - old_avg) / count
    if counts.average_edit_time is None:
        counts.average_edit_time = time_delta
    else:
        counts.average_edit_time = counts.average_edit_time + (time_delta - counts.average_edit_time) / counts.runs
    
    db.session.commit()


def update_run_count(submission_id: int):
    """
    Increment the run count for a submission.
    
    Args:
        submission_id: The ID of the submission
    """
    counts = ensure_submission_counts(submission_id)
    counts.runs += 1
    db.session.commit()


def update_error_counts(submission_id: int, error_type: str):
    """
    Update error counts for a submission based on feedback type.
    
    Args:
        submission_id: The ID of the submission
        error_type: The type of error (syntax, runtime, or instructor_test)
    """
    counts = ensure_submission_counts(submission_id)
    
    if error_type == 'syntax':
        counts.syntax_errors += 1
    elif error_type == 'runtime':
        counts.runtime_errors += 1
    elif error_type == 'instructor_test':
        counts.failed_instructor_tests += 1
    
    db.session.commit()


def increment_submission_count(assignment_id: int, course_id: int, user_id: int):
    """
    Increment submission counts across assignment, course, and user.
    
    Args:
        assignment_id: The ID of the assignment
        course_id: The ID of the course
        user_id: The ID of the user
    """
    # Update assignment counts
    assignment_counts = ensure_assignment_counts(assignment_id)
    assignment_counts.total_submissions += 1
    assignment_counts.date_last_submission = utcnow()
    
    # Update course counts
    course_counts = ensure_course_counts(course_id)
    course_counts.total_submissions += 1
    course_counts.date_last_submission = utcnow()
    
    # Update user counts
    user_counts = ensure_user_counts(user_id)
    user_counts.total_submissions += 1
    
    db.session.commit()


def update_user_activity(user_id: int, activity_type: str):
    """
    Update user activity timestamps.
    
    Args:
        user_id: The ID of the user
        activity_type: The type of activity ('login' or 'edit')
    """
    user_counts = ensure_user_counts(user_id)
    
    if activity_type == 'login':
        user_counts.last_logged_in = utcnow()
    elif activity_type == 'edit':
        user_counts.last_edited = utcnow()
    
    db.session.commit()


def increment_course_assignment_count(course_id: int):
    """
    Increment the assignment count for a course.
    
    Args:
        course_id: The ID of the course
    """
    course_counts = ensure_course_counts(course_id)
    course_counts.total_assignments += 1
    course_counts.date_last_assignment = utcnow()
    db.session.commit()


def increment_course_user_count(course_id: int, role: str):
    """
    Increment user counts for a course based on role.
    
    Args:
        course_id: The ID of the course
        role: The role of the user (student, learner, or instructor)
    """
    course_counts = ensure_course_counts(course_id)
    course_counts.total_users += 1
    course_counts.date_last_user = utcnow()
    
    # Map role names to count fields
    role_lower = role.lower()
    if role_lower in ('student', 'learner'):
        course_counts.total_students += 1
    elif role_lower == 'instructor':
        course_counts.total_instructors += 1
    
    db.session.commit()


def recalculate_submission_counts_from_logs(submission_id: int):
    """
    Recalculate submission counts from historical log data.
    This is useful for backfilling counts or fixing discrepancies.
    
    Note: This function uses ILIKE queries which may not be fully indexed.
    This is acceptable since this function is intended for one-time backfilling
    or occasional recalculation, not for frequent real-time use.
    
    Args:
        submission_id: The ID of the submission
    """
    from models.log_tables import SubmissionLog
    
    counts = ensure_submission_counts(submission_id)
    
    # Count runs
    run_count = SubmissionLog.query.filter(
        SubmissionLog.submission_id == submission_id,
        SubmissionLog.event_type.in_(['X-run', 'Run'])
    ).count()
    counts.runs = run_count
    
    # Count errors (using ILIKE for pattern matching - acceptable for backfilling)
    syntax_errors = SubmissionLog.query.filter(
        SubmissionLog.submission_id == submission_id,
        SubmissionLog.event_type == 'feedback'
    ).filter(
        or_(
            SubmissionLog.category.ilike('%syntax%'),
            SubmissionLog.label.ilike('%syntax%')
        )
    ).count()
    counts.syntax_errors = syntax_errors
    
    runtime_errors = SubmissionLog.query.filter(
        SubmissionLog.submission_id == submission_id,
        SubmissionLog.event_type == 'feedback'
    ).filter(
        or_(
            SubmissionLog.category.ilike('%runtime%'),
            SubmissionLog.label.ilike('%runtime%')
        )
    ).count()
    counts.runtime_errors = runtime_errors
    
    instructor_test_failures = SubmissionLog.query.filter(
        SubmissionLog.submission_id == submission_id,
        SubmissionLog.event_type == 'feedback'
    ).filter(
        or_(
            SubmissionLog.category.ilike('%instructor%'),
            SubmissionLog.category.ilike('%test%')
        )
    ).count()
    counts.failed_instructor_tests = instructor_test_failures
    
    db.session.commit()
    return counts
