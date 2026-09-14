"""
Review pages and JSON feed for the audit tables (course_log, role_log,
assignment_log) and the error log. See docs/specs/audit-logging-review.md, phase 6.

Access: admins see everything. Instructors see the history of the courses they
instruct (the course and assignment pages, and the feed scoped to one of them).
The dashboard, the global feed, user history and the errors page are admin only.
Every non-admin feed request is scoped server-side; the client cannot omit it.
"""
import difflib
import json
from datetime import datetime, timedelta, timezone

from flask import Blueprint, g, render_template, request, abort, url_for
from sqlalchemy import func, or_

from controllers.helpers import (login_required, abort_with_failure, ajax_success, ajax_failure,
                                 maybe_int)
from models import db
from models.assignment import Assignment
from models.course import Course
from models.enums import CourseLogEvent, RoleLogEvent, AssignmentLogEvent
from models.log_tables import CourseLog, RoleLog, AssignmentLog, ErrorLog, AccessLog
from models.user import User

blueprint_audit = Blueprint('audit', __name__, url_prefix='/audit')

FEED_TABLES = {'course_log': CourseLog, 'role_log': RoleLog, 'assignment_log': AssignmentLog}
EVENT_ENUMS = {'course_log': CourseLogEvent, 'role_log': RoleLogEvent, 'assignment_log': AssignmentLogEvent}
FEED_DEFAULT_LIMIT = 100
FEED_MAX_LIMIT = 500
#: Feed responses cut `value` here; /audit/event returns it whole
VALUE_TRUNCATION = 500
DESTRUCTIVE_EVENTS = {
    'course_log': [CourseLogEvent.DELETE, CourseLogEvent.UNADOPT],
    'role_log': [RoleLogEvent.REMOVED],
    'assignment_log': [AssignmentLogEvent.DELETE, AssignmentLogEvent.UNFORK],
}
PRIVILEGED_ROLES = ('instructor', 'admin')
#: Errors older than this are not grouped on the errors page
ERROR_GROUP_DAYS = 30
ERROR_GROUP_ROW_CAP = 5000
ERROR_GROUP_OCCURRENCES = 20


# ---------------------------------------------------------------------------
# Access

def require_audit_scope(course_id=None, assignment_id=None, as_html=False) -> bool:
    """
    Decide whether the current user may read audit data in the given scope, aborting
    if not. Returns whether they are an admin (who may read everything, including an
    unscoped request). Anyone else must instruct the course, or the course that owns
    the assignment; adopting an assignment from another course grants nothing.
    """
    user = g.get('user')
    if user is None or user.anonymous:
        abort_with_failure(403, "You must be logged in to review audit logs.", as_html)
    if user.is_admin():
        return True
    if course_id is None and assignment_id is None:
        abort_with_failure(403, "Only administrators can review audit logs without a course or assignment.",
                           as_html)
    if assignment_id is not None:
        assignment = Assignment.by_id(assignment_id)
        if assignment is None or not user.is_instructor(assignment.course_id):
            abort_with_failure(403, f"You are not an instructor of the course that owns assignment "
                                    f"{assignment_id}.", as_html)
    if course_id is not None and not user.is_instructor(course_id):
        abort_with_failure(403, f"You are not an instructor of course {course_id}.", as_html)
    return False


def _require_row_scope(row) -> bool:
    """ Scope check for one event. assignment_log rows are visible from the course the edit
    was made in as well as from the assignment's owning course. """
    if isinstance(row, AssignmentLog):
        user = g.get('user')
        if user is not None and not user.anonymous and not user.is_admin() and user.is_instructor(row.course_id):
            return False
        return require_audit_scope(assignment_id=row.assignment_id)
    return require_audit_scope(course_id=row.course_id)


# ---------------------------------------------------------------------------
# Encoding

def _utc_now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _iso(when: datetime):
    """ Naive UTC (how the tables store dates) to an explicit ISO 8601 UTC string. """
    if when is None:
        return None
    if when.tzinfo is not None:
        when = when.astimezone(timezone.utc).replace(tzinfo=None)
    return when.strftime('%Y-%m-%dT%H:%M:%SZ')


def _parse_iso(value):
    """ ISO 8601 (with or without a zone) to naive UTC; None if missing or malformed. """
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.strip().replace('Z', '+00:00'))
    except ValueError:
        return None
    if parsed.tzinfo is not None:
        parsed = parsed.astimezone(timezone.utc).replace(tzinfo=None)
    return parsed


def _encode_user(user):
    return user.encode_json() if user is not None else None


