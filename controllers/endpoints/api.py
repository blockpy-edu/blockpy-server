import json
import os
import time
import random

import flask_security
from flask import Blueprint, request, Response, jsonify, abort, g, url_for, send_from_directory, render_template

from flask import current_app
from controllers.auth import get_user
from controllers.helpers import (get_course_id, check_resource_exists, require_request_parameters, maybe_int,
                                 login_required, ajax_success, ajax_failure, make_log_entry,
                                 require_course_grader)
from models.assignment import Assignment
from models.assignment_group import AssignmentGroup
from models.counters import SubmissionCounts
from models.course import Course
from models.enums import SubmissionLogEvent
from models.report import Report
from models.submission import Submission
from models.data_formats.portation import export_bundle, import_bundle
from models.user import User
from huey.exceptions import TaskException
from tasks import tasks

blueprint_api = Blueprint('api', __name__, url_prefix='/api')


@blueprint_api.route('/test/', methods=['GET'])
@blueprint_api.route('/test', methods=['GET'])
def test():
    return jsonify("success")


@blueprint_api.route('/long_task/<course_id>/<user_id>/', methods=['GET'])
@blueprint_api.route('/long_task/<course_id>/<user_id>', methods=['GET'])
def long_task(course_id, user_id):
    user, _ = get_user()
    course_id, user_id = maybe_int(course_id), maybe_int(user_id)
    require_course_grader(user, course_id)
    task = tasks.get_events(course_id, user_id)
    location = url_for('api.task_status', task_id=task.id)
    return f"<html><head></head><body><a href='{location}'>{location}</a></body></html>", 202, {'Location': location}


@blueprint_api.route('/task_status/<task_id>')
def task_status(task_id):
    try:
        task = current_app.huey.result(task_id)
    except TaskException as e:
        return jsonify({"status": "Error", "message": str(e)})

    if task is None:
        return jsonify({"status": "Pending", "message": str(task)})
    return jsonify({"status": "Complete", "message": task})


@blueprint_api.route('/reports/', methods=['GET'])
@blueprint_api.route('/reports', methods=['GET'])
def reports():
    user, user_id = get_user()
    reports = [report.encode_json() for report in Report.by_user(user_id)]
    return jsonify({"reports": reports})


@blueprint_api.route('/report/<report_id>/', methods=['GET'])
@blueprint_api.route('/report/<report_id>', methods=['GET'])
def report(report_id):
    user, user_id = get_user()
    report: Report = Report.by_id(report_id)
    check_resource_exists(report, "Report", report_id)
    if report.owner_id != user_id:
        return abort(401, "User does not own report.")
    return send_from_directory(report.get_report_folder(), report.result)


@blueprint_api.route('/report/<report_id>/<path:path>', methods=['GET', 'POST'])
def report_static(report_id, path):
    user, user_id = get_user()
    report: Report = Report.by_id(report_id)
    check_resource_exists(report, "Report", report_id)
    if report.owner_id != user_id:
        return abort(401, "User does not own report.")
    return send_from_directory(report.get_report_folder(), path)


@blueprint_api.route('/check_similarity/<assignment_id>/<course_id>/', methods=['GET'])
@blueprint_api.route('/check_similarity/<assignment_id>/<course_id>', methods=['GET'])
def check_similarity(assignment_id, course_id):
    user, user_id = get_user()
    assignment_id = maybe_int(assignment_id)
    course_id = maybe_int(course_id)
    require_course_grader(user, course_id)
    check_resource_exists(Assignment.by_id(assignment_id), "Assignment", assignment_id)
    task = tasks.check_similarity(user_id, assignment_id, [], course_id, "structure text exact", True, 50)
    location = url_for('api.task_status', task_id=task.id)
    return f"<html><head></head><body><a href='{location}'>{location}</a></body></html>", 202, {'Location': location}


