import io
import json
import zipfile

from natsort import natsorted
from werkzeug.exceptions import HTTPException
from werkzeug.utils import secure_filename

from models.assignment_group_membership import AssignmentGroupMembership
from models.data_formats.progsnap2 import dump_progsnap
from models.data_formats.portation import export_bundle, import_bundle, export_zip, export_pdf_zip

try:
    from urllib.parse import quote as url_quote
except:
    from urllib import quote as url_quote

from quart import (Blueprint, g, session, render_template, url_for, request, jsonify, abort, make_response,
                   flash, redirect, Response, current_app)

from common.highlighters import strip_tags
from controllers.auth import get_user
from controllers.helpers import (get_lti_property, require_request_parameters, login_required,
                                 require_course_instructor, get_select_menu_link,
                                 check_resource_exists, parse_assignment_load, get_course_id, ajax_success,
                                 ajax_failure, maybe_int, maybe_bool, require_course_grader,
                                 get_assignments_in_groups)

import controllers.endpoints.maze as maze
import controllers.endpoints.blockpy as blockpy
import controllers.endpoints.courses as course_endpoints

from models import db
from models.user import User
from models.course import Course
from models.assignment import Assignment
from models.assignment_group import AssignmentGroup
from models.submission import Submission

blueprint_assignments = Blueprint('assignments', __name__, url_prefix='/assignments')

@blueprint_assignments.route('/', methods=['GET', 'POST'])
@blueprint_assignments.route('/load/', methods=['GET', 'POST'])
@blueprint_assignments.route('/load', methods=['GET', 'POST'])
def load():
    grade_mode = request.args.get('grade_mode', False)
    if grade_mode == 'dashboard':
        # TODO: Should this be an allowlist?
        return course_endpoints.dashboard()
    if grade_mode == 'textbook':
        return load_textbook(request.args.get('assignment_url', ''))
    if grade_mode == "group":
        course_id = maybe_int(request.args.get('course_id'))
        user_id = maybe_int(request.args.get('graded_user_id'))
        assignment_group_id = maybe_int(request.args.get('assignment_group_id'))
        return blockpy.view_submissions(course_id, user_id, assignment_group_id)
    if grade_mode == "single":
        return blockpy.view_submission()
    if grade_mode == 'filter':
        return course_endpoints.submissions_filter(request.args.get('course_id'))
    if grade_mode == 'watch':
        return course_endpoints.watch_events()
    editor_information = parse_assignment_load()

    # Use the proper template
    if editor_information['assignments']:
        if editor_information['assignments'][0].type == 'maze':
            return maze.load_editor(editor_information)

    return blockpy.load_editor(editor_information)


@blueprint_assignments.route('/load_grade/', methods=['GET', 'POST'])
@blueprint_assignments.route('/load_grade', methods=['GET', 'POST'])
def load_grade(*args, assignment_group_id=None, course_id=None, user_id=None, **kwargs):
    return blockpy.view_submissions(course_id, user_id, assignment_group_id, *args, **kwargs)


@blueprint_assignments.route('/reading/<path>/', methods=['GET', 'POST'])
@blueprint_assignments.route('/reading/<path>', methods=['GET', 'POST'])
def load_reading(path):
    editor_information = parse_assignment_load(path)

    if 'embed' not in request.values:
        editor_information['embed'] = True

    # Use the proper template
    if len(editor_information['assignments']) == 1:
        if editor_information['assignments'][0].type == 'reading':
            return blockpy.load_editor(editor_information)

    return jsonify(success=False, message="There is no reading with that information")


@blueprint_assignments.route('/textbook/<path>/', methods=['GET', 'POST'])
@blueprint_assignments.route('/textbook/<path>', methods=['GET', 'POST'])
def load_textbook(path):
    editor_information = parse_assignment_load(path)

    page = request.values.get('page', '')

    page_title = ""
    if page:
        current_page = Assignment.by_url(page)
        if current_page:
            page = current_page.id
            page_title = current_page.name
        else:
            page = maybe_int(page)
            current_page = Assignment.by_id(page)
            if current_page:
                page_title = current_page.name

    if 'embed' not in request.values:
        editor_information['embed'] = True

    # Use the proper template
    if len(editor_information['assignments']) == 1:
        if editor_information['assignments'][0].type == 'textbook':
            assignment = editor_information['assignments'][0]
            textbook, default_first_page = assignment.load_as_textbook()
            if not textbook['success']:
                return abort(400, "Error: " + repr(textbook['message']))
            return render_template('blockpy/textbook.html', textbook=textbook, ip=request.remote_addr,
                                   assignment=editor_information['assignments'][0],
                                   page_id=page if page else default_first_page.id if default_first_page else None,
                                   page_title=page_title if page else default_first_page.name if default_first_page else None,
                                   **editor_information)

    return jsonify(success=False, message="There is no textbook with that information")


