from datetime import datetime
import time
import os
import re
import json
import base64
from typing import Tuple

from slugify import slugify
from natsort import natsorted

from quart import Blueprint, url_for, session, request, jsonify, g, render_template, redirect, Response, \
    send_from_directory, current_app, make_response
from werkzeug.utils import secure_filename

from common.flask_extensions import safe_request
from common.dates import string_to_datetime, iso_to_datetime, datetime_to_string
from controllers.jinja_filters import to_iso_time
from controllers.pylti.common import LTIPostMessageException
from controllers.pylti.flask import LTI
from controllers.pylti.post_grade import get_groups_submissions, calculate_submissions_score,  grade_submission
from models.assignment_tag import AssignmentTag
from models.course import Course

from models import db
from models.log_tables import SubmissionLog as Log, AssignmentLog
from models.enums import SubmissionStatuses, AssignmentLogEvent, SubmissionLogEvent
from models.submission import Submission, GradingStatuses
from models.assignment import Assignment
from models.assignment_group import AssignmentGroup

from common.urls import normalize_url
from common.filesystem import ensure_dirs
from controllers.auth import get_user, get_consumer_secrets
from controllers.helpers import (ajax_failure, parse_assignment_load, require_request_parameters,
                                 get_course_id, maybe_int, check_resource_exists, ajax_success,
                                 login_required, require_course_instructor, require_course_grader, maybe_bool,
                                 make_log_entry, check_permissions)
from common.highlighters import highlight_python_code
from tasks.tasks import queue_lti_post_grade
from models.user import User

blueprint_blockpy = Blueprint('blockpy', __name__, url_prefix='/blockpy')


@blueprint_blockpy.route('/static/<path:path>', methods=['GET', 'POST'])
def blockpy_static(path):
    return current_app.send_static_file(path)


def new_load_submission():
    submission_id = request.get_maybe_int('submission_id')
    g.safely.load_submission(submission_id)


@blueprint_blockpy.route('/load_submission/', methods=['GET', 'POST'])
@blueprint_blockpy.route('/load_submission', methods=['GET', 'POST'])
@require_request_parameters('submission_id')
def load_submission():
    # Load parameters
    submission_id = safe_request.get_int('submission_id')
    embed = safe_request.get_maybe_bool('embed')
    course_id = safe_request.get_course_id(True)
    read_only = safe_request.get_maybe_bool('read_only', True)
    # Load models
    user, user_id = g.safely.get_user()
    scope, submission = g.safely.load_submission_by_id(submission_id)
    # If it is this user's submission, redirect to load the assignment
    if submission.user_id == user_id:
        return redirect(url_for('blockpy.load', assignment_id=submission.assignment.id,
                                course_id=course_id if course_id else submission.course_id))
    # Get the assignment
    is_quiz = submission.assignment.type == 'quiz' and scope == 'grader'
    assignment_data = submission.assignment.for_editor(submission.user_id, submission.course_id, is_quiz)
    return load_editor({
        "user": user,
        "user_id": user_id,
        "embed": embed,
        "read_only": read_only,
        "current_submission_id": submission_id,
        "course_id": course_id,
        "role": scope.name,
        "assignment_group_id": None,
        "assignment_data": assignment_data
    })


@blueprint_blockpy.route('/load_readonly/', methods=['GET', 'POST'])
@blueprint_blockpy.route('/load_readonly', methods=['GET', 'POST'])
def load_readonly():
    embed = safe_request.get_maybe_bool('embed')
    user, user_id = g.safely.get_user()
    assignment_data = json.loads(request.values.get("assignment_data", "{}"))
    return load_editor({
        "user": user,
        "user_id": user_id,
        "embed": embed,
        "read_only": True,
        "current_submission_id": None,
        "course_id": None,
        "role": assignment_data.get('user', {}).get('role', 'owner'),
        "assignment_group_id": None,
        "assignment_data": assignment_data
    })


def parse_form_data(fields):
    result = {}
    current = result
    for key, value in fields:
        keys = key.split(".")
        for subkey in keys[:-1]:
            if subkey not in current:
                current[subkey] = {}
            current = current[subkey]
        current[keys[-1]] = value
        current = result
    return result


@blueprint_blockpy.route('/', methods=['GET', 'POST'])
@blueprint_blockpy.route('/index', methods=['GET', 'POST'])
@blueprint_blockpy.route('/index/', methods=['GET', 'POST'])
@blueprint_blockpy.route('/', methods=['GET', 'POST'])
@blueprint_blockpy.route('/load', methods=['GET', 'POST'])
def load():
    editor_information = parse_assignment_load()
    return load_editor(editor_information)


ASSIGNMENT_TYPES = {
    'quiz_questions': ('quiz', ),
    'readings': ('reading', ),
    'textbooks': ('textbook', ),
    'javas': ('java', ),
    'kettles': ('kettle', 'typescript'),
    'explains': ('explanation', 'explain')
}

def load_editor(editor_information):
    """
    Render the actual editor based on the editor information.
    :param editor_information:
    :return:
    """
    by_type = {name: [] for name in ASSIGNMENT_TYPES}
    for assignment in editor_information.get('assignments', []):
        for name, types in ASSIGNMENT_TYPES.items():
            if assignment.type in types:
                by_type[name].append(assignment.id)
                break
    response = make_response(render_template('blockpy/editor.html', ip=request.remote_addr,
                           **by_type,
                           **editor_information))
    return response


@blueprint_blockpy.route('/serve_kettle_iframe/', methods=['GET', 'POST'])
@blueprint_blockpy.route('/serve_kettle_iframe', methods=['GET', 'POST'])
def serve_kettle_iframe():
    if hasattr(current_app, 'debug_toolbar') and current_app.debug_toolbar is not None:
        real_request = request._get_current_object()  # type: ignore[attr-defined]
        current_app.debug_toolbar.debug_toolbars_var.get({}).pop(real_request, None)
    response = make_response(render_template('blockpy/kettle_iframe.html'))
    response.headers.set('Content-Security-Policy', "sandbox allow-scripts")
    response.headers.set('Access-Control-Allow-Origin', "*")
    #return abort(500)
    return response

