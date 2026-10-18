"""
Helper functions for Flask controllers.

This includes a bunch of security/permission checks. Previously, this would
return 200 responses with success=False, but we will eventually use proper HTTP status codes
and Flask's abort() function to handle errors. Unfortunately, the frontend
is not yet configured to use this new approach. So we're in a transition period.

Each of these functions can receive a keyword argument `as_html` which,
if True, will return HTML error messages instead of JSON. This is useful for
endpoints that are expected to return HTML pages rather than JSON responses.
"""

# Built-in imports
from urllib.parse import quote as url_quote
import json
from functools import wraps

from natsort import natsorted

# Flask imports
from flask import g, request, redirect, url_for, make_response, current_app, has_request_context
from flask import flash, session, jsonify, abort

from common.dates import from_canvas_isotime
from common.maybe import maybe_bool, maybe_int
from models.course import Course
from models.assignment import Assignment
from models.assignment_group import AssignmentGroup
from models.user import User
from models.enums import SubmissionLogEvent, CourseVisibility
from models.log_tables import SubmissionLog as Log
from models.log_tables import RoleLog, CourseLog, ErrorLog, AccessLog, AssignmentLog, SubmissionLog


def _redirect_to_login():
    if current_app.config.get('PREFERRED_LOGIN_URL'):
        return redirect(current_app.config['PREFERRED_LOGIN_URL'])
    return redirect(url_for('security.login', next=request.url))


def login_required(f):
    """
    Require a real (non-anonymous) account. Every visitor gets an anonymous user row
    (see auth.make_user_anonymous), so checking `g.user is None` alone lets anyone through.
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if g.user is None or getattr(g.user, 'anonymous', False):
            return _redirect_to_login()
        return f(*args, **kwargs)

    return decorated_function


def login_or_anonymous_required(f):
    """
    Allow anonymous (try-it-out) users as well as real accounts; only rejects a missing user.
    Use for editor routes that anonymous visitors legitimately exercise (saving code, logging events).
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if g.user is None:
            return _redirect_to_login()
        return f(*args, **kwargs)

    return decorated_function


def abort_with_failure(code, message, as_html=False):
    if as_html:
        # Werkzeug has no exception for 2xx codes, so HTML failures are always Forbidden pages
        abort(403, message)
    else:
        abort(make_response(jsonify(success=False, message=message), code))


def require_course_instructor(user, course_id, addendum="", as_html=False, allow_fork=False):
    if not user.is_instructor(course_id):
        if allow_fork and user.is_instructor(allow_fork):
            message = ('You are not an instructor (course ID {}), but you can fork this question for your own course'
                       ' (course ID {}).').format(course_id, allow_fork)
            abort(make_response(jsonify(success=False, message=message, forkable=True), 200))
        if user.anonymous:
            abort_with_failure(200, f'You are not logged in. Please log in as an instructor (course ID {course_id}). {addendum}', as_html)
        else:
            abort_with_failure(200, f'You are not an instructor (course ID {course_id}). {addendum}', as_html)
    return True


def require_course_grader(user, course_id, allow_fork=False):
    if not user.is_grader(course_id):
        if allow_fork and user.is_grader(allow_fork):
            message = ('You are not a grader (course ID {}), but you can fork this question for your own course'
                       ' (course ID {}).').format(course_id, allow_fork)
            abort(make_response(jsonify(success=False, message=message, forkable=True), 200))
            return False
        message = 'You are not a grader (course ID {}).'.format(course_id)
        abort(make_response(jsonify(success=False, message=message, forkable=False), 200))
        return False
    return True

def require_assignment_grader(user, assignment, course_id):
    """
    Require that the user can grade `course_id` AND has a legitimate claim on `assignment` from that
    course: the course owns the assignment, the user grades the course that owns it, or the course
    actually uses it (has submissions for it). Otherwise a grader of any course could pull another
    course's submissions just by naming an assignment id.
    """
    require_course_grader(user, course_id)
    course_id = maybe_int(course_id)
    if user.is_grader(assignment.course_id) or assignment.is_used_in_course(course_id):
        return True
    message = 'Assignment {} does not belong to course {}.'.format(assignment.id, course_id)
    abort(make_response(jsonify(success=False, message=message, forkable=False), 200))
    return False


def require_assignment_forkable(user, assignment):
    """
    Forking copies instructor-only content (grading scripts, hidden exams), so the caller must be
    allowed to see the SOURCE: admin, grader or adopter of its course, or the assignment is public.
    """
    if assignment.public or user.is_admin():
        return True
    return require_course_adopter(user, assignment.course_id)