@blueprint_api.route('/check_similarity_simple/<assignment_id>/<course_id>/', methods=['GET'])
@blueprint_api.route('/check_similarity_simple/<assignment_id>/<course_id>', methods=['GET'])
def check_similarity_simple(assignment_id, course_id):
    other_student_threshold = maybe_int(request.args.get('other_student_threshold', 95))
    starter_change_threshold = maybe_int(request.args.get('starter_change_threshold', 95))
    minimum_file_length = maybe_int(request.args.get('minimum_file_length', 100))
    exclude_courses = [maybe_int(c) for c in request.args.get('exclude_courses', '').split(',')
                       if maybe_int(c) is not None]
    user, user_id = get_user()
    assignment_id = maybe_int(assignment_id)
    course_id = maybe_int(course_id)
    require_course_grader(user, course_id)
    check_resource_exists(Assignment.by_id(assignment_id), "Assignment", assignment_id)
    task = tasks.check_similarity_simple(user_id, assignment_id, exclude_courses, course_id,
                                         other_student_threshold=other_student_threshold,
                                         starter_change_threshold=starter_change_threshold,
                                         minimum_file_length=minimum_file_length)
    location = url_for('api.task_status', task_id=task.id)
    #return f"<html><head></head><body><a href='{location}'>{location}</a></body></html>", 202, {'Location': location}
    return jsonify({"task_id": task.id, "status_url": location})


def load_api_user():
    email = request.json.get('email')
    password = request.json.get('password')
    if email is None or password is None:
        if g.user is None:
            abort(400, "Missing email or password arguments")  # missing arguments
        return g.user
    user = User.find_student(email)
    if not user:
        abort(400, "No user with email '{}' found.".format(email))  # Could not find user
    if not flask_security.utils.verify_password(password, user.password):
        abort(400, "Password verification failed.")
    return user


@blueprint_api.route('/list/courses/', methods=['GET', 'POST'])
@blueprint_api.route('/list/courses', methods=['GET', 'POST'])
def list_courses():
    user = load_api_user()
    courses = user.get_editable_courses()
    return jsonify(courses=[course.encode_json() for course in courses])


@blueprint_api.route('/export/', methods=['GET', 'POST'])
@blueprint_api.route('/export', methods=['GET', 'POST'])
def export():
    user = load_api_user()
    assignment_url = request.json.get("assignment_url")
    assignment_id = request.json.get("assignment_id")
    if assignment_id or assignment_url:
        if assignment_url:
            assignment = Assignment.by_url(assignment_url)
        else:
            assignment = Assignment.by_id(assignment_id)
        check_resource_exists(assignment, "Assignment", assignment_id or assignment_url)
        if not user.is_instructor(assignment.course_id):
            return abort(400, "Not an instructor in this assignments' course.")
        return json.dumps(export_bundle(assignments=[assignment]))
    group_id = request.json.get("assignment_group_id")
    group_url = request.json.get("assignment_group_url")
    if group_id or group_url:
        if group_url:
            assignment_group = AssignmentGroup.by_url(group_url)
        else:
            assignment_group = AssignmentGroup.by_id(group_id)
        check_resource_exists(assignment_group, "AssignmentGroup", group_id or group_url)
        assignments = assignment_group.get_assignments()
        memberships = assignment_group.get_memberships()
        if not user.is_instructor(assignment_group.course_id):
            return abort(400, "Not an instructor in this assignment group's course.")
        for assignment in assignments:
            if not user.is_instructor(assignment.course_id):
                return abort(400, "Not an instructor in this assignments' course.")
        bundle = export_bundle(groups=[assignment_group], assignments=assignments,
                               memberships=memberships)
        return json.dumps(bundle)
    course_id = request.json.get("course_id")
    course_url = request.json.get("course_url")
    if course_id or course_url:
        if course_url:
            course = Course.by_url(course_url)
        else:
            course = Course.by_id(course_id)
        check_resource_exists(course, "Course", course_id or course_url)
        if not user.is_instructor(course.id):
            return abort(400, "Not an instructor in this course.")
        groups = course.get_assignment_groups()
        assignment_and_memberships = course.get_assignments()
        assignments = [a for a, m in assignment_and_memberships]
        memberships = [m for a, m in assignment_and_memberships]
        bundle = export_bundle(groups=groups, assignments=assignments,
                               memberships=memberships)
        return json.dumps(bundle)
    abort(400, "No assignment_id, assignment_url, assignment_group_id, assignment_group_url, course_id, or course_url given")