@blueprint_assignments.route('/fork', methods=['GET', 'POST'])
@blueprint_assignments.route('/fork/', methods=['GET', 'POST'])
@require_request_parameters('assignment_id')
@login_required
def fork():
    ''' Fork an assignment to a course'''
    # Get arguments
    course_id = get_course_id()
    assignment_id = int(request.values.get('assignment_id'))
    is_embedded = ('embed' == request.values.get('menu', "select"))
    group = maybe_int(request.values.get('group', "-1"))
    new_url = request.values.get('url')
    # Load resource
    assignment = Assignment.by_id(assignment_id)
    # Verify exists
    check_resource_exists(assignment, "Assignment", assignment_id)
    # Verify permissions
    require_course_instructor(g.user, course_id)
    # Perform action
    if new_url is not None:
        existing = Assignment.by_url(new_url)
        if existing:
            return ajax_failure("Assignment URL is already taken!")
    forked_assignment = assignment.fork(new_owner_id=g.user.id, new_course_id=course_id)
    if group != -1:
        AssignmentGroupMembership.move_assignment(forked_assignment.id, group)
    if new_url is not None:
        forked_assignment.url = new_url
        db.session.commit()
    # Result
    select_url = get_select_menu_link(forked_assignment.id, forked_assignment.name, is_embedded, False)
    return jsonify(success=True,
                   redirect=url_for('assignments.load', assignment_id=forked_assignment.id),
                   id=forked_assignment.id,
                   url=forked_assignment.url,
                   name=forked_assignment.name,
                   type=forked_assignment.type,
                   group=group,
                   instructions=forked_assignment.instructions[:255], #strip_tags(forked_assignment.instructions)[:255],
                   title=forked_assignment.title(),
                   view=url_for('assignments.load', assignment_id=forked_assignment.id, embed=is_embedded),
                   select=select_url,
                   export=url_for('assignments.export', assignment_id=assignment.id),
                   submissions=url_for('courses.submissions_filter', course_id=course_id, criteria='assignment', search_key=assignment.id),
                   edit=url_for('assignments.load', assignment_id=forked_assignment.id, course_id=forked_assignment.course_id),
                   date_modified=forked_assignment.pretty_date_modified())


@blueprint_assignments.route('/new/', methods=['GET', 'POST'])
@blueprint_assignments.route('/new', methods=['GET', 'POST'])
@require_request_parameters('course_id')
@login_required
def new_assignment():
    # Get arguments
    course_id = int(request.values.get('course_id'))
    name = request.values.get('name', None) or None
    url = request.values.get('url', None) or None
    level = request.values.get('level', None) or None
    is_embedded = ('embed' == request.values.get('menu', "select"))
    assignment_type = request.values.get('type', "blockpy")
    group = maybe_int(request.values.get('group', "-1"))
    # Verify permissions
    require_course_instructor(g.user, course_id)
    # Perform action
    assignment = Assignment.new(owner_id=g.user.id, course_id=course_id, url=url,
                                type=assignment_type, name=name, level=level)
    if group != -1:
        AssignmentGroupMembership.move_assignment(assignment.id, group)
    select_url = get_select_menu_link(assignment.id, assignment.title(), is_embedded, False)
    return jsonify(success=True,
                   redirect=url_for('assignments.load', assignment_id=assignment.id),
                   id=assignment.id,
                   url=url,
                   name=assignment.name,
                   type=assignment_type,
                   group=group,
                   instructions=strip_tags(assignment.instructions)[:255],
                   title=assignment.title(),
                   view=url_for('assignments.load', assignment_id=assignment.id, embed=is_embedded),
                   submissions=url_for('courses.submissions_filter', course_id=course_id, criteria='assignment',
                                       search_key=assignment.id),
                   select=select_url,
                   export=url_for('assignments.export', assignment_id=assignment.id),
                   edit=url_for('assignments.load', assignment_id=assignment.id, course_id=assignment.course_id),
                   date_modified=assignment.pretty_date_modified())


