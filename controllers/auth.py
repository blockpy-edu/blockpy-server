"""
Authentication is handled here, and loading various data about the user.

Variables:
    g.user: The current user (possibly anonymous).
    g.course: The current course, or None if no course is selected.
    g.roles: The current roles for the current user in the current course.
    g.lti: The LTI object, if the user is logged in via LTI.
    g.access_token: The JWT access token for the current user, if one was created during LTI login.
"""

import uuid
import traceback
import json
from functools import wraps

from quart import current_app, g, jsonify, make_response, request, abort
from werkzeug.datastructures import ImmutableMultiDict
from werkzeug.wrappers import Request
from flask_jwt_extended import create_access_token, get_jwt_identity, verify_jwt_in_request, \
    set_access_cookies, get_jwt
from flask_jwt_extended.jwt_manager import ExpiredSignatureError
from flask_jwt_extended.exceptions import NoAuthorizationError
from flask_rebar import RequestSchema
from marshmallow import fields

from quart import session, g, request, flash, render_template
from flask_security.core import current_user
import flask_security
from controllers.pylti.flask import LTI_SESSION_KEY, LTI, LTIException
from flask_jwt_extended import create_access_token

from controllers.services import ValidUserPermissionLayer, InvalidUserPermissionLayer
from mailing import mail, Message
from controllers.setup import registry, rebar
from models.enums import clean_role
from models.user import User
from models.course import Course





def notify_admin():
    msg = Message(
        'A rascal has attempted to access the system!',
        recipients=current_app.config['SYS_ADMINS'],
        sender=current_app.config['SECURITY_EMAIL_SENDER'],
        body=f'A rascal has attempted to access the system. '
             f'I stopped them before they could do anything. '
             f'Here are their details:\n'
                f'User ID: {g.user.id}\n'
                f'User Name: {g.user.name()}\n'
                f'User Email: {g.user.email}\n'
                f'User IP: {request.remote_addr}\n'
                f'User Agent: {request.user_agent}\n'
    )
    mail.send(msg)


def move_token_to_header(func):
    """
    Decorator to move the access_token from the body to the header.
    This is necessary for POST bodies made via forms, which can have a token in the body
    but have no mechanism to move the token to the header (which is one of the locations
    that Flask-JWT-Extended looks for the token, unlike the form body).
    """
    @wraps(func)
    def wrapper(*args, **kwargs):
        if 'access_token' in request.form:
            # Can't modify the header directly, have to make a copy
            modified_headers = dict(request.headers)
            modified_headers['Authorization'] = "Bearer " + request.form['access_token']
            request.headers = ImmutableMultiDict(modified_headers)
        return func(*args, **kwargs)
    return wrapper

def check_banned_user():
    user = getattr(g, 'user', None)
    if user and user.banned:
        notify_admin()
        abort(403, description="You are banned. Stop trying. The administrator has been notified.")

@move_token_to_header
def login_user_if_able():
    """
    This is the main function for handling login. It checks several possible ways that the user
    might be logging in, or might already be logged in. It then sets the g.user variable to the
    appropriate user object, or an anonymous user if no user is logged in.

    Some different flows:
        1) User logs in via Flask-Security
            User is looked up and logged in (behind the scenes).
            Cookie will be set, no problem. Future sessions will be (2).
            No LTI session will be available via this method.
        2) User has a cookie set by Flask-Security
            User looked up and logged in automatically. Future sessions will be (2).
        3) User logs in via LTI
            The LTI authorization happens via the active Request object.
            User is looked up or created by the LTI.
            Session will be given an LTI setup.
            A JWT token is created and sent back to the user.
            Future sessions will be (4) if cookies were enabled, or (5)/(6) if not.
        4) User has a cookie set by LTI
            The session should have the necessary LTI settings.
            An LTI object is created and attached to g.lti, just like in (3).
            User is looked up using the session data.
        5) User has a JWT token, but is not doing a fresh launch. They are just accessing content on the same page.
            The JWT is parsed and verified.
            The user is looked up using the JWT.
            An LTI object is created and attached to g.lti, without needing to do the verify.
        6) User has a JWT token, but is doing a fresh launch. They are on a new page.
            The JWT is parsed and verified.
            An LTI verify request is made, using the stored data.


    The LTI object is responsible for

    """
    g.safely = InvalidUserPermissionLayer()
    # Invalid URL
    if not request.endpoint:
        return
    # Let flask-security handle any login attempts on its own
    if request.endpoint.startswith('security.login'):
        # If the user is known, then they can be logged in
        if current_user.is_authenticated:
            return load_logged_in_user()
        else:
            # During the login process, we will let the user be anonymous
            return make_user_anonymous(request.remote_addr)
    # If LTI parameters are available, let's try setting that up
    if is_lti_launch_request(request):
        return try_lti_login_initial()
    # If a stored LTI session was provided, we can try that instead
    # Deprecated: This is not a good idea, most likely, so not doing it unless critical.
    # if is_stored_lti_launch_request(request):
    #     return try_lti_login_stored()
    # If Flask-security logged them in as a non-anonymous user, we don't need a JWT
    if current_user.is_authenticated and not current_user.anonymous:
        return load_logged_in_user()
    # Try to get the user from the JWT (cookie, header, or querystring)
    if try_jwt_login():
        return
    # Check if they are already logged in as an anonymous user:
    if current_user.is_authenticated:
        return load_logged_in_user()
    # If all else fails, we have to create an anonymous user
    return make_user_anonymous(request.remote_addr)