def _encode_course(course):
    return {'id': course.id, 'name': course.name, 'url': course.url} if course is not None else None


def _encode_assignment(assignment):
    if assignment is None:
        return None
    return {'id': assignment.id, 'name': assignment.name, 'url': assignment.url,
            'type': assignment.type, 'course_id': assignment.course_id}


def _load_by_ids(model, ids):
    ids = {an_id for an_id in ids if an_id is not None}
    if not ids:
        return {}
    return {row.id: row for row in model.query.filter(model.id.in_(ids)).all()}


def encode_events(rows, truncate=True):
    """
    The normalized event shape shared by all three audit tables, with the subject,
    authorizer, course and assignment loaded in one query each rather than per row.
    """
    user_ids, course_ids, assignment_ids = set(), set(), set()
    for row in rows:
        user_ids.add(row.subject_id)
        course_ids.add(row.course_id)
        if isinstance(row, RoleLog):
            user_ids.add(row.authorizer_id)
        elif isinstance(row, AssignmentLog):
            assignment_ids.add(row.assignment_id)
    # Held in locals so the identity map keeps them until encoding is done
    users = _load_by_ids(User, user_ids)
    courses = _load_by_ids(Course, course_ids)
    assignments = _load_by_ids(Assignment, assignment_ids)
    events = []
    for row in rows:
        event = row.encode_json()
        event['when'] = _iso(row.date_created)
        event['subject'] = _encode_user(users.get(row.subject_id))
        event['authorizer'] = (_encode_user(users.get(row.authorizer_id))
                               if isinstance(row, RoleLog) else None)
        event['course'] = _encode_course(courses.get(row.course_id))
        event['assignment'] = (_encode_assignment(assignments.get(row.assignment_id))
                               if isinstance(row, AssignmentLog) else None)
        value = event.get('value')
        event['value_truncated'] = False
        if truncate and value is not None and len(value) > VALUE_TRUNCATION:
            event['value'] = value[:VALUE_TRUNCATION]
            event['value_truncated'] = True
        events.append(event)
    return events


# ---------------------------------------------------------------------------
# Feed

def _csv_param(name):
    return [part.strip() for part in request.values.get(name, '').split(',') if part.strip()]


def _feed_filters():
    tables = [table for table in _csv_param('tables') if table in FEED_TABLES] or list(FEED_TABLES)
    limit = maybe_int(request.values.get('limit'))
    if limit is None:
        limit = FEED_DEFAULT_LIMIT
    return dict(
        tables=tables,
        course_id=maybe_int(request.values.get('course_id')),
        subject_id=maybe_int(request.values.get('subject_id')),
        actor_id=maybe_int(request.values.get('actor_id')),
        assignment_id=maybe_int(request.values.get('assignment_id')),
        event_types=_csv_param('event_types'),
        since=_parse_iso(request.values.get('since')),
        before=_parse_iso(request.values.get('before')),
        search=request.values.get('search', '').strip(),
        limit=max(1, min(limit, FEED_MAX_LIMIT)),
    )


def _query_table(table, filters, forced_course_id, forced_assignment_id):
    """ One filtered, ordered, limited query against one audit table. """
    model = FEED_TABLES[table]
    query = model.query
    course_id = forced_course_id if forced_course_id is not None else filters['course_id']
    if course_id is not None:
        query = query.filter(model.course_id == course_id)
    assignment_id = forced_assignment_id if forced_assignment_id is not None else filters['assignment_id']
    if assignment_id is not None:
        if model is not AssignmentLog:
            return []
        query = query.filter(AssignmentLog.assignment_id == assignment_id)
    if filters['subject_id'] is not None:
        query = query.filter(model.subject_id == filters['subject_id'])
    if filters['actor_id'] is not None:
        # "Who did it": the authorizer for role changes, the subject everywhere else
        actor_column = RoleLog.authorizer_id if model is RoleLog else model.subject_id
        query = query.filter(actor_column == filters['actor_id'])
    if filters['event_types']:
        enum = EVENT_ENUMS[table]
        wanted = []
        for value in filters['event_types']:
            try:
                wanted.append(enum(value))
            except ValueError:
                continue
        if not wanted:
            return []
        query = query.filter(model.event_type.in_(wanted))
    if filters['since'] is not None:
        query = query.filter(model.date_created >= filters['since'])
    if filters['before'] is not None:
        query = query.filter(model.date_created < filters['before'])
    if filters['search']:
        pattern = f"%{filters['search']}%"
        if model is RoleLog:
            query = query.filter(RoleLog.event_value.ilike(pattern))
        else:
            query = query.filter(or_(model.field.ilike(pattern), model.value.ilike(pattern)))
    return (query.order_by(model.date_created.desc(), model.id.desc())
            .limit(filters['limit']).all())