@blueprint_blockpy.route('/load_assignment/', methods=['GET', 'POST'])
@blueprint_blockpy.route('/load_assignment', methods=['GET', 'POST'])
@require_request_parameters('assignment_id')
def load_assignment():
    # Get arguments
    assignment_id = safe_request.get_maybe_int('assignment_id')
    student_id = safe_request.get_maybe_int('student_id')
    force_download = safe_request.get_maybe_bool('force_download', False)
    force_quiz = safe_request.get_maybe_bool('force_quiz', False)
    with_history = safe_request.get_maybe_bool('with_history', False)
    course_id = safe_request.get_course_id(True)
    user, user_id = g.safely.get_user()
    if student_id is None:
        student_id = user_id
    # Load models
    scope, assignment = g.safely.load_assignment_by_id(assignment_id, course_id)
    # Start processing
    is_quiz = force_quiz or (assignment.type == 'quiz' and scope.can_view and not scope.can_edit)

    if course_id is None:
        editor_information = assignment.for_read_only_editor(student_id, is_quiz)
    else:
        editor_information = assignment.for_editor(student_id, course_id, is_quiz, with_history)
        browser_info = json.dumps(safe_request.get_browser_info())
        submission = editor_information.get('submission', None)
        if submission is None:
            # TODO SUM25: Log an error here
            submission_id = None
            submission_version = None
        else:
            submission_id = submission['id'] if submission else None
            submission_version = submission['version'] if submission else None
        # Log the event
        if user is not None:
            if user_id != student_id:
                # TODO SUM25: This should get the submission id and stuff
                make_log_entry(submission_id, submission_version, assignment_id, assignment.version, course_id,
                               user_id, 'X-Submission.Get', message=str(student_id))
            else:
                make_log_entry(submission_id, submission_version, assignment_id, assignment.version, course_id,
                               user_id, 'Session.Start', message=browser_info)
    if force_download:
        student_filename = User.by_id(student_id).get_filename("")
        filename = assignment.get_filename("") + "_" + student_filename + '_submission.json'
        return Response(json.dumps(editor_information, indent=2), mimetype='application/json',
                        headers={'Content-Disposition': 'attachment;filename={}'.format(filename)})
    else:
        return ajax_success(editor_information)


@blueprint_blockpy.route('/save_file/', methods=['GET', 'POST'])
@blueprint_blockpy.route('/save_file', methods=['GET', 'POST'])
@require_request_parameters('filename')
@login_required
def save_file():
    filename = safe_request.get_str("filename")
    course_id = safe_request.get_course_id(False)
    user, user_id = g.safely.get_user()
    if filename in Submission.STUDENT_FILENAMES:
        return save_student_file(filename, course_id, user)
    if filename in Assignment.INSTRUCTOR_FILENAMES:
        return save_instructor_file(course_id, user, filename)
    return ajax_failure("Unknown filename: " + str(filename))


@require_request_parameters("submission_id", "code")
def save_student_file(filename, course_id, user):
    submission_id = safe_request.get_int("submission_id")
    code = safe_request.get_str("code")
    part_id = safe_request.get_maybe_str("part_id")
    if submission_id == '':
        return ajax_failure(
            "No submission ID was provided."
        )
    scope, submission = g.safely.load_submission_by_id(submission_id)
    if not scope.can_edit:
        return ajax_failure("Only the submission owner and graders can save files for a submission.")
    # Validate the maximum file size
    if current_app.config["MAXIMUM_CODE_SIZE"] < len(code):
        return ajax_failure(
            "Maximum size of code exceeded. Current limit is {}, you uploaded {} characters.".format(
                current_app.config["MAXIMUM_CODE_SIZE"], len(code)
            ))
    # Perform update
    # TODO: What if submission's assignment version conflicts with current assignments' version?
    version_change = submission.assignment.version != submission.assignment_version
    new_code = submission.save_code(filename, code, part_id)
    # TODO: What is a grader is uploading code for a student?
    make_log_entry(submission.id, submission.version, submission.assignment_id, submission.assignment_version,
                   course_id, submission.user_id,
                   "File.Edit", filename + ("#" + part_id if part_id else ""), message=new_code)
    return ajax_success({"version_change": version_change})


@require_request_parameters("assignment_id", "code")
def save_instructor_file(course_id, user, filename):
    assignment_id = safe_request.get_int("assignment_id")
    code = safe_request.get_str("code")
    # Load the assignment
    scope, assignment = g.safely.load_assignment_by_id(assignment_id)
    if not scope.can_edit:
        return ajax_failure("Only the assignment owner and instructors can save instructor files for an assignment.")
    # Perform update
    assignment.save_file(filename, code)
    AssignmentLog.new(assignment.id, assignment.version, course_id,
                      user.id, AssignmentLogEvent.EDIT, filename, code,
                      "", "")
    return ajax_success({})


@blueprint_blockpy.route('/load_history/', methods=['GET', 'POST'])
@blueprint_blockpy.route('/load_history', methods=['GET', 'POST'])
@require_request_parameters("course_id")
def load_history():
    user, user_id = g.safely.get_user()
    course_id = safe_request.get_course_id(False)
    # Could be one or more assignment_ids, separated by commas
    assignment_ids = safe_request.get_maybe_int_list('assignment_id')
    # Could be one or more user_ids, separated by commas
    student_ids = safe_request.get_maybe_int_list('user_id')
    # Pagination information
    page_limit = safe_request.get_maybe_int('page_limit')
    page_offset = safe_request.get_maybe_int('page_offset')
    with_submission = safe_request.get_maybe_bool('with_submission', False)
    # Load models
    for assignment_id in assignment_ids:
        scope, assignment = g.safely.load_assignment_by_id(assignment_id, course_id)
    history = Log.get_history(course_id, assignment_ids, student_ids,
                              page_offset=page_offset,
                              page_limit=page_limit)
    history = list(reversed(history))
    submissions = []
    if with_submission:
        submissions = Submission.get_submissions(course_id, assignment_ids, student_ids)
    return ajax_success({"history": history, "submissions": submissions})


@blueprint_blockpy.route('/log_event/', methods=['GET', 'POST'])
@blueprint_blockpy.route('/log_event', methods=['GET', 'POST'])
@require_request_parameters('event_type')
@login_required
def log_event():
    course_id = safe_request.get_course_id(True)
    user, user_id = g.safely.get_user()
    assignment_id = safe_request.get_int('assignment_id')
    assignment_version = safe_request.get_maybe_int('assignment_version', 0)
    submission_id = safe_request.get_int('submission_id')
    submission_version = safe_request.get_maybe_int('version', 0)
    event_type = safe_request.get_str("event_type")
    file_path = safe_request.get_maybe_str("file_path", "")
    category = safe_request.get_maybe_str('category', "")
    label = safe_request.get_maybe_str('label', "")
    message = safe_request.get_maybe_str('message', "")
    # Load the models
    scope, submission = g.safely.load_submission_by_id(submission_id)
    if not scope.can_edit:
        return ajax_failure("Only the submission owner and graders can log events for a submission.")
    # Make the entry
    new_log = make_log_entry(submission_id, submission_version, assignment_id, assignment_version, course_id, user_id,
                             event_type, file_path, category, label, message)
    return ajax_success({"log_id": new_log.id})