@blueprint_api.route('/import/', methods=['GET', 'POST'])
@blueprint_api.route('/import', methods=['GET', 'POST'])
def import_endpoint():
    user = load_api_user()
    course_id = request.json.get('course_id')
    if course_id is None:
        abort(400, "You need to specify the course_id")
    assignments = request.json.get('assignments', [])
    for assignment in assignments:
        assignment = Assignment.by_url(assignment['url'])
        if ((assignment and not user.is_instructor(assignment.course_id))
                or (not assignment and not user.is_instructor(course_id))):
            return abort(400, "Not an instructor in this assignments' course.")
    groups = request.json.get('groups', [])
    for group in groups:
        group = AssignmentGroup.by_url(group['url'])
        if not user.is_instructor(group.course_id):
            return abort(400, "Not an instructor in this assignment groups' course.")
    # TODO: Verify that memberships are all attached to a group owned by this user
    import_bundle(request.json, owner_id=user.id, course_id=course_id)
    return jsonify(success=True)

# export_progsnap2

@blueprint_api.route('/make_red_flag_report/<course_id>/', methods=['GET', 'POST'])
@blueprint_api.route('/make_red_flag_report/<course_id>', methods=['GET', 'POST'])
def make_red_flag_report(course_id):
    short_threshold = maybe_int(request.args.get('short_threshold', 10))
    characters_per_second_threshold = maybe_int(request.args.get('characters_per_second_threshold', 30))
    max_backstep_threshold = maybe_int(request.args.get('max_backstep_threshold', 5))
    user, user_id = get_user()
    course_id = maybe_int(course_id)
    require_course_grader(user, course_id)

    if request.method == 'POST':
        task = tasks.make_red_flag_report(user_id, course_id, short_threshold=short_threshold,
                                          characters_per_second_threshold=characters_per_second_threshold,
                                          max_backstep_threshold=max_backstep_threshold,
                                          base_url=url_for("blockpy.view_submission", _external=True, embed=False))
        location = url_for('api.task_status', task_id=task.id)
        #return f"<html><head></head><body><a href='{location}'>{location}</a></body></html>", 202, {'Location': location}
        return jsonify({"task_id": task.id, "status_url": location,
                        "back_to_reports": url_for('api.make_red_flag_report', course_id=course_id)})
    else:
        existing_reports = sorted([report for report in Report.by_user(user_id)
                            if report.task == "make_red_flag_report"],
                                  key= lambda report: report.date_created,
                                  reverse=True)
        return render_template("tasks/make_red_flag_report.html", course_id=course_id,
                               short_threshold=short_threshold,
                                 characters_per_second_threshold=characters_per_second_threshold,
                                    max_backstep_threshold=max_backstep_threshold,
                               existing_reports=existing_reports)


def assignment_in_course(assignment, course_id):
    """
    An assignment counts as part of a course if the course owns it, one of the
    course's assignment groups uses it, or the course already has submissions
    for it (the LTI cross-course usage pattern).
    """
    if assignment.course_id == course_id:
        return True
    if any(group.course_id == course_id for group in AssignmentGroup.by_assignment(assignment.id)):
        return True
    return Submission.query.filter_by(assignment_id=assignment.id, course_id=course_id).first() is not None