def _newest_first(rows):
    return sorted(rows, key=lambda row: (row.date_created, row.id), reverse=True)


@blueprint_audit.route('/feed', methods=['GET', 'POST'], strict_slashes=False)
@login_required
def feed():
    """ The unified feed across the audit tables; see the module docstring for access. """
    filters = _feed_filters()
    is_admin = require_audit_scope(filters['course_id'], filters['assignment_id'])
    forced_course_id = None if is_admin else filters['course_id']
    forced_assignment_id = None if is_admin else filters['assignment_id']
    rows = []
    for table in filters['tables']:
        rows.extend(_query_table(table, filters, forced_course_id, forced_assignment_id))
    rows = _newest_first(rows)[:filters['limit']]
    return ajax_success({'events': encode_events(rows), 'limit': filters['limit'], 'is_admin': is_admin})


@blueprint_audit.route('/event/<table>/<int:event_id>', methods=['GET'], strict_slashes=False)
@login_required
def event(table, event_id):
    """ One event with its untruncated value. """
    model = FEED_TABLES.get(table)
    if model is None:
        return ajax_failure(f"Unknown audit table: {table}", 404)
    row = model.query.get(event_id)
    if row is None:
        return ajax_failure(f"No {table} row with id {event_id}", 404)
    _require_row_scope(row)
    return ajax_success({'event': encode_events([row], truncate=False)[0]})


def _diff_lines(value, field):
    """ Lines to diff. Settings JSON is pretty-printed with sorted keys first, so the diff is
    by key rather than by serialization order. """
    if value is None:
        return []
    if field == 'assignment_settings.blockpy' or (field or '').endswith('.json'):
        try:
            return json.dumps(json.loads(value), indent=2, sort_keys=True).splitlines()
        except (TypeError, ValueError):
            pass
    return value.splitlines()


@blueprint_audit.route('/diff/<table>/<int:event_id>', methods=['GET'], strict_slashes=False)
@login_required
def diff(table, event_id):
    """ Unified diff between an assignment_log row and the previous row for the same
    assignment and field. """
    if table != 'assignment_log':
        return ajax_failure("Diffs are only available for assignment_log rows", 400)
    row = AssignmentLog.query.get(event_id)
    if row is None:
        return ajax_failure(f"No assignment_log row with id {event_id}", 404)
    _require_row_scope(row)
    previous = (AssignmentLog.query
                .filter(AssignmentLog.assignment_id == row.assignment_id,
                        AssignmentLog.field == row.field,
                        AssignmentLog.id < row.id)
                .order_by(AssignmentLog.id.desc())
                .first())
    before = _diff_lines(previous.value if previous is not None else "", row.field)
    after = _diff_lines(row.value, row.field)
    lines = []
    for index, line in enumerate(difflib.unified_diff(
            before, after, lineterm="",
            fromfile=f"event {previous.id}" if previous is not None else "(nothing)",
            tofile=f"event {row.id}")):
        if (index < 2 and line.startswith(('---', '+++'))) or line.startswith('@@'):
            lines.append({'kind': 'header', 'text': line})
        elif line.startswith('+'):
            lines.append({'kind': 'add', 'text': line[1:]})
        elif line.startswith('-'):
            lines.append({'kind': 'remove', 'text': line[1:]})
        else:
            lines.append({'kind': 'context', 'text': line[1:]})
    return ajax_success({'previous_id': previous.id if previous is not None else None,
                         'field': row.field, 'lines': lines})


# ---------------------------------------------------------------------------
# Dashboard data (admin only)

def _daily_counts(model, start, end):
    """ Rows per calendar day (UTC) from start to end, as a list of {date, count}. """
    day = func.date(model.date_created)
    rows = (db.session.query(day, func.count(model.id))
            .filter(model.date_created >= start)
            .group_by(day).all())
    counts = {str(date): count for date, count in rows}
    days = []
    total_days = (end.date() - start.date()).days
    for offset in range(total_days + 1):
        date = (start + timedelta(days=offset)).date().isoformat()
        days.append({'date': date, 'count': counts.get(date, 0)})
    return days