@blueprint_blockpy.route("/share/<target>/", methods=['GET', 'POST'])
@blueprint_blockpy.route("/share/<target>", methods=['GET', 'POST'])
@blueprint_blockpy.route("/share/", methods=['GET', 'POST'], defaults={'target': ""})
def share_url(target=None):
    """
    Scheme for the <target> is `[verb]_[course_id]_[assignment_group_id]_[user_id]`
    but the whole thing is base64 encoded.
    :param target:
    :return:
    """
    viewer, viewer_id = get_user()
    # Decode the target from base64
    if target is None:
        return ajax_failure("No target provided.")
    try:
        decoded = base64.b64decode(target).decode('utf-8')
    except Exception as e:
        return ajax_failure(f"Could not decode the share target: {e}")
    parts = decoded.split("_")
    if len(parts) < 5:
        return ajax_failure(f"Target has invalid number of parts ({len(parts)}).")
    verb, course_id, assignment_group_id, assignment_id, user_id, *extra_information  = parts
    course_id = maybe_int(course_id)
    assignment_group_id = maybe_int(assignment_group_id)
    assignment_id = maybe_int(assignment_id)
    user_id = maybe_int(user_id)
    if assignment_group_id is None and None not in (course_id, assignment_id, user_id):
        verb = "submission"
    elif None in (course_id, assignment_group_id, assignment_id, user_id):
        return ajax_failure(f"Target has invalid value inside ({course_id}, {assignment_group_id}, {assignment_id}, {user_id}).")
    # Check course permissions
    if not viewer.is_grader(course_id):
        if user_id == viewer_id:
            return ajax_failure("This URL is for your submission. You can share this URL with an instructor or TA and they will be able to access it.")
        return ajax_failure("You do not have permission to view this submission's course. Only TAs and instructors who are logged in have access to this submission through this link. If you are an instructor or TA, make sure that you log in first through Canvas, and then you can access this link once a cookie has been saved. If you were the one who copied this URL, then you can simply share it with an instructor or TA.")
    # Hand off to appropriate function
    if verb == "group":
        return view_submissions(course_id, user_id, assignment_group_id,
                                assignment_id_focus=assignment_id)
    elif verb == "submission":
        return ajax_failure("Individual submission is not implemented yet.")
    else:
        return ajax_failure("Invalid verb in target: {verb}")


assignment_referer_regex = r"(https?\:\/\/.*?\.instructure\.com/courses/\d+/assignments/\d+).*?"


def custom_blocked_message():
    referer_header = request.headers.get('referer', '')
    referer = re.match(assignment_referer_regex, referer_header)
    referer = referer.group(0) if referer else ""
    if referer:
        return (referer, "<h3>The submission could not be loaded, probably because you are not logged in."
                f" Log into the <a href='{referer}' target=_blank>assignment</a> via Canvas "
                f"(or open the BlockPy dashboard), and then reload this page."
                " If that still does not work, you may not have grader permissions for this course.</h3>")
    return (referer, "<h3>↑ The submission could not be loaded. If you "
            "are loading this assignment through the Grades menu in Canvas, then you can click "
            "the link directly above to open your latest submission. If you want to edit your submission "
            "assignment, then use the link at the top of the page to open the assignment.</h3>"
            "<br><br><br><h3>If you are not in Canvas, then you may not have Grader permissions "
            "for this course, or this might not be your submission.</h3>")

@blueprint_blockpy.route('/view_submissions/<int:course_id>/<int:user_id>/<int:assignment_group_id>/',
                         methods=['GET', 'POST'])
@blueprint_blockpy.route('/view_submissions/<int:course_id>/<int:user_id>/<int:assignment_group_id>',
                         methods=['GET', 'POST'])
def view_submissions(course_id, user_id, assignment_group_id, assignment_id_focus=None):
    embed = safe_request.get_maybe_bool('embed')
    viewer, viewer_id = get_user()
    referer, blocked_message = custom_blocked_message()
    #scope, group, assignments, submissions = g.safely.load_group_submissions(
    #    assignment_group_id, user_id, course_id
    #)
    group, assignments, submissions = get_groups_submissions(assignment_group_id, user_id, course_id)
    # Check permissions
    for submission in submissions:
        if not submission:
            return ajax_failure(f"No submission for the given course, user, and group.")
        elif submission.user_id != viewer_id:
            if not viewer.is_grader(submission.course_id):
                return blocked_message
    # Do action
    points_total, points_possible, all_explanations = calculate_submissions_score(assignments, submissions, None)
    any_late_penalties = any(len(explanation) > 1 or
                                (len(explanation) == 1 and
                                 explanation[0] == "Late policy forbids submission")
                             for explanation in all_explanations.values())
    if points_possible:
        score = round(points_total / points_possible, 2)
    else:
        score = 0
    # TODO: Handle tags
    any_hidden = any(assignment.hidden for assignment in assignments)
    is_grader = viewer.is_instructor(course_id) if any_hidden else viewer.is_grader(course_id)
    # Turn off is_grader for TAs if there are any hidden assignments
    tags = []
    if is_grader:
        tags = [tag.encode_json() for tag in AssignmentTag.get_all()]
    # for a, s in zip(assignments, submissions):
    #    make_log_entry(a.id, a.version,
    #                   course_id, user_id, "X-View.Submission", "answer.py",
    #                   category="group",
    #                   message=json.dumps({"viewer": viewer_id}))
    any_hidden = any(assignment.hidden or assignment.get_setting('hide_submission', False)
                     for assignment in assignments)
    has_reviews = any(submission.get_reviews_db() for submission in submissions)
    return render_template("reports/group.html", embed=embed,
                           referer=referer, any_hidden=any_hidden,
                           points_total=points_total, points_possible=points_possible,
                           score=score, tags=tags, is_grader=is_grader,
                           assignment_group=group, viewer=viewer,
                           group=list(zip(assignments, submissions)),
                           all_explanations=all_explanations, any_late_penalties=any_late_penalties,
                           user_id=user_id, course_id=course_id,
                           assignment_id_focus=assignment_id_focus,
                           has_reviews=has_reviews)