def require_group_in_course(user, group_id, course_id):
    """
    An assignment may only be placed into a group that belongs to the course being edited, or to a
    course the caller instructs. Returns the group.
    """
    group = AssignmentGroup.by_id(group_id)
    check_resource_exists(group, "AssignmentGroup", group_id)
    if group.course_id != maybe_int(course_id) and not user.is_instructor(group.course_id) and not user.is_admin():
        message = 'Assignment group {} does not belong to course {}.'.format(group.id, course_id)
        abort(make_response(jsonify(success=False, message=message), 200))
    return group


def require_course_adopter(user, course_id):
    if user.is_grader(course_id):
        return True
    if not user.is_adopter(course_id):
        message = 'You are not an adopter (course ID {}).'.format(course_id)
        abort(make_response(jsonify(success=False, message=message), 200))
        return False
    return True


def require_admin(user):
    if not user.is_admin():
        message = "You are not an administrator."
        abort(make_response(jsonify(success=False, message=message), 200))
    return True


def check_course_unlocked(course):
    if course.locked:
        message = "This course is locked. Please unlock the course before editing."
        abort(make_response(jsonify(success=False, message=message), 200))
    return True


def check_resource_exists(resource, kind, id):
    if not resource:
        message = "The specified resource does not exist ({} {})".format(kind, id)
        abort(make_response(jsonify(success=False, message=message), 200))
        return False
    return True


def require_request_parameters(*parameters):
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            for parameter in parameters:
                if parameter not in request.values:
                    return jsonify(success=False, message="Missing parameter: " + parameter)
            return f(*args, **kwargs)

        return decorated_function

    return decorator


def parse_lookup_code():
    '''
    The best "Security through Obscurity" possible! This obfuscates the url a little so that
    students don't simply increment the value and move to the weird problems.

    > process_lookup_code(AGI_NNYYYY)
    > process_lookup_code(AGI_011)
    1
    > process_lookup_code(AGI_2278129)
    12

    :return: int or None
    '''
    lookup = request.values.get('lookup', None)
    if lookup is None:
        return None
    try:
        _, code = lookup.split("_")
        start, length = map(int, code[:2])
        assignment_group_id = int(code[2 + start:2 + start + length])
    except ValueError:
        message = "I didn't understand the lookup code: " + lookup
        abort(make_response(jsonify(success=False, message=message), 400))
    return assignment_group_id


SINGLE_ARG_HACK_PARAMS = (('embed', maybe_bool),
                          ('grade_mode', str),
                          ('assignment_group_id', maybe_int),
                          ('course_id', maybe_int),
                          ('user_id', maybe_int))


def handle_single_arg_hack():
    """
    Horrifying solution to Canvas not correctly handling param bodies in oauth requests.

    Real solution is to use this: https://canvas.instructure.com/doc/api/file.tools_xml.html#do-not-move-lti-query-params-to-post-body

    :return:
    """
    single_arg_hack = request.values.get('single_arg_hack', None)
    if single_arg_hack is None:
        return None
    single_arg_hack = single_arg_hack.split("-")
    for key, value in zip(SINGLE_ARG_HACK_PARAMS, single_arg_hack):
        yield value


def may_create_submission(user, course_id, target_user_id=None):
    """
    Whether a NEW submission may be created for `target_user_id` (default: the caller) in `course_id`.

    Loading an existing submission is never gated here; this only decides who may "join" a course by
    submitting to it. Creation is allowed when the target user already has a role in the course, when
    the caller's LTI context is that course (the verified launch that enrols them has just run, so this
    also covers launches whose role string we could not map), when the course is public or is the
    default scratch course, or when the caller is an admin. Otherwise anyone could plant submissions
    (and their own assignments' content) into any course just by naming its id.
    """
    course_id = maybe_int(course_id)
    if user is None or course_id is None:
        return False
    if user.is_admin():
        return True
    if target_user_id in (None, user.id):
        target = user
    else:
        target = User.by_id(target_user_id)
        if target is None:
            return False
    if target.in_course(course_id):
        return True
    if target.id != user.id:
        return False
    lti_course = g.get('course', None)
    if lti_course is not None and lti_course.id == course_id:
        return True
    course = Course.by_id(course_id)
    if course is None:
        return False
    return course.visibility == CourseVisibility.PUBLIC or course.url == 'default'


