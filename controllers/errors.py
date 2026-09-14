import traceback

from flask import g, request, current_app, render_template, jsonify
import controllers.pylti.common


def record_error(original):
    """
    Record an unhandled request error in the database: an access_log row for the who
    and where, and an error_log row for the what. See docs/audit-logs.md.

    This must never raise. The file log configured in interaction_logger.py stays the
    source of truth and the database is a convenience view, so any failure here (most
    likely the database itself being the thing that failed) is logged and swallowed.
    """
    try:
        from models import db
        from models.log_tables import AccessLog, ErrorLog
        from controllers.helpers import client_time_fields
        # The session that raised is almost always in a failed transaction
        db.session.rollback()
        user = g.get('user')
        if user is None or user.id is None:
            # Failed before login resolved a user; access_log.subject_id is NOT NULL
            return None
        client_timestamp, client_timezone = client_time_fields()
        access = AccessLog.new(user.id, request.path[:255], request.method[:255],
                               (request.remote_addr or "")[:255], client_timestamp, client_timezone)
        formatted = "".join(traceback.format_exception(type(original), original, original.__traceback__))
        return ErrorLog.new(access.id, type(original).__name__[:255], str(original)[:2000], formatted)
    except Exception:
        current_app.logger.exception("Could not record the error in the database")
        return None


def handle_lti_exception(error):
    record_error(error)
    if "Expired timestamp" in str(error):
        return render_template('lti/lti_error.html', message=
            "Your session has expired. Please close this window and try again with a fresh request.\n<br>\nThe exact error was: "+str(error)
        ), 500
    return render_template('lti/lti_error.html', message=
        "LTI Exception: "+str(error)
    ), 500


def handle_401(error):
    return render_template('lti/forbidden.html',
                           message= "Unauthorized Error: "+str(error)+"\n<br>Please reload the page and try again.",
                           reason='Unauthorized'
    ), 401


def handle_500(error):
    original = getattr(error, "original_exception", error)
    current_app.logger.error("Unhandled exception on %s %s",
                             request.method, request.path, exc_info=original)
    record_error(original)
    message = (str(original) if current_app.config.get("DEBUG")
               else "An unexpected error occurred. The administrators have been notified.")
    # blockpy.py is almost entirely AJAX; honor the {success, message} contract
    if request.accept_mimetypes.accept_json and not request.accept_mimetypes.accept_html:
        return jsonify(success=False, message=message), 500
    return render_template("errors/generic_error.html", message=message), 500


def handle_403(error):
    return render_template('errors/forbidden.html',
                           message= str(error), reason='Forbidden'
    ), 403

def register_error_handlers(app):
    app.register_error_handler(controllers.pylti.common.LTIException, handle_lti_exception)
    app.register_error_handler(401, handle_401)
    app.register_error_handler(403, handle_403)
    app.register_error_handler(500, handle_500)