@blueprint_assignments.route('/get/', methods=['GET', 'POST'])
@blueprint_assignments.route('/get', methods=['GET', 'POST'])
@login_required
def get_assignment():
    """
    Pretty sure this is deprecated.
    :return:
    """
    assignment_id = int(request.values.get('assignment_id'))
    assignment = Assignment.by_id(assignment_id)
    is_embedded = ('embed' == request.values.get('menu', "select"))
    # Verify exists
    check_resource_exists(assignment, "Assignment", assignment_id)
    # Perform action
    select_url = get_select_menu_link(assignment.id, assignment.title(), is_embedded, False)
    return jsonify(success=True,
                   redirect=url_for('assignments.load', assignment_id=assignment.id),
                   id=assignment.id,
                   name=assignment.name,
                   type=assignment.type,
                   instructions=strip_tags(assignment.instructions)[:255],
                   title=assignment.title(),
                   view=url_for('assignments.load', assignment_id=assignment.id, embed=is_embedded),
                   select=select_url,
                   export=url_for('assignments.export', assignment_id=assignment.id),
                   edit=url_for('assignments.load', assignment_id=assignment.id, course_id=assignment.course_id),
                   date_modified=assignment.pretty_date_modified())


@blueprint_assignments.route('/remove', methods=['GET', 'POST'])
@blueprint_assignments.route('/remove/', methods=['GET', 'POST'])
@require_request_parameters('assignment_id')
@login_required
def remove_assignment():
    assignment_id = int(request.values.get('assignment_id'))
    assignment = Assignment.by_id(assignment_id)
    # Verify exists
    check_resource_exists(assignment, "Assignment", assignment_id)
    # Verify permissions
    require_course_instructor(g.user, assignment.course_id)
    Assignment.remove(assignment.id)
    return jsonify(success=True)


@blueprint_assignments.route('/move_course', methods=['GET', 'POST'])
@blueprint_assignments.route('/move_course/', methods=['GET', 'POST'])
@require_request_parameters('new_course_id', 'assignment_id')
@login_required
def move_course():
    assignment_id = int(request.values.get('assignment_id'))
    new_course_id = int(request.values.get('new_course_id'))
    assignment = Assignment.by_id(int(assignment_id))
    # Verify exists
    check_resource_exists(assignment, "Assignment", assignment_id)
    # Verify permissions
    require_course_instructor(g.user, assignment.course_id)
    require_course_instructor(g.user, new_course_id)
    # Perform action
    assignment.move_course(new_course_id)
    return jsonify(success=True)


@blueprint_assignments.route('/select', methods=['GET', 'POST'])
@blueprint_assignments.route('/select/', methods=['GET', 'POST'])
def select(menu='select'):
    """
    Let's the user select from a list of assignments.
    """
    # Store current user_id and context_id
    assignments = Assignment.get_available()
    groups = AssignmentGroup.query.all()
    return_url = get_lti_property('launch_presentation_return_url')
    course_groups = Course.get_all_groups(menu)
    editable_courses = g.user.get_editable_courses()

    return render_template('lti/select.html', assignments=assignments, groups=groups, return_url=return_url, menu=menu,
                           editable_courses=editable_courses, course_groups=course_groups)


@blueprint_assignments.route('/select_embed/', methods=['GET', 'POST'])
@blueprint_assignments.route('/select_embed', methods=['GET', 'POST'])
def select_embed():
    """ Let's the user select from a list of assignments.
    """
    return select(menu='embed')