@blueprint_blockpy.route('/view_submission/', methods=['GET', 'POST'])
@blueprint_blockpy.route('/view_submission', methods=['GET', 'POST'])
@require_request_parameters('submission_id')
def view_submission():
    submission_id = request.values.get('submission_id')
    viewer, viewer_id = get_user()
    embed = maybe_bool(request.values.get('embed'))
    submission = Submission.by_id(submission_id)
    # Check exists
    check_resource_exists(submission, "Submission", submission_id)
    # Check permissions
    if submission.user_id != viewer_id:
        require_course_grader(viewer, submission.course_id)
    is_grader = viewer.is_instructor(submission.course_id) if submission.assignment.hidden else viewer.is_grader(submission.course_id)
    tags = []
    if is_grader:
        tags = [tag.encode_json() for tag in AssignmentTag.get_all()]
    # Do action
    make_log_entry(submission.id, submission.version, submission.assignment.id, submission.assignment_version,
                   submission.course_id, submission.user_id, "X-View.Submission", "answer.py",
                   category="single",
                   message=json.dumps({"viewer": viewer_id}))
    has_reviews = bool(submission.get_reviews_db())
    return render_template("reports/alone.html", embed=embed,
                           submission=submission, assignment=submission.assignment,
                           is_grader=is_grader, tags=tags, has_reviews=has_reviews,
                           user_id=submission.user_id, course_id=submission.course_id,
                           viewer=viewer)


@blueprint_blockpy.route('/update_submission/', methods=['GET', 'POST'])
@blueprint_blockpy.route('/update_submission', methods=['GET', 'POST'])
@require_request_parameters('submission_id')
def update_submission():
    """
    This endpoint is for automated graders and will push to Canvas, as if
    by a machine. For things pushed by a human, consider update_submission_status.
    It will only use the current time.
    :return:
    """
    # Get parameters
    submission_id = maybe_int(request.values.get("submission_id"))
    assignment_group_id = maybe_int(request.values.get('assignment_group_id'))
    score = float(request.values.get('score', '0'))
    correct = maybe_bool(request.values.get("correct"))
    # TODO: Only send image if the assignment settings starts as Block or Split
    image = request.values.get('image', "")
    hidden_override = maybe_bool(request.values.get('hidden_override'))
    force_update = maybe_bool(request.values.get('force_update'))
    course_id = get_course_id()
    user, user_id = get_user()

    # New version!
    report = grade_submission(submission_id, assignment_group_id,
                              user, request.remote_addr,
                              score, correct, None, image,
                              force_update, by_human=False)
    if report.no_errors:
        return ajax_success(report.for_ajax())
    else:
        return ajax_failure(report.for_ajax())


@blueprint_blockpy.route('/update_submission_status/', methods=['GET', 'POST'])
@blueprint_blockpy.route('/update_submission_status', methods=['GET', 'POST'])
@require_request_parameters('submission_id', 'status')
def update_submission_status():
    """
    This route is called when a student clicks "Mark Submission Submitted" to submit early.

    Just like update_submission, this route will also push to Canvas. In fact,
    it's really the same thing now, just doesn't bring any score along.

    :return:
    """
    # Get parameters
    submission_id = maybe_int(request.values.get("submission_id"))
    assignment_group_id = maybe_int(request.values.get('assignment_group_id'))
    status = request.values.get('status')
    user, user_id = get_user()

    report = grade_submission(submission_id, assignment_group_id,
                              user, request.remote_addr,
                              None, None, status, None,
                              True, by_human=False)
    if report.no_errors:
        return ajax_success(report.for_ajax())
    else:
        return ajax_failure(report.for_ajax())

@blueprint_blockpy.route('/start_assignment/', methods=['GET', 'POST'])
@blueprint_blockpy.route('/start_assignment', methods=['GET', 'POST'])
def start_assignment():
    """
    This starts an assignment group's timer, by setting the date_started
    field for all of its submissions to the current time.
    """
    # Get parameters
    user, user_id = get_user()
    course_id = get_course_id()
    assignment_id = maybe_int(request.values.get('assignment_id'))
    assignment_group_id = maybe_int(request.values.get('assignment_group_id'))
    date_started = request.values.get('date_started', None)
    if date_started is None:
        return ajax_failure("No date started provided.")
    date_started = iso_to_datetime(date_started)
    # TODO: Only send image if the assignment settings starts as Block or Split
    if assignment_group_id is None:
        assignment = Assignment.by_id(assignment_id)
        check_resource_exists(assignment, "Assignment", assignment_id)
        assignments = [assignment]
    else:
        assignment_group = AssignmentGroup.by_id(assignment_group_id)
        check_resource_exists(assignment_group, "AssignmentGroup", assignment_group_id)
        assignments = assignment_group.get_assignments()
    # Verify permissions
    dates = []
    for assignment in assignments:
        submission = assignment.load(user_id, course_id)
        if submission is None:
            return ajax_failure(f"No submission for assignment {assignment.id} in group {assignment_group_id}.")
        submission.edit({'date_started': date_started})
        dates.append(datetime_to_string(submission.date_started))
        make_log_entry(submission.id, submission.version,
                       assignment.id, assignment.version,
                       course_id, user_id,
                       SubmissionLogEvent.START_TIMER,
                       message=date_started)

    return ajax_success({"dates": dates})


