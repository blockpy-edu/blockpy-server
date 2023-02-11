import json
import os
import time
import random

import flask_security
from flask import Blueprint, request, Response, jsonify, abort, g, url_for, send_from_directory

from main import app
from controllers.helpers import get_course_id, get_user, check_resource_exists, require_request_parameters, maybe_int
from models.assignment import Assignment
from models.assignment_group import AssignmentGroup
from models.course import Course
from models.report import Report
from models.portation import export_bundle, import_bundle
from models.user import User
from main import huey
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
    task = tasks.get_events(int(course_id), int(user_id))
    location = url_for('api.task_status', task_id=task.id)
    return f"<html><head></head><body><a href='{location}'>{location}</a></body></html>", 202, {'Location': location}


@blueprint_api.route('/task_status/<task_id>')
def task_status(task_id):
    try:
        task = huey.result(task_id)
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
    # TODO: Check permissions
    return send_from_directory(report.get_report_folder(), report.result)


@blueprint_api.route('/report/<report_id>/<path:path>', methods=['GET', 'POST'])
def report_static(report_id, path):
    user, user_id = get_user()
    report: Report = Report.by_id(report_id)
    # TODO: Check permissions
    if report.owner_id != user_id:
        return abort(401, "User does not own report.")
    return send_from_directory(report.get_report_folder(), path)


@blueprint_api.route('/check_similarity/<assignment_id>/<course_id>/', methods=['GET'])
@blueprint_api.route('/check_similarity/<assignment_id>/<course_id>', methods=['GET'])
def check_similarity(assignment_id, course_id):
    user, user_id = get_user()
    assignment_id = maybe_int(assignment_id)
    course_id = maybe_int(course_id)
    task = tasks.check_similarity(user_id, assignment_id, [], course_id, "structure text exact", True, 50)
    location = url_for('api.task_status', task_id=task.id)
    return f"<html><head></head><body><a href='{location}'>{location}</a></body></html>", 202, {'Location': location}


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
    if group_id:
        assignment_group = AssignmentGroup.by_id(group_id)
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
    if course_id:
        if not user.is_instructor(course_id):
            return abort(400, "Not an instructor in this course.")
        course = Course.by_id(course_id)
        groups = course.get_assignment_groups()
        assignment_and_memberships = course.get_assignments()
        assignments = [a for a, m in assignment_and_memberships]
        memberships = [m for a, m in assignment_and_memberships]
        bundle = export_bundle(groups=groups, assignments=assignments,
                               memberships=memberships)
        return json.dumps(bundle)
    abort(400, "No assignment_id or assignment_group_id given")


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