@blueprint_audit.route('/summary', methods=['GET'], strict_slashes=False)
@login_required
def summary():
    """ Counts for the dashboard tiles, plus the recent destructive and privilege events. """
    require_audit_scope()
    now = _utc_now()
    since = _parse_iso(request.values.get('since')) or now - timedelta(hours=24)
    week_ago = now - timedelta(days=7)
    tables = {}
    for table, model in FEED_TABLES.items():
        tables[table] = {
            'since': model.query.filter(model.date_created >= since).count(),
            'week': model.query.filter(model.date_created >= week_ago).count(),
            'days': _daily_counts(model, week_ago, now),
        }
    destructive = []
    for table, model in FEED_TABLES.items():
        destructive.extend(model.query.filter(model.event_type.in_(DESTRUCTIVE_EVENTS[table]))
                           .order_by(model.date_created.desc(), model.id.desc()).limit(20).all())
    privilege = (RoleLog.query
                 .filter(RoleLog.event_type.in_([RoleLogEvent.GIVEN, RoleLogEvent.CHANGED]),
                         RoleLog.event_value.in_(PRIVILEGED_ROLES))
                 .order_by(RoleLog.date_created.desc(), RoleLog.id.desc()).limit(20).all())
    errors = {
        'since': ErrorLog.query.filter(ErrorLog.date_created >= since).count(),
        'week': ErrorLog.query.filter(ErrorLog.date_created >= week_ago).count(),
        'days': _daily_counts(ErrorLog, week_ago, now),
    }
    return ajax_success({
        'since': _iso(since),
        'tables': tables,
        'destructive': encode_events(_newest_first(destructive)[:20]),
        'privilege': encode_events(privilege),
        'errors': errors,
    })


def _last_traceback_frame(traceback_text):
    """ The innermost "File ..." line of a traceback, which is what groups occurrences. """
    lines = [line.strip() for line in (traceback_text or '').splitlines() if line.strip()]
    frames = [line for line in lines if line.startswith('File ')]
    if frames:
        return frames[-1]
    return lines[-1] if lines else ''


@blueprint_audit.route('/error_groups', methods=['GET'], strict_slashes=False)
@login_required
def error_groups():
    """ error_log rows from the last ERROR_GROUP_DAYS grouped by type and innermost frame, each
    with counts, first/last seen, a per-day series and the most recent occurrences. """
    require_audit_scope()
    now = _utc_now()
    days = maybe_int(request.values.get('days')) or ERROR_GROUP_DAYS
    start = now - timedelta(days=days)
    day_ago, week_ago = now - timedelta(hours=24), now - timedelta(days=7)
    rows = (db.session.query(ErrorLog, AccessLog)
            .join(AccessLog, ErrorLog.access_log_id == AccessLog.id)
            .filter(ErrorLog.date_created >= start)
            .order_by(ErrorLog.date_created.desc(), ErrorLog.id.desc())
            .limit(ERROR_GROUP_ROW_CAP).all())
    users = _load_by_ids(User, {access.subject_id for _, access in rows})
    groups = {}
    for error, access in rows:
        key = (error.error_type, _last_traceback_frame(error.traceback))
        group = groups.setdefault(key, {
            'error_type': error.error_type, 'frame': key[1], 'count': 0,
            'first_seen': error.date_created, 'last_seen': error.date_created,
            'day': 0, 'week': 0, 'days': [0] * 7, 'occurrences': [],
        })
        group['count'] += 1
        when = error.date_created
        group['first_seen'] = min(group['first_seen'], when)
        group['last_seen'] = max(group['last_seen'], when)
        if when >= day_ago:
            group['day'] += 1
        if when >= week_ago:
            group['week'] += 1
            group['days'][min(6, max(0, 6 - (now - when).days))] += 1
        if len(group['occurrences']) < ERROR_GROUP_OCCURRENCES:
            group['occurrences'].append({
                'id': error.id, 'when': _iso(when), 'message': error.message, 'traceback': error.traceback,
                'route': access.route, 'method': access.method, 'ip_address': access.ip_address,
                'user': _encode_user(users.get(access.subject_id)),
            })
    result = sorted(groups.values(), key=lambda group: group['last_seen'], reverse=True)
    for group in result:
        group['first_seen'] = _iso(group['first_seen'])
        group['last_seen'] = _iso(group['last_seen'])
    return ajax_success({'groups': result, 'total': len(rows), 'days': days})