@blueprint_blockpy.route('/upload_file/', methods=['GET', 'POST'])
@blueprint_blockpy.route('/upload_file', methods=['GET', 'POST'])
@require_request_parameters('placement', 'directory')
def upload_file():
    # Get parameters
    placement = request.values.get('placement')
    directory = request.values.get('directory')
    filepond_mode = False
    if 'filename' not in request.values and 'filepond' in request.files:
        contents = request.files.get('filepond')
        filename = secure_filename(contents.filename)
        filepond_mode = True
    else:
        filename = secure_filename(request.values.get('filename'))
        contents = request.files.get('contents')
    delete = maybe_bool(request.values.get('delete', 'False'))
    user, user_id = get_user()
    if None in (placement, directory, filename):
        return ajax_failure("No placement, directory, filename given!")
    if placement not in ("global", "course", "assignment", "submission", "user"):
        return ajax_failure(f"Invalid placement: {placement!r}")
    files_folder = os.path.join(current_app.config['UPLOADS_DIR'], 'files', placement)
    # Check file size
    if not delete:
        contents.seek(0, os.SEEK_END)
        file_length = contents.tell()
        contents.seek(0, 0)
        if current_app.config["MAXIMUM_CODE_SIZE"] < file_length:
            return ajax_failure(
                "Maximum size of file exceeded. Current limit is {}, you uploaded {} characters.".format(
                    current_app.config["MAXIMUM_CODE_SIZE"], file_length
                ))
    # Permission check
    permissions = check_file_permissions(user, user_id, placement, directory)
    if permissions is not None:
        return permissions
    # Okay, we got this far, create it!
    files_folder = os.path.join(files_folder, secure_filename(directory))
    ensure_dirs(files_folder)
    file_path = os.path.join(files_folder, secure_filename(filename))
    if delete:
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
                return jsonify(success=True, ip=request.remote_addr)
            except Exception as e:
                current_app.logger.info(f"Could not delete file {file_path} because: {e}")
                return ajax_failure(f"Could not delete the file!")
    else:
        try:
            contents.save(file_path)
            endpoint = url_for("blockpy.download_file", _external=True,_scheme="https",
                               placement=placement, directory=directory, filename=filename)
            if filepond_mode:
                return endpoint
            return ajax_success({"success": True, "endpoint": endpoint})
        except IOError as e:
            return ajax_failure(str(e))


@blueprint_blockpy.route('/rename_file/', methods=['GET', 'POST'])
@blueprint_blockpy.route('/rename_file', methods=['GET', 'POST'])
@require_request_parameters('placement', 'directory')
def rename_file():
    # Get parameters
    placement = request.values.get('placement')
    directory = request.values.get('directory')
    old_filename = secure_filename(request.values.get('old_filename'))
    new_filename = secure_filename(request.values.get('new_filename'))
    user, user_id = get_user()
    if None in (placement, directory, old_filename, new_filename):
        return ajax_failure("No placement, directory, old_filename, new_filename given!")
    if placement not in ("global", "course", "assignment", "submission", "user"):
        return ajax_failure(f"Invalid placement: {placement!r}")
    files_folder = os.path.join(current_app.config['UPLOADS_DIR'], 'files', placement)
    # Permission check
    permissions = check_file_permissions(user, user_id, placement, directory)
    if permissions is not None:
        return permissions
    # Okay, we got this far, create it!
    files_folder = os.path.join(files_folder, secure_filename(directory))
    ensure_dirs(files_folder)
    new_file_path = os.path.join(files_folder, secure_filename(new_filename))
    old_file_path = os.path.join(files_folder, secure_filename(old_filename))
    if os.path.exists(old_file_path):
        try:
            os.rename(old_file_path, new_file_path)
        except Exception as e:
            current_app.logger.info(f"Could not rename file `{old_file_path}` to `{new_file_path}` because: {e}")
            return ajax_failure(f"Could not rename the file!")
        endpoint = url_for("blockpy.download_file", _external=True,_scheme="https",
                           placement=placement, directory=directory, filename=new_filename)
        return jsonify(success=True, ip=request.remote_addr, endpoint=endpoint)
    current_app.logger.info(f"Could not find file to rename (`{old_file_path}`) to `{new_file_path}` because the file did not already exist.")
    return ajax_failure(f"Could not rename the file!")


SUGGEST_DOWNLOAD_EXTENSIONS = [".json", ".sqlite", ".py", ".zip"]


def check_file_permissions(user, user_id, placement, directory):
    # Global file
    if placement == "global" and not user.is_admin():
        return ajax_failure(f"Invalid permissions to upload global file. User is not an admin.")
    # Course file
    if placement == "course":
        course = Course.by_id(directory)
        if not course:
            return ajax_failure(f"Course {directory} does not exist.")
        if not user.is_instructor(course_id=course.id) and not user.is_admin():
            return ajax_failure(f"You do not have sufficient permissions to upload files for this course.")
    # Assignment file
    if placement == "assignment":
        assignment = Assignment.by_id(directory)
        if not assignment:
            return ajax_failure(f"Assignment {directory} does not exist.")
        if not user.is_instructor(course_id=assignment.course_id) and not user.is_admin():
            return ajax_failure(
                f"You do not have sufficient permissions to upload files for this assignment's course ({assignment.course_id}).")
    # Submission file
    if placement == "submission":
        submission = Submission.by_id(directory)
        if not submission:
            return ajax_failure(f"Submission {directory} does not exist.")
        if user_id != submission.user_id and not user.is_instructor(submission.course_id) and not user.is_admin():
            return ajax_failure(
                f"You do not have sufficient permissions to upload files for this submission; you must either own it or be an instructor in its course.")
    # User file
    if placement == "user":
        folder_user = User.by_id(directory)
        if not folder_user:
            return ajax_failure(f"User {directory} does not exist.")
        if user_id != folder_user.id and not user.is_admin():
            return ajax_failure(f"You do not have permissions to upload files for this user.")
    return None


@blueprint_blockpy.route('/download_file/', methods=['GET', 'POST'])
@blueprint_blockpy.route('/download_file', methods=['GET', 'POST'])
@require_request_parameters('placement', 'directory', 'filename')
def download_file():
    """
    Files are not private. Anyone can see them if you upload them.

    :return:
    """
    # Get parameters
    placement = request.values.get('placement')
    directory = request.values.get('directory')
    filename = secure_filename(request.values.get('filename'))
    user, user_id = get_user()
    if None in (placement, directory, filename):
        return ajax_failure("No placement, directory, filename given!")
    if placement not in ("global", "course", "assignment", "submission", "user"):
        return ajax_failure(f"Invalid placement: {placement!r}")
    # app.config['UPLOADS_DIR']
    files_folder = "/".join(('uploads', 'files', placement))
    # Okay, we got this far, create it!
    file_path = "/".join((files_folder, secure_filename(directory), filename))
    suggest_download = any(filename.endswith(extension) for extension in SUGGEST_DOWNLOAD_EXTENSIONS)
    response = send_from_directory(
        current_app.static_folder, file_path, download_name=filename, as_attachment=suggest_download
    )
    response.headers['x-filename'] = filename
    return response


