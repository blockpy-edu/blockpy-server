"""
LAPIS feedback loop endpoints (see the LAPIS repo's docs/BLOCKPY_CHANGES.md).

Two distinct auth paths, never interchangeable:
- Service-to-service (POST /lapis/feedback, GET /lapis/feedback/views):
  X-Lapis-Token header matching config LAPIS_FEEDBACK_TOKEN, constant-time
  compare. A custom header rather than Authorization: Bearer because the
  global login hook (flask-jwt-extended) parses any bearer token as a
  session JWT and 422s before the view runs.
- Student-facing (GET /lapis/feedback/): normal session auth; students see
  only their own rows.
"""

import hmac
from datetime import datetime
from itertools import groupby

from flask import (Blueprint, current_app, g, jsonify, redirect,
                   render_template, request, url_for)

from controllers.helpers import ajax_failure, ajax_success, login_required
from models import db
from models.course import Course
from models.lapis_feedback import LapisFeedback
from models.user import User

blueprint_lapis = Blueprint('lapis', __name__, url_prefix='/lapis')


def _require_lapis_token():
    """Abort unless the request carries the LAPIS service token."""
    expected = current_app.config.get('LAPIS_FEEDBACK_TOKEN')
    if not expected or expected == 'change-me':
        ajax_failure("LAPIS feedback endpoint is not configured", 503)
    token = request.headers.get('X-Lapis-Token', '')
    if not hmac.compare_digest(token.encode(), expected.encode()):
        ajax_failure("Invalid LAPIS token", 401)


@blueprint_lapis.route('/feedback', methods=['POST'])
def receive_feedback():
    """Create/update released feedback (LAPIS -> BlockPy), upserted by
    lapis_draft_id so re-releases edit in place."""
    _require_lapis_token()
    data = request.get_json(silent=True) or {}
    user_id = data.get('user_id')
    course_id = data.get('course_id')
    body = (data.get('body') or '').strip()
    if not user_id or not body:
        ajax_failure("user_id and body are required", 400)
    if User.query.get(user_id) is None:
        ajax_failure(f"Unknown user_id {user_id}", 400)
    if course_id is not None and Course.query.get(course_id) is None:
        ajax_failure(f"Unknown course_id {course_id}", 400)

    lapis_draft_id = data.get('lapis_draft_id')
    feedback = None
    if lapis_draft_id is not None:
        feedback = LapisFeedback.query.filter_by(
            lapis_draft_id=lapis_draft_id).first()
    if feedback is None:
        feedback = LapisFeedback(
            user_id=user_id,
            lapis_draft_id=lapis_draft_id,
            date_released=datetime.utcnow(),
        )
        db.session.add(feedback)
    feedback.course_id = course_id
    feedback.analysis_window = data.get('analysis_window') or ''
    feedback.body = body
    db.session.commit()
    return ajax_success({"feedback": {"id": feedback.id}})


@blueprint_lapis.route('/feedback/views', methods=['GET'])
def feedback_views():
    """Viewed-timestamp sync (LAPIS polls this into feedback_release)."""
    _require_lapis_token()
    query = LapisFeedback.query.filter(
        LapisFeedback.date_first_viewed.isnot(None))
    since = request.args.get('since')
    if since:
        try:
            query = query.filter(
                LapisFeedback.date_first_viewed >= datetime.fromisoformat(since))
        except ValueError:
            ajax_failure("since must be ISO8601", 400)
    return jsonify({"views": [
        {"lapis_draft_id": f.lapis_draft_id,
         "date_first_viewed": f.date_first_viewed.isoformat()}
        for f in query.all()
    ]})


@blueprint_lapis.route('/feedback/', methods=['GET'])
@login_required
def student_feedback():
    """The Student Feedback Menu: the logged-in student's released
    feedback, grouped by analysis window, newest first. First render
    stamps date_first_viewed (once, never overwritten)."""
    # login_required passes anonymous per-IP users through; feedback is
    # for real accounts only.
    if g.user.anonymous:
        return redirect(url_for('security.login', next=request.url))
    query = LapisFeedback.query.filter_by(user_id=g.user.id)
    course_id = request.args.get('course_id', type=int)
    if course_id is not None:
        query = query.filter_by(course_id=course_id)
    rows = query.order_by(LapisFeedback.date_released.desc(),
                          LapisFeedback.id.desc()).all()

    now = datetime.utcnow()
    stamped = False
    for row in rows:
        if row.date_first_viewed is None:
            row.date_first_viewed = now
            stamped = True
    if stamped:
        db.session.commit()

    windows = [
        (window, list(items))
        for window, items in groupby(rows, key=lambda f: f.analysis_window)
    ]
    return render_template('lapis/feedback.html', windows=windows,
                           course_id=course_id)