@blueprint_audit.route('/lookup', methods=['GET'], strict_slashes=False)
@login_required
def lookup():
    """ Resolve the dashboard search box: a user email, a course id or url, or an
    assignment id or url, to the history pages that match. """
    require_audit_scope()
    query = request.values.get('q', '').strip()
    matches = []
    if not query:
        return ajax_success({'matches': matches})
    if '@' in query:
        for user in User.query.filter(User.email.ilike(f"%{query}%")).limit(10).all():
            matches.append({'kind': 'user', 'label': f"{user.name()} <{user.email}>",
                            'url': url_for('audit.user_page', user_id=user.id)})
    if query.isdigit():
        course = Course.by_id(int(query))
        if course is not None:
            matches.append({'kind': 'course', 'label': f"Course {course.id}: {course.name}",
                            'url': url_for('audit.course_page', course_id=course.id)})
        assignment = Assignment.by_id(int(query))
        if assignment is not None:
            matches.append({'kind': 'assignment', 'label': f"Assignment {assignment.id}: {assignment.name}",
                            'url': url_for('audit.assignment_page', assignment_id=assignment.id)})
        user = User.by_id(int(query))
        if user is not None:
            matches.append({'kind': 'user', 'label': f"User {user.id}: {user.name()} <{user.email}>",
                            'url': url_for('audit.user_page', user_id=user.id)})
    else:
        course = Course.by_url(query)
        if course is not None:
            matches.append({'kind': 'course', 'label': f"Course {course.id}: {course.name}",
                            'url': url_for('audit.course_page', course_id=course.id)})
        assignment = Assignment.by_url(query)
        if assignment is not None:
            matches.append({'kind': 'assignment', 'label': f"Assignment {assignment.id}: {assignment.name}",
                            'url': url_for('audit.assignment_page', assignment_id=assignment.id)})
    return ajax_success({'matches': matches})


# ---------------------------------------------------------------------------
# Pages

def _render(page, title, is_admin, subtitle="", **config):
    config.update(page=page, isAdmin=is_admin, title=title)
    return render_template('audit/audit.html', title=title, subtitle=subtitle, config=config)


@blueprint_audit.route('/', methods=['GET'])
@login_required
def dashboard():
    require_audit_scope(as_html=True)
    return _render('dashboard', "Audit Dashboard", True)


@blueprint_audit.route('/events', methods=['GET'], strict_slashes=False)
@login_required
def events_page():
    require_audit_scope(as_html=True)
    return _render('feed', "Audit Feed", True)


@blueprint_audit.route('/course/<int:course_id>', methods=['GET'], strict_slashes=False)
@login_required
def course_page(course_id):
    course = Course.by_id(course_id)
    if course is None:
        abort(404, f"There is no course with id {course_id}.")
    is_admin = require_audit_scope(course_id=course_id, as_html=True)
    created = (CourseLog.query.filter_by(course_id=course_id, event_type=CourseLogEvent.CREATE)
               .order_by(CourseLog.id).first())
    header = {
        'course': _encode_course(course),
        'owner': _encode_user(User.by_id(course.owner_id)),
        'visibility': str(course.visibility),
        'locked': bool(course.locked),
        'createdBy': _encode_user(User.by_id(created.subject_id)) if created is not None else None,
        'createdAt': _iso(created.date_created if created is not None else course.date_created),
    }
    subtitle = (f"Back to <a href='{url_for('courses.course', course_id=course_id)}'>{course.name}</a>")
    return _render('course', f"Course History: {course.name}", is_admin, subtitle,
                   courseId=course_id, header=header)


@blueprint_audit.route('/user/<int:user_id>', methods=['GET'], strict_slashes=False)
@login_required
def user_page(user_id):
    require_audit_scope(as_html=True)
    user = User.by_id(user_id)
    if user is None:
        abort(404, f"There is no user with id {user_id}.")
    return _render('user', f"User History: {user.name()}", True,
                   userId=user_id, header={'user': _encode_user(user)})


@blueprint_audit.route('/assignment/<int:assignment_id>', methods=['GET'], strict_slashes=False)
@login_required
def assignment_page(assignment_id):
    assignment = Assignment.by_id(assignment_id)
    if assignment is None:
        abort(404, f"There is no assignment with id {assignment_id}.")
    is_admin = require_audit_scope(assignment_id=assignment_id, as_html=True)
    header = {
        'assignment': _encode_assignment(assignment),
        'course': _encode_course(Course.by_id(assignment.course_id)),
        'owner': _encode_user(User.by_id(assignment.owner_id)),
    }
    subtitle = (f"Owned by course <a href='{url_for('audit.course_page', course_id=assignment.course_id)}'>"
                f"{assignment.course_id}</a>")
    return _render('assignment', f"Assignment History: {assignment.name}", is_admin, subtitle,
                   assignmentId=assignment_id, header=header)


@blueprint_audit.route('/errors', methods=['GET'], strict_slashes=False)
@login_required
def errors_page():
    require_audit_scope(as_html=True)
    return _render('errors', "Server Errors", True)