@blueprint_blockpy.route('/list_files/', methods=['GET', 'POST'])
@blueprint_blockpy.route('/list_files', methods=['GET', 'POST'])
@require_request_parameters('submission_id')
def list_files():
    submission_id = maybe_int(request.values.get("submission_id"))
    global_directory = request.values.get('global_directory', 'any')
    only_placements = {p for p in request.values.get('only_placements', '').split(',') if p}
    course_id = get_course_id()
    user, user_id = get_user()
    # Get submission
    submission = Submission.by_id(submission_id)
    check_resource_exists(submission, "Submission", submission_id)
    # Get assignment
    assignment = Assignment.by_id(submission.assignment_id)
    check_resource_exists(assignment, "Assignment", submission.assignment_id)
    # Get all possible file placements
    placements = [('global', 'global', global_directory),
                  ('user', 'user', user_id)]
    if submission.user_id != user_id:
        placements.append(('submission user', 'user', submission.user_id))
    placements.append(('course', 'course', course_id))
    if submission.course_id != course_id:
        placements.append(('submission course', 'course', submission.course_id))
    if assignment.course_id != course_id or assignment.course_id != submission.course_id:
        placements.append(('assignment course', 'course', assignment.course_id))
    placements.extend([
        ('assignment', 'assignment', assignment.id),
        ('submission', 'submission', submission.id)
    ])
    file_lists = {}
    for name, placement, directory in placements:
        if only_placements and placement not in only_placements:
            continue
        files_folder = os.path.join(current_app.config['UPLOADS_DIR'], 'files', placement, str(directory))
        if os.path.exists(files_folder):
            for filename in os.listdir(files_folder):
                if name not in file_lists:
                    file_lists[name] = []
                url = url_for('blockpy.download_file', placement=placement, directory=directory, filename=filename)
                file_lists[name].append([filename, url])
    return ajax_success({"success": True, "files": file_lists})


@blueprint_blockpy.route('/save_image/', methods=['GET', 'POST'])
@blueprint_blockpy.route('/save_image', methods=['GET', 'POST'])
@require_request_parameters('submission_id', 'directory', 'image')
def save_image():
    # Get parameters
    submission_id = maybe_int(request.values.get("submission_id"))
    directory = request.values.get('directory')
    image = request.values.get('image')
    course_id = get_course_id()
    user, user_id = get_user()
    submission = Submission.by_id(submission_id)
    # Check resource exists
    check_resource_exists(submission, "Submission", submission_id)
    # Verify permissions
    if submission.user_id != user_id and not user.is_grader(submission.course_id):
        return ajax_failure("This is not your submission and you are not a grader in its course.")
    # Do action
    success = submission.save_image(directory, image)
    make_log_entry(submission_id, submission.version, submission.assignment_id, submission.assignment_version,
                   course_id, user_id, "X-Image.Save", directory)
    return ajax_success({"success": success})


@blueprint_blockpy.route('/get_submission_image/', methods=['GET', 'POST'])
@blueprint_blockpy.route('/get_submission_image', methods=['GET', 'POST'])
@require_request_parameters('submission_id')
def get_submission_image():
    submission_id = int(request.values.get('submission_id'))
    relative_image_path = 'uploads/submission_blocks/{}.png'.format(submission_id)
    submission = Submission.query.get(submission_id)
    user, user_id = get_user()
    # Check exists
    check_resource_exists(submission, "Submission", submission_id)
    # Check permissions
    if submission.user_id != user_id:
        require_course_grader(user, submission.course_id)
    # Do action
    #print(relative_image_path)
    return current_app.send_static_file(relative_image_path)


@blueprint_blockpy.route('/get_image/', methods=['GET', 'POST'])
@blueprint_blockpy.route('/get_image', methods=['GET', 'POST'])
@require_request_parameters('submission_id', 'directory')
def get_image():
    submission_id = int(request.values.get('submission_id'))
    directory = request.values.get('directory')
    relative_image_path = 'uploads/{}/{}.png'.format(directory, submission_id)
    submission = Submission.query.get(submission_id)
    user, user_id = get_user()
    # Check exists
    check_resource_exists(submission, "Submission", submission_id)
    # Check permissions
    if submission.user_id != user_id and not user.is_grader(submission.course_id):
        return ajax_failure("This is not your submission and you are not a grader in its course.")
    # Do action
    return current_app.send_static_file(relative_image_path)


@blueprint_blockpy.route('/save_assignment/', methods=['GET', 'POST'])
@blueprint_blockpy.route('/save_assignment', methods=['GET', 'POST'])
@require_request_parameters('assignment_id')
@login_required
def save_assignment():
    assignment_id = request.values.get('assignment_id')
    user, user_id = get_user()
    course_id = get_course_id()
    assignment = Assignment.query.get(assignment_id)
    # Verify exists
    check_resource_exists(assignment, "Assignment", assignment_id)
    # Verify permissions
    if assignment.owner_id != user.id:
        # TODO: New workflow for "Forking" the assignment
        """It looks like you want to edit this assignment, but you are not an instructor
        or designer in the course that owns it ("Course Name"). Would you like to fork
        this assignment (or its entire group) so that you can save your modifications?
        
        You will need to update the Launch URL in the assignments' settings on Canvas!
        ([How do I do that?])
        
        [Fork just this assignment]
        [Fork entire assignment group]
        [Cancel]"""
        require_course_instructor(user, assignment.course_id, allow_fork=course_id)
    # Parse new settings
    updates = {}
    if "hidden" in request.values:
        updates["hidden"] = maybe_bool(request.values.get("hidden"))
    if "reviewed" in request.values:
        updates["reviewed"] = maybe_bool(request.values.get("reviewed"))
    if "public" in request.values:
        updates["public"] = maybe_bool(request.values.get("public"))
    if "url" in request.values:
        updates["url"] = request.values.get("url") or None
    if "ip_ranges" in request.values:
        updates["ip_ranges"] = request.values.get("ip_ranges")
    if "name" in request.values:
        updates["name"] = request.values.get("name")
    if "settings" in request.values:
        updates["settings"] = request.values.get("settings")
    if "points" in request.values:
        updates['points'] = maybe_int(request.values.get('points'))
    # Perform update
    modified = assignment.edit(updates)
    AssignmentLog.new(assignment.id, assignment.version, course_id,
                      user.id, AssignmentLogEvent.EDIT, "assignment_settings.blockpy",
                      json.dumps(updates), "", "")
    return ajax_success({"modified": modified})


