from quart import g, request, redirect, url_for, make_response, current_app, render_template
from quart import flash, session, jsonify, abort
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


def handle_403(error):
    return render_template('errors/forbidden.html',
                           message= str(error), reason='Forbidden'
    ), 403

def register_error_handlers(app):
    app.register_error_handler(controllers.pylti.common.LTIException, handle_lti_exception)
    app.register_error_handler(401, handle_401)
    app.register_error_handler(403, handle_403)