@blueprint_api.route('/bulk_update_submissions/', methods=['POST'])
@blueprint_api.route('/bulk_update_submissions', methods=['POST'])
@login_required
def bulk_update_submissions():
    """
    Bulk update the code of multiple users' submissions, potentially across
    courses, users, and assignments. The requester must be a grader in each
    affected submission's course.

    Expects a JSON body of the form:
        {"updates": [
            {"submission_id": 123, "code": "..."},
            {"course_id": 1, "user_id": 2, "assignment_id": 3, "code": "..."}
        ]}

    Each update either identifies an existing submission by `submission_id`, or
    by the (`course_id`, `user_id`, `assignment_id`) triple; in the latter case
    the submission is created if it does not exist yet (so instructors can
    author feedback before the student ever opens the assignment).

    Follows the same semantics as `blockpy.save_file` for student files: the
    code replaces the submission's `answer.py` (its `code` column), bumping the
    submission version and logging a File.Edit event.

    Individual failures do not abort the rest of the batch; they are reported
    in the `errors` list of the response.
    """
    user, user_id = get_user()
    if not request.json or not isinstance(request.json.get('updates'), list):
        return ajax_failure("Expected a JSON body with an 'updates' list.")
    updates = request.json['updates']
    maximum_code_size = current_app.config["MAXIMUM_CODE_SIZE"]
    now = str(round(time.time() * 1000))
    updated, errors = [], []
    for index, update in enumerate(updates):
        def fail(message, index=index):
            errors.append({"index": index, "message": message})
        if not isinstance(update, dict) or not isinstance(update.get('code'), str):
            fail("Each update must be an object with a string 'code' field.")
            continue
        code = update['code']
        if maximum_code_size < len(code):
            fail("Maximum size of code exceeded. Current limit is {}, you uploaded {} characters.".format(
                maximum_code_size, len(code)))
            continue
        if update.get('submission_id') is not None:
            submission = Submission.by_id(maybe_int(update['submission_id']))
            if not submission:
                fail("Submission {} does not exist.".format(update['submission_id']))
                continue
            if not user.is_grader(submission.course_id):
                fail("You are not a grader in course {}.".format(submission.course_id))
                continue
        else:
            course_id = maybe_int(update.get('course_id'))
            target_user_id = maybe_int(update.get('user_id'))
            assignment_id = maybe_int(update.get('assignment_id'))
            if course_id is None or target_user_id is None or assignment_id is None:
                fail("Each update must provide either a 'submission_id' or all of "
                     "'course_id', 'user_id', and 'assignment_id'.")
                continue
            if not user.is_grader(course_id):
                fail("You are not a grader in course {}.".format(course_id))
                continue
            assignment = Assignment.by_id(assignment_id)
            if not assignment:
                fail("Assignment {} does not exist.".format(assignment_id))
                continue
            if not assignment_in_course(assignment, course_id):
                fail("Assignment {} is not part of course {}.".format(assignment_id, course_id))
                continue
            target_user = User.by_id(target_user_id)
            if not target_user:
                fail("User {} does not exist.".format(target_user_id))
                continue
            if not target_user.in_course(course_id):
                fail("User {} is not enrolled in course {}.".format(target_user_id, course_id))
                continue
            submission = Submission.load_or_new(assignment, target_user_id, course_id)
        # Perform the update, mirroring blockpy.save_student_file
        submission_last_updated = submission.date_modified
        new_code = submission.save_code('answer.py', code)
        SubmissionCounts.track_event(submission.id, SubmissionLogEvent.BLOCKPY_FILE_EDIT, {
            "code": code,
            "file_path": 'answer.py',
        }, submission_last_updated=submission_last_updated)
        make_log_entry(submission.id, submission.version, submission.assignment_id, submission.assignment_version,
                       submission.course_id, submission.user_id,
                       SubmissionLogEvent.BLOCKPY_FILE_EDIT,
                       'answer.py', message=new_code, timestamp=now, timezone="0")
        updated.append({"index": index, "submission_id": submission.id,
                        "course_id": submission.course_id, "user_id": submission.user_id,
                        "assignment_id": submission.assignment_id,
                        "version": submission.version})
    return ajax_success({"updated": updated, "errors": errors})