@blueprint_blockpy.route('/load_file/', methods=['GET', 'POST'])
@blueprint_blockpy.route('/load_file', methods=['GET', 'POST'])
def load_file():
    return False
    """
    assignment_id = request.values.get('assignment_id', '0')
    filename = request.values.get('filename', None)
    type = request.values.get('type', None)
    if None in (filename, type, assignment_id):
        return ajax_failure("No Assignment ID, filename, or type given!")
    files_folder = os.path.join(app.config['UPLOADS_DIR'], 'files', assignment_id)
    ensure_dirs(files_folder)
    if type == 'url':
        filename = normalize_url(filename) + ".txt"
    elif type == 'file':
        filename = secure_filename(filename)
    file_path = os.path.join(files_folder, filename)
    try:
        with open(file_path) as inp:
            contents = inp.read()
        return jsonify(success=True, data=contents, ip=request.remote_addr)
    except IOError as e:
        return jsonify(success=False, message=str(e), ip=request.remote_addr)
        """


GAP_THRESHOLD = 2 * 60


def process_history(history):
    if len(history) <= 1:
        return 0
    total_duration = 0.0
    previous_time = None
    for a_time in history:
        parsed_time = datetime.strptime(a_time[:15], "%Y%m%d-%H%M%S")
        if previous_time != None:
            diff = (parsed_time - previous_time).seconds
            if diff < GAP_THRESHOLD:
                total_duration += diff
        previous_time = parsed_time
    return total_duration / 60.


@blueprint_blockpy.route('/browse_submissions', methods=['GET', 'POST'])
@blueprint_blockpy.route('/browse_submissions/', methods=['GET', 'POST'])
def browse_submissions():
    """
    TODO: Check if this is deprecated?
    :return:
    """
    assignment_id = request.values.get('assignment_id', None)
    if assignment_id is None:
        return ajax_failure("No Assignment ID given!")
    assignment_id = int(assignment_id)
    course_id = request.values.get('course_id', g.course.id if 'course' in g else None)
    if course_id == None or course_id == "":
        return ajax_failure("No Course ID given!")
    if g.user is None or not g.user.is_instructor(int(course_id)):
        return ajax_failure("You are not an instructor in this assignments' course.")
    submissions = Submission.by_assignment(assignment_id, int(course_id))
    for submission, user, assignment in submissions:
        submission.highlighted_code = highlight_python_code(submission.code)
        submission.history = process_history([h['time']
                                              for h in reversed(submission.get_history())])
    return render_template('blockpy/browse_submissions.html',
                           course_id=course_id,
                           assignment_id=assignment_id,
                           submissions=submissions,
                           ip=request.remote_addr)


@blueprint_blockpy.route('/watch', methods=['GET', 'POST'])
@blueprint_blockpy.route('/watch/', methods=['GET', 'POST'])
def watch():
    assignment_list = request.values.get('assignments', '')
    assignments = [int(aid) for aid in assignment_list.split(',') if len(aid) > 0]
    course_id = request.values.get('course_id', g.course.id if 'course' in g else None)
    if course_id == None or course_id == "":
        return ajax_failure("No Course ID given!")
    if g.user is None or not g.user.is_instructor(int(course_id)):
        return ajax_failure("You are not an instructor in this assignments' course.")
    update = request.values.get('update', 'false') == "true"
    if update:
        data = []
        for aid in assignments:
            submissions = Submission.by_assignment(aid, int(course_id))
            completions = sum([int(sua[0].correct) for sua in submissions])
            workings = Submission.get_latest(aid, int(course_id))
            histories = [process_history([h['time'] for h in sua[0].get_history()])
                         for sua in submissions]
            touches = [int(sua[0].version) for sua in submissions]
            feedbacks = [l[0] for l in Log.calculate_feedbacks(aid, course_id)]
            data.append({'id': aid,
                         'Completions': completions,
                         'Workings': workings,
                         'Time': histories,
                         'Touches': touches,
                         'Feedbacks': feedbacks})
        return jsonify(success=True, data=data)
    else:
        assignments = [Assignment.by_id(aid) for aid in assignments]
        return render_template('blockpy/watch.html', course_id=course_id, assignments=assignments,
                               assignment_list=assignment_list)


@blueprint_blockpy.route('/images/<path:path>', methods=['GET', 'POST'])
def assignments_static_images(path):
    return current_app.send_static_file('images/' + path)


@blueprint_blockpy.route('/load_assignment_give_feedback/', methods=['GET', 'POST'])
@blueprint_blockpy.route('/load_assignment_give_feedback', methods=['GET', 'POST'])
def load_assignment_give_feedback():
    '''
    Very random function necessary for syncing with JN - we need to expose the 'on_run'
    field from assignments in public courses.

    TODO: Do this for public courses only, not just private ones

    :return:
    '''
    assignment_id = request.values.get('assignment_id', None)
    if assignment_id is None:
        return ajax_failure("No Assignment ID given!")
    assignment = Assignment.by_id(assignment_id)
    return jsonify(success=True, give_feedback=assignment.on_run)


HISTORY_PAGE_LIMIT = 250


@blueprint_blockpy.route('/browse_history/', methods=['GET', 'POST'])
@blueprint_blockpy.route('/browse_history', methods=['GET', 'POST'])
@require_request_parameters("assignment_id", "course_id", "user_id")
def browse_history():
    # Get parameters
    course_id = maybe_int(request.values.get('course_id'))
    assignment_id = maybe_int(request.values.get('assignment_id'))
    student_id = maybe_int(request.values.get('user_id'))
    page_offset = maybe_int(request.values.get('page_offset', 0))
    embed = maybe_bool(request.values.get('embed'))
    user, user_id = get_user()
    # Get resources
    assignment = Assignment.by_id(assignment_id)
    student = User.by_id(student_id)
    course = Course.by_id(course_id)
    # Verify user can see the submission
    if user_id != student_id and not user.is_grader(course_id):
        return ajax_failure("Only graders can see logs for other people.")
    history = Log.get_history(course_id, assignment_id, student_id,
                              page_offset, HISTORY_PAGE_LIMIT)
    return render_template('blockpy/browse_history.html', assignment=assignment,
                           student=student, course=course, history=history,
                           embed=embed)


@blueprint_blockpy.route('/list_urls/', methods=['GET', 'POST'])
@blueprint_blockpy.route('/list_urls', methods=['GET', 'POST'])
def list_urls():
    partial = request.values.get('partial', "")
    # TODO: Allow filtering by course?
    course_id = maybe_int(request.values.get('course_id'))
    # Do action
    return jsonify(success=True, urls=Assignment.list_urls(partial)[:5])