def parse_assignment_load(assignment_id_or_url=None):
    # Single Arg Hack
    #handle_single_arg_hack()
    # Lookup Code
    assignment_group_id = parse_lookup_code()
    # Assignment Group ID
    if assignment_group_id is None:
        assignment_group_id = maybe_int(request.args.get('assignment_group_id'))
    # Exact "url" code for group
    if assignment_group_id is None:
        assignment_group_id = AssignmentGroup.id_by_url(request.args.get('assignment_group_url'))
    # Assignment ID
    current_assignment_id = maybe_int(request.args.get('assignment_id', assignment_id_or_url))
    # Exact "url" code for assignment
    if current_assignment_id is None:
        current_assignment_id = Assignment.id_by_url(request.args.get('assignment_url', assignment_id_or_url))
    # User
    user = g.get('user', None)
    user_id = user.id if user else None
    # Course ID of the user
    course_id = maybe_int(request.args.get('course_id', None))
    if course_id is None:
        course_id = int(g.course.id) if 'course' in g and g.course else None
    # LTI submission URL and dates: only trust them on a launch whose OAuth signature was verified in
    # this request (auth.try_lti_login_initial). Anyone can post these form fields to the plain
    # editor route, and they control the grade passback target and the late/lock windows.
    lti_launch = bool(g.get('lti_launch_verified', False))
    new_submission_url = request.form.get('lis_result_sourcedid', None) if lti_launch else None
    new_due_date = from_canvas_isotime(request.form.get('custom_canvas_assignment_dueat', None)) if lti_launch else None
    new_lock_date = from_canvas_isotime(request.form.get('custom_canvas_assignment_lockat', None)) if lti_launch else None
    # Embedded?
    embed = request.values.get('embed', 'false').lower() == 'true'
    # Get group
    assignment_group = AssignmentGroup.by_id(assignment_group_id)
    # Get assignments
    if assignment_group is None:
        assignment = Assignment.by_id(current_assignment_id)
        if assignment:
            assignments = [assignment]
        else:
            assignments = []
    else:
        assignments = assignment_group.get_assignments()
    # No existing assignment, let's get the default
    if not assignments:
        # And no known course? Better get the default course!
        if course_id is None:
            course = Course.get_default()
            course_id = course.id
        else:
            course = Course.by_id(course_id) or Course.get_default()
        default_assignment = course.get_default_assignment() if course else None
        if default_assignment:
            assignments = [default_assignment]
        else:
            assignments = []
    # Potentially adjust assignment_id
    if current_assignment_id is None and assignments and assignments[0]:
        current_assignment_id = assignments[0].id
    # Get submissions
    if user and user.anonymous and course_id is None:
        course_id = Course.get_default().id
    if user_id is None or course_id is None:
        submissions = []
        submission_assignment_map = {}
    else:
        # Existing submissions always load; NEW ones are only created when the user may join the course
        existing = [assignment.load(user_id, course_id) for assignment in assignments]
        if all(existing) or may_create_submission(user, course_id):
            submissions = [assignment.load_or_new_submission(user_id, course_id, new_submission_url, assignment_group_id,
                                                             new_due_date, new_lock_date)
                           for assignment in assignments]
        else:
            submissions = []
        submission_assignment_map = {submission.assignment_id: submission for submission in submissions}
    # Determine the users' role in relation to this information
    role = user.determine_role(assignments, submissions) if user else "anonymous"
    if role in ("student", "anonymous"):
        # Check for any IP locked assignments
        for assignment in assignments:
            if not assignment.is_allowed(request.remote_addr):
                if submissions:
                    submission = submission_assignment_map.get(assignment.id, None)
                    if submission:
                        make_log_entry(submission.id, submission.version, assignment.id, assignment.version,
                                       course_id, user_id, SubmissionLogEvent.ERROR,
                                       message=str(request.remote_addr))
                return abort(403,
                             "You cannot access this assignment from your current location: " + request.remote_addr)
    # Check passcode
    passcode_protected = False
    for assignment in assignments:
        if assignment.has_passcode() and not passcode_protected:
            passcode_protected = True
    # Check for studio flag
    use_studio = maybe_bool(request.values.get('use_studio', None))
    # Combine the submissions and assignments
    group = list(zip(assignments, submissions))
    # Get session start time
    session_start_time = None if not submissions else submissions[0].get_session_start_time()
    # Okay we've got everything
    return dict(group=group,
                assignment_group=assignment_group,
                assignments=assignments,
                submissions=submissions,
                assignment_group_id=assignment_group_id,
                current_assignment_id=current_assignment_id,
                user=user,
                user_id=user_id,
                role=role,
                course_id=course_id,
                embed=embed,
                session_start_time=session_start_time,
                passcode_protected=passcode_protected,
                use_studio=use_studio)


def check_permissions(viewer, submission, assignment, ip_address):
    """
    :param viewer:
    :param submission:
    :param assignment:
    :return:
    """
    role = viewer.determine_role([assignment], [submission]) if viewer else "anonymous"
    print(role, viewer, submission, assignment, ip_address)
    if role in ('owner', 'grader'):
        return True
    if role in ("student", "anonymous"):
        # Check for any IP locked assignments
        if not assignment.is_allowed(ip_address):
            make_log_entry(submission.id, submission.version, assignment.id, assignment.version,
                           submission.course_id, submission.user_id, SubmissionLogEvent.ERROR,
                           message=json.dumps({"ip_address": ip_address, "viewer_id": viewer.id if viewer else None}))
            return False
    return submission.user_id == viewer.id if viewer else False


