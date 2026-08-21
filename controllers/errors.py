from flask import g, request, redirect, url_for, make_response, current_app, render_template
from flask import flash, session, jsonify, abort
import controllers.pylti.common


def handle_lti_exception(error):
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