@blueprint_assignments.route('/get_ids/', methods=['GET'])
@blueprint_assignments.route('/get_ids', methods=['GET'])
@login_required
def get_assignments():
    assignment_ids = request.values.get('assignment_ids', "")
    course_id = get_course_id()
    user, user_id = get_user()
    # TODO: Remove any that are not valid for this user to view
    # Alternatively, ONLY send the IDs back, not the full assignment information
    assignments, groups = [], []
    errors = []
    if not assignment_ids:
        grouped_assignments, scopes, errors = g.safely.load_submitted_assignments_grouped(int(course_id), abort_on_error=False)
        grouped_assignments = [ga for ga, scope in zip(grouped_assignments, scopes)
                               if scope.can_grade]
        assignments = [a.Assignment.encode_json() for a in grouped_assignments]
        groups = [a.AssignmentGroup.encode_json() if a.AssignmentGroup is not None else None for a in grouped_assignments]
        errors = [f"Error loading Assignment ID {failed_ga.Assignment.id!r}: {str(error)}"
                  for failed_ga, error in errors]
    else:
        for assignment_id in assignment_ids.split(","):
            if not assignment_id or not assignment_id.isdigit():
                errors.append(f"Unknown Assignment ID: {assignment_id!r}")
                continue
            try:
                scope, assignment = g.safely.load_assignment_by_id(int(assignment_id), int(course_id))
            except HTTPException as e:
                errors.append(f"Error loading Assignment ID {assignment_id!r}: {str(e)}")
                continue
            if scope.can_grade:
                assignments.append(assignment.encode_json())
    return ajax_success(dict(assignments=assignments, errors=errors, groups=groups))


@blueprint_assignments.route('/by_url/', methods=['GET'])
@blueprint_assignments.route('/by_url', methods=['GET'])
@login_required
def by_url():
    assignment_url = request.values.get('url')
    course_id = get_course_id()
    user, user_id = get_user()
    if assignment_url is None:
        return ajax_failure("No assignment URL was provided")
    # TODO: verify that they have the permissions to see these assignments
    assignment = Assignment.by_url(assignment_url)
    check_resource_exists(assignment, "Assignment", assignment_url)
    return ajax_success(dict(assignment=assignment.encode_json()))


@blueprint_assignments.route('/export/', methods=['GET', 'POST'])
@blueprint_assignments.route('/export', methods=['GET', 'POST'])
@require_request_parameters('assignment_id')
def export():
    assignment_id = int(request.values.get('assignment_id'))
    assignment = Assignment.by_id(assignment_id)
    course_id = get_course_id(True)
    user, user_id = get_user()
    # Verify exists
    check_resource_exists(assignment, "Assignment", assignment_id)
    # Verify permissions
    require_course_instructor(user, course_id)
    require_course_instructor(user, assignment.course_id)
    # Perform action
    bundle = export_bundle(assignments=[assignment])
    filename = assignment.get_filename()
    return Response(json.dumps(bundle), mimetype='application/json',
                    headers={'Content-Disposition': 'attachment;filename={}'.format(filename)})


@blueprint_assignments.route('/bulk_upload/', methods=['GET', 'POST'])
@blueprint_assignments.route('/bulk_upload', methods=['GET', 'POST'])
def bulk_upload():
    course_id = request.values.get('course_id', None)
    if course_id is None:
        return jsonify(success=False, message="No course id")
    if not g.user.is_instructor(int(course_id)):
        return jsonify(success=False, message="Not an instructor in this course")
    if request.method == 'POST':
        if 'file' not in request.files:
            flash('No file part')
            return redirect(request.url)
        file = request.files['file']
        if file.filename == '':
            flash('No selected file')
            return redirect(request.url)
        if file:
            bundle = json.loads(file.read().decode('utf-8'))
            import_bundle(bundle, owner_id=g.user.id, course_id=course_id, can_force=g.user.is_admin())
            flash("File uploaded successfully")
            return redirect(request.url)
        flash("No file contents")
        return redirect(request.url)
    else:
        return '''
    <!doctype html>
    <title>Upload assignments (JSON)</title>
    <h1>Upload assignments (JSON)</h1>
    <form action="" method=post enctype=multipart/form-data>
      <p><input type=file name=file>
         <input type=submit value=Upload>
    </form>
    '''


@blueprint_assignments.route('/images/<path:path>', methods=['GET', 'POST'])
def assignments_static_images(path):
    return current_app.send_static_file('images/' + path)