def get_lti_property(property_name, default_value=None):
    # TODO: Deprecate this!
    if property_name in request.form:
        return request.form[property_name]
    elif property_name in session:
        return session[property_name]
    elif default_value is not None:
        return default_value
    raise KeyError('Property {0} not found in form or session.'.format(property_name))


def get_course_id(okay_if_failure=False, course_id=None):
    if course_id is not None:
        return course_id
    course_id = request.values.get('course_id')
    if course_id is None:
        if 'course' in g and g.course:
            return g.course.id
        if not okay_if_failure:
            ajax_failure("No course_id given and not logged into a course.")
    course_id = maybe_int(course_id)
    if course_id is None:
        if not okay_if_failure:
            ajax_failure("Course ID was not an integer")
    return course_id


def get_assignment_id(f):
    @wraps(f)
    def decorated_function(course_id, *args, **kwargs):
        assignment_id = request.values.get('assignment_id', None)
        # there is an assignment_id
        if assignment_id is None:
            return jsonify(success=False, message="No assignment id")
        # It's an integer value
        try:
            assignment_id = int(assignment_id)
        except ValueError:
            return jsonify(success=False, message="Assignment ID wasn't an integer")
        if not Assignment.is_in_course(assignment_id, course_id):
            return jsonify(success=False, message="That assignment id does not belong to that course.")
        return f(*args, course_id=course_id, **kwargs)

    return decorated_function


def get_select_menu_link(id, title, is_embedded, is_group):
    launch_type = 'iframe' if is_embedded else 'lti_launch_url'
    base_url = url_quote(url_for('assignments.load',
                                 assignment_group_id=id,
                                 _external=True,
                                 _scheme="https",
                                 embed=is_embedded))
    return '&'.join([base_url,
                     "return_type=" + launch_type,
                     "title=" + url_quote(title),
                     "text=BlockPy%20Exercise",
                     "width=100%25",
                     "height=600"])


def ajax_failure(message, error_code=200):
    return abort(make_response(jsonify(success=False, message=message, ip=request.remote_addr), error_code))

def ajax_success(original_data):
    original_data['ip'] = request.remote_addr
    original_data['success'] = True
    return jsonify(original_data)


def client_time_fields():
    """ (timestamp, timezone) as reported by the client in the request, or ("", "") outside one. """
    if not has_request_context():
        return "", ""
    return request.values.get('timestamp', ''), request.values.get('timezone', '')


def make_log_entry(submission_id, submission_version, assignment_id, assignment_version, course_id, user_id,
                   event_type, file_path='', category='', label='', message='', timestamp=None, timezone=None, extended=False):
    # Fall back to the client's reported time only inside a request; background tasks have none
    client_timestamp, client_timezone = client_time_fields()
    timestamp = client_timestamp if timestamp is None else timestamp
    timezone = client_timezone if timezone is None else timezone
    return Log.new(submission_id, submission_version, assignment_id, assignment_version, course_id, user_id,
                   event_type, file_path, category, label, message, timestamp, timezone, extended)


def get_assignments_in_groups(course):
    grouped_assignments = natsorted(course.get_submitted_assignments_grouped(),
                                    key=lambda r: (
                                        r.AssignmentGroup.name if r.AssignmentGroup is not None else "~~~~~~~~",
                                        r.Assignment.title()))
    assignments_by_group = {}
    group_headers = {}
    groups = []
    for row in grouped_assignments:
        group_name = row.AssignmentGroup.name if row.AssignmentGroup is not None else None
        assignments_by_group.setdefault(group_name, []).append(row.Assignment)
        group_headers[row.Assignment] = row.AssignmentGroup
        if row.AssignmentGroup not in groups:
            groups.append(row.AssignmentGroup)
    # Horrifying hack to move Ungrouped elements to end
    assignments_by_group[None] = assignments_by_group.pop(None, None)
    return grouped_assignments, assignments_by_group, group_headers, groups


def admin_required(f):
    """
    Deprecated.

    :param f:
    :return:
    """

    @wraps(f)
    def decorated_function(*args, **kwargs):
        if g.user is None:
            return redirect(url_for('security.login', next=request.url))
        if not g.user.is_admin():
            flash("This portion of the site is only for administrators.")
            return redirect(url_for('courses.index'))
        return f(*args, **kwargs)

    return decorated_function


def instructor_required(f):
    """
    Deprecated

    :param f:
    :return:
    """

    @wraps(f)
    def decorated_function(*args, **kwargs):
        if g.user is None:
            return redirect(url_for('security.login', next=request.url))
        if not g.user.is_instructor():
            flash("This portion of the site is only for instructors.")
            return redirect(url_for('courses.index'))
        return f(*args, **kwargs)

    return decorated_function