@blueprint_blockpy.route('/fork_assignment/', methods=['GET', 'POST'])
@blueprint_blockpy.route('/fork_assignment', methods=['GET', 'POST'])
@login_required
def fork_assignment():
    assignment_id = request.values.get('assignment_id')
    assignment_group_id = request.values.get('assignment_group_id')
    if assignment_id is None and assignment_group_id is None:
        return ajax_failure("No Assignment or Assignment Group ID given!")
    user, user_id = get_user()
    course_id = get_course_id()
    updated_settings = request.values.get('updated_settings', '')
    transfer_submissions = maybe_bool(request.values.get('transfer_submissions', False))
    # Verify permissions: They only need to be an instructor in this course
    require_course_instructor(user, course_id)
    # Load and verify resources
    if assignment_group_id:
        group = AssignmentGroup.query.get(assignment_group_id)
        check_resource_exists(group, "AssignmentGroup", assignment_group_id)
        # Create forked group, assignment, memberships
        new_group, new_assignments = group.fork()
    else:
        assignment = Assignment.query.get(assignment_id)
        check_resource_exists(assignment, "Assignment", assignment_id)
        # Create forked assignment, set it as target
        new_assignments = [assignment.fork(user_id, course_id)]
    # Transfer all submissions, if desired
    if transfer_submissions:
        for new_assignment in new_assignments:
            # TODO: Need old assignment IDs
            submission = Submission.by_assignment(new_assignment.id, course_id)
            submission.edit({'assignment_id': new_assignment.id})
            # TODO: Also need to grab this for Log, Review
    # TODO: Parse updated settings for the assignment_id, if it's not None

    # TODO: Perform update
    modified = assignment.edit(updated_settings)
    # TODO: Log
    AssignmentLog.new(assignment.id, assignment.version, course_id,
                      user.id, "edit",
                        "assignment_settings.blockpy",
                      json.dumps(updated_settings),
                      "", "")
    return ajax_success({"modified": modified})


@blueprint_blockpy.route('/get_recent_logs_for_course/', methods=['GET', 'POST'])
@blueprint_blockpy.route('/get_recent_logs_for_course', methods=['GET', 'POST'])
@require_request_parameters("course_id")
def get_recent_logs_for_course():
    # Get parameters
    course_id = maybe_int(request.values.get('course_id'))
    duration_amount = maybe_int(request.values.get('duration_amount', 1))
    duration_type = request.values.get('duration_type', 'days')
    embed = maybe_bool(request.values.get('embed'))
    user, user_id = get_user()
    # Get resources
    course = Course.by_id(course_id)
    # Verify user is a grader
    if not user.is_grader(course_id):
        return ajax_failure("Only graders can see logs for the entire course.")
    history = Log.get_recent_logs_for_course(course_id, duration_amount, duration_type)
    return ajax_success({'history': history})


@blueprint_blockpy.route('/recent_submissions/', methods=['GET', 'POST'])
@blueprint_blockpy.route('/recent_submissions', methods=['GET', 'POST'])
@login_required
def recent_submissions():
    ''' List all recent submissions in this course visible to the given user '''
    # Get the grader
    user, user_id = get_user()
    # Get the user
    student_email = request.values.get('email')
    student, student_id = None, None
    if student_email:
        student = User.find_student(student_email)
        if student:
            student_id = student.id
    else:
        student_id = maybe_int(request.values.get('id'))
        if student_id:
            student = User.by_id(student_id)

    # Get their submissions
    if student and student_id:
        submissions = Submission.all_by_student(student_id)
        # Filter by permissions
        submissions = [
            (s, u, a, Course.by_id(s.course_id)) for s, u, a in submissions
            if g.user.is_grader(int(s.course_id))
        ]
        submissions = sorted(submissions, key=lambda suac: suac[0].date_modified, reverse=True)
        if submissions:
            return render_template('blockpy/recent_submissions.html', submissions=submissions, student=student)
    return "Access denied for that user, or user not found. Check spelling!"


@blueprint_blockpy.route('/estimate_duration/', methods=['GET', 'POST'])
@blueprint_blockpy.route('/estimate_duration', methods=['GET', 'POST'])
@require_request_parameters("submission_id")
def estimate_duration():
    # Get parameters
    submission_id = maybe_int(request.values.get('submission_id'))
    user, user_id = get_user()
    # Get resources
    submission = Submission.by_id(submission_id)
    check_resource_exists(submission, "Submission", submission_id)
    # Verify user is a grader
    if not user.is_grader(submission.course_id) and user_id != submission.user_id:
        return ajax_failure("Only graders or the assignment owner can see their submission duration estimate.")
    return ajax_success({'duration': submission.estimate_duration()})


@blueprint_blockpy.route('/estimate_group_duration/', methods=['GET', 'POST'])
@blueprint_blockpy.route('/estimate_group_duration', methods=['GET', 'POST'])
@require_request_parameters("assignment_group_id", "course_id")
def estimate_group_duration():
    # Get parameters
    assignment_group_id = maybe_int(request.values.get('assignment_group_id'))
    course_id = maybe_int(request.values.get('course_id'))
    user, user_id = get_user()
    # Get resources
    assignment_group = AssignmentGroup.by_id(assignment_group_id)
    check_resource_exists(assignment_group, "AssignmentGroup", assignment_group_id)
    assignments = assignment_group.get_assignments()
    submissions = [assignment.load(user_id, course_id=course_id) for assignment in assignments]
    # Verify user is a grader
    total_duration = 0
    for submission in submissions:
        if not user.is_grader(submission.course_id) and user_id != submission.user_id:
            return ajax_failure("Only graders or the assignment owner can see their submission duration estimate.")
        total_duration += submission.estimate_duration()
    return ajax_success({'duration': total_duration})


@blueprint_blockpy.route('/openai/', methods=['GET', 'POST'])
@blueprint_blockpy.route('/openai', methods=['GET', 'POST'])
@require_request_parameters("submission_id")
def openai():
    # Get parameters
    submission_id = maybe_int(request.values.get('submission_id'))
    user, user_id = get_user()
    # Get resources
    submission = Submission.by_id(submission_id)
    check_resource_exists(submission, "Submission", submission_id)
    # Check permissions
    if submission.user_id != user_id and not user.is_grader(submission.course_id):
        return ajax_failure("This is not your submission and you are not a grader in its course.")
    # Actually proxy the call
    try:
        pass
    except Exception as e:
        pass
    # Log the call in the database
    return "HEY LISTEN"
