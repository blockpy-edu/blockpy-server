# Built-in imports
import re
import os
from urllib.parse import quote as url_quote
from functools import wraps

from html.parser import HTMLParser

from urllib.parse import unquote_plus, urlparse, parse_qsl, quote_plus, urlencode

# Pygments, for reporting nicely formatted Python snippets

# Flask imports
from flask import g, request, redirect, url_for, make_response
from flask import flash, session, jsonify, abort
import flask_security

from controllers.pylti.flask import LTI, LTIException

from main import app

from models.user import User
from models.course import Course
from models.assignment import Assignment
from models.assignment_group import AssignmentGroup
from models.log import Log


def admin_required(f):
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
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if g.user is None:
            return redirect(url_for('security.login', next=request.url))
        if not g.user.is_instructor():
            flash("This portion of the site is only for instructors.")
            return redirect(url_for('courses.index'))
        return f(*args, **kwargs)

    return decorated_function


def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if g.user is None:
            if app.config['PREFERRED_LOGIN']:
                return redirect(app.config['PREFERRED_LOGIN'])
            else:
                return redirect(url_for('security.login', next=request.url))
        return f(*args, **kwargs)

    return decorated_function


def require_course_instructor(user, course_id, addendum=""):
    if not user.is_instructor(course_id):
        message = f'You are not an instructor (course ID {course_id}). {addendum}'
        abort(make_response(jsonify(success=False, message=message), 200))
        return False
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
        return None
    return assignment_group_id


def maybe_int(value):
    try:
        return int(value)
    except ValueError:
        return None
    except TypeError:
        return None


def maybe_float(value):
    try:
        return float(value)
    except ValueError:
        return None
    except TypeError:
        return None


def maybe_bool(value):
    if value is None:
        return False
    elif value.lower() == "true":
        return True
    return False


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
    # LTI submission URL
    new_submission_url = request.form.get('lis_result_sourcedid', None)
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
            course = g.course
        default_assignment = course.get_default_assignment()
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
    else:
        submissions = [assignment.load_or_new_submission(user_id, course_id, new_submission_url, assignment_group_id)
                       for assignment in assignments]
    # Determine the users' role in relation to this information
    role = user.determine_role(assignments, submissions) if user else "anonymous"
    if role in ("student", "anonymous"):
        # Check for any IP locked assignments
        for assignment in assignments:
            if not assignment.is_allowed(request.remote_addr):
                make_log_entry(assignment.id, assignment.version, course_id, user_id, "X-Access.Denied",
                               message=str(request.remote_addr))
                return abort(403,
                             "You cannot access this assignment from your current location: " + request.remote_addr)
    # Check passcode
    passcode_protected = False
    for assignment in assignments:
        if assignment.has_passcode() and not passcode_protected:
            passcode_protected = True
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
                passcode_protected=passcode_protected)


class MLStripper(HTMLParser):
    def __init__(self):
        self.reset()
        self.fed = []

    def handle_data(self, d):
        self.fed.append(d)

    def get_data(self):
        return ''.join(self.fed)


def strip_tags(html):
    s = MLStripper()
    s.feed(html)
    return s.get_data()


def get_lti_property(property_name, default_value=None):
    if property_name in request.form:
        return request.form[property_name]
    elif property_name in session:
        return session[property_name]
    elif default_value is not None:
        return default_value
    raise KeyError('Property {0} not found in form or session.'.format(property_name))


def get_course_id(okay_if_failure=False):
    course_id = request.values.get('course_id')
    if course_id is None:
        if 'course' in g:
            return g.course.id
        if not okay_if_failure:
            ajax_failure("No course_id given and not logged into a course.")
    course_id = maybe_int(course_id)
    if course_id is None:
        if not okay_if_failure:
            ajax_failure("Course ID was not an integer")
    return course_id


class UnknownUser:
    def __bool__(self):
        return False

    def __init__(self):
        self.id = None

    def is_grader(self, *args):
        return False

    def is_instructor(self, *args):
        return False

    def in_course(self, course_id):
        return False

    def encode_json(self):
        return {"id": None}


UNKNOWN_USER = UnknownUser()


def get_user():
    """

    :return: models.user.User
    """
    if 'user' in g and g.user:
        return g.user, g.user.id
    return UNKNOWN_USER, None


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


def normalize_url(url):
    url = re.sub(r'http://', r'', url)
    url = re.sub(r'https://', r'', url)
    url = re.sub(r'file://', r'', url)
    parts = urlparse(url, scheme='')
    _query = urlencode(sorted(set(parse_qsl(parts.query))))
    _path = unquote_plus(parts.path)
    parts = parts._replace(query=_query, path=_path, scheme='', fragment='')
    url = "/".join((parts.netloc, _path, _query))
    return quote_plus(url)


def ensure_dirs(path):
    try:
        os.makedirs(path)
    except OSError as e:
        if not os.path.isdir(path):
            app.logger.warning(e.args + (path,))


def get_select_menu_link(id, title, is_embedded, is_group):
    launch_type = 'iframe' if is_embedded else 'lti_launch_url'
    base_url = url_quote(url_for('assignments.load',
                                 assignment_group_id=id,
                                 _external=True,
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


def make_log_entry(assignment_id, assignment_version, course_id, user_id,
                   event_type, file_path='', category='', label='', message='', timestamp=None, timezone=None):
    timestamp = request.values.get('timestamp') if timestamp is None else timestamp
    timezone = request.values.get('timezone') if timezone is None else timezone
    return Log.new(assignment_id, assignment_version, course_id, user_id,
                   event_type, file_path, category, label, message, timestamp, timezone)


def compare_string_equality(submitted, expected) -> bool:
    if not submitted and bool(expected):
        return False
    submitted = str(submitted).strip()
    if isinstance(expected, str):
        return submitted == expected
    else:
        # Assume list of possible answers
        return submitted in expected