def get_consumer_secrets(app=None):
    """
    Gets the consumer secrets from the app config.
    """
    if app is None:
        app = current_app
    return {
        app.config.get("CONSUMER_KEY"): {
            "secret": app.config.get('CONSUMER_KEY_SECRET', ""),
            "cert": app.config.get('CONSUMER_KEY_PEM_FILE', ""),
            "certkey": app.config.get('CONSUMER_KEY_CERT', ""),
        }
    }


def load_logged_in_user():
    """
    If a current_user is available, then logs them in as the current user.
    Also checks for session variables for LTI that can be used to update g.course and g.roles.
    :return:
    """
    g.user = current_user
    g.safely = ValidUserPermissionLayer(g.user)
    if session.get(LTI_SESSION_KEY, False):
        g.lti = LTI(get_consumer_secrets())
    if 'lti_course_id' in session and g.user:
        g.course = Course.by_id(session['lti_course_id'])
        g.roles = g.user.get_course_roles(g.course.id)
    else:
        g.course = None
        g.roles = []


def get_user() -> (User, int):
    """
    Returns the current user and their id, or aborts with a 401 error if there is no current user.
    """
    if 'user' in g and g.user:
        return g.user, g.user.id
    abort(401, "User not logged in, operation cannot be completed")


def try_lti_login_initial():
    g.lti = LTI(get_consumer_secrets())
    g.lti.verify_request()
    # TODO: Provide any other LTI information that we need
    load_lti_user()
    g.access_token = create_user_token()


def load_lti_user():
    """
    Looks for whether we need to create a new user/course/roles, or create them from the newly provided data.
    This is assumed to happen at the end of an LTI launch.

    Some fields may be out of date, so if they are found in the request form, they will be updated.
    Those fields will not be updated if they are found in the session.
    :return:
    """
    # 1) check whether the user needs to be updated
    old_user = g.user if 'user' in g else None
    g.user = User.from_lti("canvas",
                           session["pylti_user_id"],
                           session.get("lis_person_contact_email_primary", ""),
                           session.get("lis_person_name_given", "Canvas"),
                           session.get("lis_person_name_family", "User"))
    g.safely = ValidUserPermissionLayer(g.user)
    # 2) Check the course
    new_outcome_url = request.form.get('lis_outcome_service_url', "")
    g.course = Course.from_lti("canvas",
                               session["context_id"],
                               session.get("context_title", ""),
                               g.user.id,
                               # TODO: Make this use the request data, not the session!!!
                               new_outcome_url)
    session['lti_course_id'] = g.course.id
    # 3) Check the user's roles
    g.roles = session["roles"].split(",") if "roles" in session else []
    g.roles = [clean_role(role)[0] for role in g.roles]
    g.user.update_roles(g.roles, g.course.id)
    # 4) Generally update the LTI status
    session['is_lti_active'] = True
    # Keep track of the chosen oauth_consumer_key
    g.oauth_consumer_key = request.form.get('oauth_consumer_key', "")
    # 5) If the user changed, then log them in again
    handle_login_change(old_user)


def create_user_token() -> dict:
    """
    Creates a JWT token for the current user.
    """
    return create_access_token(g.user.id, additional_claims={
        'is_lti_active': True,
        'course_id': g.course.id,
        'roles': g.roles,
        'oauth_consumer_key': g.oauth_consumer_key,
        # LTI Restore Data
        # Deprecated: This is probably not a good idea, so not doing this.
        # 'url': request.url,
        # 'method': request.method,
        # If these get too big, I found that gzip/zlib compression works well
        # 'headers': json.dumps(dict(request.headers.items())),
        # 'params': json.dumps(request.form.to_dict())
    })