@blueprint_assignments.route('/export_submissions/', methods=['GET', 'POST'])
@blueprint_assignments.route('/export_submissions', methods=['GET', 'POST'])
@login_required
@require_request_parameters('assignment_id')
def export_submissions():
    assignment_id = int(request.values.get('assignment_id'))
    with_history = maybe_bool(request.values.get('history', "false"))
    assignment = Assignment.by_id(assignment_id)
    course_id = get_course_id(True)
    user, user_id = get_user()
    # File format of results: {"pdf", "code"}
    format = request.values.get("format", "code")
    # Verify exists
    check_resource_exists(assignment, "Assignment", assignment_id)
    # Verify permissions
    assignment = Assignment.by_id(int(assignment_id))
    if course_id is None or not user.is_instructor(int(course_id)):
        return "You are not an instructor or the owner of the assignment!"
    # Get data
    course = Course.by_id(course_id)
    suas = Submission.by_assignment(assignment_id, course_id)
    submissions = [sua[0] for sua in suas]
    users = [sua[1] for sua in suas]
    if format == "pdf":
        bundle = export_pdf_zip(assignments=[assignment], submissions=submissions, users=users,
                                jinja_environment=current_app.jinja_env)
    else:
        bundle = export_zip(assignments=[assignment], submissions=submissions,
                            users=users, with_history=with_history)
    filename = course.get_url_or_id() + '-' + assignment.get_filename(extension='.zip')
    return Response(bundle, mimetype='application/zip',
                    headers={'Content-Disposition': 'attachment;filename={}'.format(filename)})


@blueprint_assignments.route('/export_progsnap/', methods=['GET', 'POST'])
@blueprint_assignments.route('/export_progsnap', methods=['GET', 'POST'])
@login_required
@require_request_parameters('user_id')
def export_progsnap():
    student_id = int(request.values.get('user_id'))
    course_id = get_course_id()
    user, user_id = get_user()
    # Verify permissions
    if course_id is None or not user.is_instructor(int(course_id)) or not user_id == student_id:
        return "You are not an instructor or the owner of the assignment!"
    # Get data
    zip_filename = secure_filename(user.name()) + '.zip'
    # Start filling it up
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
        for filename in dump_progsnap(zip_file, course_id, None, [student_id]):
            pass

    return Response(zip_buffer.getvalue(), mimetype='application/zip',
                    headers={'Content-Disposition': f'attachment;filename={zip_filename}'})

@blueprint_assignments.route('/transfer_course/', methods=['GET', 'POST'])
@blueprint_assignments.route('/transfer_course', methods=['GET', 'POST'])
@login_required
@require_request_parameters('submission_id')
def transfer_course():
    submission_id = int(request.values.get('submission_id'))
    submission = Submission.by_id(submission_id)
    assignment = Assignment.by_id(submission.assignment_id)
    new_course_id = maybe_int(request.values.get('new_course_id'))
    course_id = get_course_id(True)
    user, user_id = get_user()
    # Verify exists
    check_resource_exists(submission, "Submission", submission_id)
    # Verify permissions
    original_course_id = submission.course_id
    if not user.is_instructor(int(original_course_id)):
        return "You are not an instructor in the submission's course!"
    # List some courses for this instructor to move them to
    if new_course_id is None:
        course = Course.by_id(original_course_id)
        student = User.by_id(submission.user_id)
        editable_courses = g.user.get_editable_courses()
        editable_submissions = [(course, Submission.get_submission(submission.assignment_id,
                                                                   submission.user_id,
                                                                   course.id))
                                for course in editable_courses]
        return render_template("assignments/transfer_course.html", submission=submission,
                               new_course_id=new_course_id, course_id=course_id,
                               assignment=assignment, course=course, student=student,
                               editable_courses=editable_courses, editable_submissions=editable_submissions)
    # Do the change instead
    if not user.is_instructor(new_course_id):
        return "You are not an instructor in the new target course!"
    # Get data

    new_course_submission = Submission.load_or_new(assignment,
                                                   submission.user_id,
                                                   new_course_id,
                                                   assignment_group_id=submission.assignment_group_id)
    new_course_submission.copy_from(submission)
    return ajax_success({"message": "Update successful", "new": new_course_submission.encode_json(),
                         "old": submission.encode_json()})


