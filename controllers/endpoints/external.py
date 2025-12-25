from datetime import datetime
import os
import json
from typing import Tuple

from slugify import slugify
from natsort import natsorted

from quart import Blueprint, url_for, session, request, jsonify, g, render_template, redirect, Response, current_app
from werkzeug.utils import secure_filename

from models import db
from models.log_tables import SubmissionLog as Log
from models.submission import Submission
from models.assignment import Assignment
from models.assignment_group import AssignmentGroup

from common.urls import normalize_url
from common.filesystem import ensure_dirs
from controllers.auth import get_user
from controllers.helpers import (ajax_failure, parse_assignment_load, require_request_parameters,
                                 get_course_id, maybe_int, check_resource_exists, ajax_success,
                                 login_required, require_course_instructor, require_course_grader, maybe_bool)

blueprint_external = Blueprint('external', __name__, url_prefix='/external')

# TODO: download
# TODO: upload


@blueprint_external.route('/dump_logs/', methods=['GET', 'POST'])
@blueprint_external.route('/dump_logs', methods=['GET', 'POST'])
@require_request_parameters('assignment_id', 'course_id')
def dump_logs():
    assignment_id = int(request.values.get('assignment_id'))
    course_id = int(request.values.get('course_id'))
    assignment = Assignment.by_id(assignment_id)
    user, user_id = get_user()
    # Verify exists
    check_resource_exists(assignment, "Assignment", assignment_id)
    # Verify permissions
    if not user.is_grader(course_id):
        return "You are not a grader in this course."
    # Get data
    suas = Submission.by_assignment(assignment_id, course_id)
    data = {
        'assignment': assignment.encode_json(),
        'submissions': [
            {
                'user': u.encode_json(),
                'submission': sub.encode_json(),
                'history': Log.get_history(course_id, assignment_id, u.id),
                'reviews': sub.get_reviews()
            } for (sub, u, assign) in suas
        ]
    }
    filename = assignment.get_filename("")+'_submissions.json'
    return Response(json.dumps(data), mimetype='application/json',
                    headers={'Content-Disposition':'attachment;filename={}'.format(filename)})