def handle_login_change(old_user):
    if old_user != g.user:
        flask_security.utils.logout_user()
        flask_security.utils.login_user(g.user, remember=True)
    elif not old_user:
        flask_security.utils.login_user(g.user, remember=True)


def load_jwt_user(user_id, claims):
    """
    Loads the user from the JWT token, and updates the LTI session data.
    """
    old_user = g.user if 'user' in g else None
    g.user = User.by_id(user_id)
    g.safely = ValidUserPermissionLayer(g.user)
    g.course = Course.by_id(claims['course_id'])
    g.roles = claims['roles']
    session['lti_course_id'] = g.course.id
    session['is_lti_active'] = True
    session['oauth_consumer_key'] = g.oauth_consumer_key = claims['oauth_consumer_key']
    handle_login_change(old_user)


def is_lti_launch_request(request) -> bool:
    """
    Determines if the request is an LTI launch request. Does NOT check that the request
    is a *valid* LTI launch request, just that it has the potential to be one.
    """
    return request.method == 'POST' and request.form.get('lti_message_type') == 'basic-lti-launch-request'


def is_stored_lti_launch_request(request) -> bool:
    """
    Determines if the request was a stored LTI launch request. Does NOT check that the request
    is a *valid* LTI launch request, just that it has the potential to be one.
    This is an unofficial usage of the LTI standard, where we store the LTI launch parameters
    in a JWT token, and then send that token to the server via a POST request. This is used
    to "refresh" a user's LTI session, since the LTI session is not persistent in some cases on the frontend.
    """
    return request.method == 'POST' and request.form.get('lti_message_type') == 'stored-lti-launch-request'


def try_jwt_login():
    # Patch cookie into header if found on the form body
    try:
        verify_jwt_in_request()
        user_id = get_jwt_identity()
        load_jwt_user(user_id, get_jwt())
        g.access_token = create_user_token()
        return True
    # TODO: Handle expiration more intelligently, letting the user know that they need to refresh
    except NoAuthorizationError as e:
        return False
    except ExpiredSignatureError as e:
        abort(401, "JWT token expired, please refresh page")


def try_lti_login_stored():
    """ Deprecated backup strategy for "restoring" an LTI login from the access token. """
    try:
        verify_jwt_in_request()
        user_id = get_jwt_identity()
        g.lti = LTI(get_consumer_secrets(), use_request=get_jwt())
        load_jwt_user(user_id, get_jwt())
        g.access_token = create_user_token()
        return True
    # TODO: Handle expiration more intelligently, letting the user know that they need to refresh
    except NoAuthorizationError as e:
        return False
    except ExpiredSignatureError as e:
        abort(401, "JWT token expired, please refresh page")


"""
def old_authentication():
    # If new LTI launch or LTI is in session, create LTI object
    try:
        g.lti = get_or_start_lti()
    except LTIException as lti_exception:
        app.logger.error(f"LTI Error: {lti_exception}")
        if app.config['DEBUG']:
            flash(f"LTI Error: {lti_exception}")
            lti_exception = ''.join(traceback.TracebackException.from_exception(lti_exception).format())
            return render_template('lti/lti_error.html', message=f"Error during LTI: <pre>{lti_exception}</pre>")
        else:
            return render_template('lti/lti_error.html', message=f"Error during LTI. Please consult with Dr. Bart.")
    # Get user from Flask-Login, if available
    if current_user.is_authenticated:
        g.user = current_user
    else:
        g.user = None
    # Get user data from LTI, if that's possible
    if g.lti is not None:
        load_lti_user()
    # Otherwise maybe we have some cached settings?
    else:
        load_nonlti_user()
    # Get anonymous user, if all else fails
    if g.user is None:
        if not request.endpoint or not request.endpoint.startswith('security.'):
            pass
"""


def make_user_anonymous(ip_address=None):
    # Have we already created an anonymous user for this user?
    if 'uid' in session:
        uid = session['uid']
        g.user = User.find_anonymous_user(uid)
        if g.user is not None:
            g.safely = ValidUserPermissionLayer(g.user)
    # If not, then make them a new one
    else:
        uid = uuid.uuid4().hex
        session['uid'] = uid
        g.user = User.make_anonymous_user(uid, ip_address)
        if g.user is not None:
            g.safely = ValidUserPermissionLayer(g.user)


def setup_authentication(app):
    """
    Sets up the authentication system for the app.
    This includes loading the user before each request.
    """
    app.before_request(login_user_if_able)
    app.before_request(check_banned_user)