@blueprint_assignments.route('/bulk_transfer_course/', methods=['GET', 'POST'])
@blueprint_assignments.route('/bulk_transfer_course', methods=['GET', 'POST'])
@login_required
def bulk_transfer_course():
    user, user_id = get_user()
    # Might have been provided identifying information
    source_course_id = maybe_int(request.values.get('source_course_id'))
    assignment_group_id = maybe_int(request.values.get('assignment_group_id'))
    destination_course_id = maybe_int(request.values.get('destination_course_id'))

    # Sorting order
    sort_courses_by = request.values.get('sort_courses_by', 'name')

    overwrite_endpoints = maybe_bool(request.values.get('overwrite-endpoints', "false"))

    # Load up potential information
    source_course = Course.by_id(source_course_id)
    assignment_group = AssignmentGroup.by_id(assignment_group_id)
    destination_course = Course.by_id(destination_course_id)

    # Check that this is allowed
    if source_course_id is not None:
        check_resource_exists(source_course, "Course", source_course_id)
        require_course_instructor(user, source_course_id)
    if destination_course_id is not None:
        check_resource_exists(destination_course, "Course", destination_course_id)
        require_course_instructor(user, destination_course_id)
    if assignment_group_id is not None:
        check_resource_exists(assignment_group, "AssignmentGroup", assignment_group_id)

    if assignment_group and source_course and destination_course:
        assignments = assignment_group.get_assignments()
        assignment_map = {assignment.id: assignment for assignment in assignments}
        assignment_ids = list(assignment_map.keys())
        old_submissions = {
            (submission.assignment_id, submission.user_id): submission
            for submission in source_course.get_submissions(assignment_ids)
        }
        new_submissions = {
            (submission.assignment_id, submission.user_id): submission
            for submission in destination_course.get_submissions(assignment_ids)
        }
        all_user_ids = {submission.user_id for submission in old_submissions.values()}
        all_user_ids.update({submission.user_id for submission in new_submissions.values()})
        user_map = {user_id: User.by_id(user_id) for user_id in all_user_ids}
        potential_transfers = []
        for user_id in all_user_ids:
            for assignment_id in assignment_ids:
                old_submission = old_submissions.get((assignment_id, user_id))
                new_submission = new_submissions.get((assignment_id, user_id))
                if old_submission:
                    potential_transfers.append((user_map[user_id], assignment_map[assignment_id],
                                                old_submission, new_submission))
    else:
        potential_transfers = []

    # Check if we have the requisite transfer information
    if request.method == 'POST':
        # If the "do-transfer" button was clicked:
        if 'do-transfer' in request.values:
            copied_subs, overwritten_subs, skipped_subs = [], [], []
            for user, assignment, old_submission, new_submission in potential_transfers:
                key = f"transfer-submission-{old_submission.id}"
                should_transfer = maybe_bool(request.values[key])
                if should_transfer:
                    if new_submission is None:
                        new_submission = Submission.load_or_new(assignment,
                                                                old_submission.user_id,
                                                                destination_course_id,
                                                                new_submission_url=old_submission.endpoint,
                                                                assignment_group_id=assignment_group_id,
                                                                new_due_date=old_submission.date_due,
                                                                new_lock_date=old_submission.date_locked)
                        copied_subs.append((user, assignment, old_submission, new_submission))
                    else:
                        overwritten_subs.append((user, assignment, old_submission, new_submission))
                    new_submission.copy_from(old_submission, overwrite_endpoints)
                else:
                    skipped_subs.append((user, assignment, old_submission, new_submission))

            message_parts = ["Submission transfer complete.<br>"]
            for kind, subs in [("copied", copied_subs), ("overwritten", overwritten_subs)]:
                message_parts.append(f"{len(subs)} {kind} submissions:")
                if subs:
                    message_parts.append("<ul>")
                for user, assignment, old_submission, new_submission in subs:
                    message_parts.append(f"<li>{user.name()} - {assignment.name} ({old_submission.id} -> {new_submission.id})</li>")
                if subs:
                    message_parts.append("</ul>")
                message_parts.append("<br>")
            message_parts.append(f"<br>Skipped {len(skipped_subs)} submissions.")

            # return ajax_success({"message": "Update successful", "new": new_course_submission.encode_json(),
            #                     "old": submission.encode_json()})
            flash("".join(message_parts))
            return redirect(request.url)

    # Get the information for dropdowns
    available_courses = user.get_grading_courses(sort_courses_by)
    if source_course_id is not None:
        grouped_assignments, assignments_by_group, group_headers, groups = get_assignments_in_groups(source_course)
    else:
        grouped_assignments, assignments_by_group, group_headers, groups = [], {}, {}, []


    return render_template("assignments/bulk_transfer_course.html",                           source_course_id=source_course_id, destination_course_id=destination_course_id,
                           assignment_group_id=assignment_group_id,
                           source_course=source_course, destination_course=destination_course,
                             assignment_group=assignment_group,
                           potential_transfers=potential_transfers,
                             available_courses=available_courses,
                           groups=groups, sort_courses_by=sort_courses_by,
                           )

