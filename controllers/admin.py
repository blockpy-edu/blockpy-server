# Import built-ins
import json
import csv
import io
import os.path as op
from datetime import datetime

import pytz
# Import Flask
from flask_admin import Admin, BaseView, expose, form
from flask_admin.contrib.sqla import ModelView
from flask_admin.contrib.fileadmin import FileAdmin
from flask import g, Blueprint, request, url_for, render_template, Response, current_app
from flask_admin.contrib.sqla.ajax import QueryAjaxModelLoader
from flask_admin.model.filters import BaseFilter
from markupsafe import Markup

from sqlalchemy import func, text as sql_text, Date, cast
from sqlalchemy_utc import UtcDateTime
from wtforms import StringField

from models import db
from models.user import User
from models.course import Course
from models.role import Role
from models.authentication import Authentication
from models.log_tables import RoleLog, AccessLog, ErrorLog, CourseLog, AssignmentLog, SubmissionLog
from models.submission import Submission
from models.sample_submission import SampleSubmission
from models.review import Review
from models.assignment import Assignment
from models.assignment_group import AssignmentGroup
from models.assignment_group_membership import AssignmentGroupMembership
from models.assignment_tag import AssignmentTag
from models.report import Report
from models.invite import Invite
from models.grade_history import GradeHistory
from models.counters.submission_counts import SubmissionCounts
from flask_admin.contrib.sqla.form import AdminModelConverter, validators


class CustomConverter(AdminModelConverter):
    def get_converter(self, column):
        if isinstance(column.type, UtcDateTime):
            return self.convert_datetime
        else:
            return super().get_converter(column)


def make_ajax_fields(*fields):
    return {
        'fields': fields,
        'placeholder': 'Please select',
        'page_size': 10,
        'minimum_input_length': 0
    }



class RegularView(ModelView):
    model_form_converter = CustomConverter

    def is_accessible(self):
        if g.user:
            return g.user.is_admin()
        return False



class UserView(RegularView):
    def _list_roles(view, context, model, name):
        display_roles = []
        for role in model.roles:
            if role.course_id is None:
                display_roles.append(f"{role.name} in all courses")
                continue
            course = Course.query.get(role.course_id)
            if course is None:
                display_roles.append(f"{role.name} in Course ID {role.course_id} (Missing course?)")
                continue
            display_roles.append(f"{role.name} in {course.name}")
        return Markup('<br>\n'.join(display_roles))

    column_hide_backrefs = False
    column_formatters = {'roles': _list_roles}
    form_excluded_columns = ('password', 'roles', 'authentications',
                             'assignments', 'assignment_groups', 'courses',
                             'tags', 'submission_logs', 'assignment_logs', 'course_logs',
                             'role_logs', 'access_logs', 'approvals', 'invites',
                             'authorizer_logs',
                             'reviews', 'submissions', 'reports',
                             'invites', 'grade_history')
    column_exclude_list = ('password', 'proof')
    column_display_pk = True
    column_searchable_list = ('first_name', 'last_name', 'email')
    column_list = ('id', 'first_name', 'last_name', 'email', 'active', 'anonymous', 'roles')
    column_filters = ('id', 'first_name', 'last_name', 'email', 'active', 'anonymous')


class ModelIdView(RegularView):
    column_display_pk = True


def _editable(table, field):
    def _edit_field(view, context, model, name):
        return table.query.filter(getattr(table, field) == getattr(model, name)).first()

    return _edit_field


def _id(table):
    def _edit_id(view, context, model, name):
        return table.query.filter(table.id == getattr(model, name)).first()

    return _edit_id


def _recurse_render_settings(item):
    if isinstance(item, list):
        return "[{}]".format(','.join("<code>{}</code>".format(s) for s in item))
    elif isinstance(item, dict):
        rows = "<ul>"
        for name, setting in item.items():
            rows += "<li><b>{name}</b>: ".format(name=name)
            rows += _recurse_render_settings(setting)
            rows += "</li>"
        return rows + "</ul>"
    else:
        return "<code>{}</code>".format(item)


def _render_settings(view, context, model, name):
    body = "<div>" + model.type + "</div>"
    body += "<pre>"
    if model.settings:
        try:
            body += _recurse_render_settings(json.loads(model.settings))
        except TypeError:
            body += model.settings
    body += "</pre>"
    return Markup(body)


SHRUNK_STYLE = "style='max-height:10em;overflow:auto'"


def _render_code(view, context, model, name):
    if name is None:
        return Markup("<pre></pre>")
    code = getattr(model, name)
    if code is None:
        return Markup("<pre></pre>")
    return Markup("<pre {}>".format(SHRUNK_STYLE) + code + "</pre>")


def _render_assignment_settings(view, context, model, name):
    instructions = "<div {}>".format(SHRUNK_STYLE) + model.instructions + "</div>"
    on_run = "<pre {}>".format(SHRUNK_STYLE) + model.on_run + "</pre>"
    starting_code = "<pre {}>".format(SHRUNK_STYLE) + model.starting_code + "</pre>"
    return Markup((instructions if model.instructions else "") +
                  (on_run if model.on_run else "") +
                  (starting_code if model.starting_code else ""))


def _render_assignment_type(view, context, model, name):
    return Markup("<div>" + model.type + "</div>")


def _render_version(view, context, model, name):
    body = "<p>S: {}</p>".format(model.version)
    body += "<p>A: {}</p>".format(model.assignment_version)
    return Markup(body)


def _render_assignment_name(view, context, model, name):
    return Markup((model.name if model.name else "") +
                  "<br><br>" +
                  (model.url if model.url else ""))


def _smaller(view, context, model, name):
    return Markup("<small>" + (getattr(model, name) or "") + "</small>")


class RoleView(RegularView):
    column_list = ('id', 'date_created', 'name', 'user_id', 'course_id')
    column_labels = {'id': 'Role ID', 'date_created': 'Created',
                     'name': 'Name', 'user_id': "User", "course_id": "Course"}
    column_searchable_list = ('name', 'course_id', 'user_id')
    column_sortable_list = ('id', 'date_created', 'name', 'user_id', 'course_id')
    column_formatters = {'user_id': _id(User),
                         'course_id': _id(Course)}
    column_filters = ('id', 'date_created', 'name', 'user_id', 'course_id')
    # form_columns = ('name', 'user_id', 'course_id')
    form_ajax_refs = {
        'course': make_ajax_fields('id', 'url', 'name'),
        'user': make_ajax_fields('first_name', 'last_name', 'email', 'id')
    }
    form_excluded_columns = ('role_logs', )


def _render_course_service(view, context, model, name):
    return Markup(model.service + "<br>" +
                  (model.external_id + "<br>" if model.external_id else "") +
                  (model.endpoint + "<br>" if model.endpoint else ""))


class CourseView(RegularView):
    can_export = True
    '''name = Column(String(255))
    url = Column(String(255), default=None, nullable=True)
    owner_id = Column(Integer(), ForeignKey('user.id'))
    SERVICES = ['native', 'lti']
    service = Column(String(80), default="native")
    external_id = Column(String(255), default="")
    endpoint = Column(Text(), default="")
    VISIBILITIES = ['private', 'public']
    visibility = Column(String(80), default="private")
    term = Column(String(255), default="")
    settings = Column(Text(), default="")'''
    column_list = ('id', 'date_modified', 'name', 'url', 'owner_id',
                   'service', 'visibility', 'term', 'settings')
    form_excluded_columns = ('roles', 'assignments', 'assignment_groups',
                             'course_logs', 'role_logs', 'assignment_logs',
                             'tags', 'submission_logs', 'submissions', 'invites', 'reports')
    column_searchable_list = ('id', 'name', 'url')
    column_filters = ('id', 'name', 'date_modified', 'url', 'term', 'owner_id', 'service')
    column_formatters = {'service': _render_course_service}
    form_ajax_refs = {
        'owner': make_ajax_fields('first_name', 'last_name', 'email', 'id'),
    }


class AssignmentView(RegularView):
    can_export = True
    column_list = ('id', 'date_modified',
                   'owner_id', 'course_id',
                   'name',  # "url", # 'type', #'body',
                   'on_run',  # 'starting_code',
                   'reviewed', 'hidden',
                   # 'visibility', 'disabled',
                   # 'mode',
                   'version'
                   )
    column_searchable_list = ('name', 'url', 'instructions')
    form_widget_args = {
        'description': {
            'style': 'width: 25%'
        }
    }
    form_ajax_refs = {
        'owner': make_ajax_fields('first_name', 'last_name', 'email', 'id'),
        'course': make_ajax_fields('id', 'url', 'name'),
        'forked': make_ajax_fields('name', 'url', 'id'),
        'tags': make_ajax_fields('name', 'id'),
        'sample_submissions': make_ajax_fields('id'),
    }
    form_excluded_columns = ('memberships', 'assignment_logs', 'submission_logs',
                             'submissions', 'reports', 'sample_submissions', 'tags')
    # form_columns = ('id', 'date_modified')
    column_filters = ('id', 'name', 'on_run', 'course_id', 'url', 'instructions', 'reviewed', 'hidden', 'public')
    column_formatters = {'name': _render_assignment_name,
                         # 'type': _render_assignment_type,
                         'on_run': _render_assignment_settings  # _render_code,
                         # 'starting_code': _render_code
                         }


class AssignmentGroupView(RegularView):
    can_export = True

    def _list_assignments(view, context, model, name):
        assignments = model.get_assignments()
        if assignments and assignments[0].type == 'maze':
            return Markup("Levels: " + (', '.join((assignment.name for assignment in assignments))))
        return Markup("<ol>{}</ol>".format(
            '\n'.join(("<li>{}</li>".format(assignment.name) for assignment in assignments))))

    column_list = ('id', 'date_modified',
                   'owner_id', 'course_id',
                   'name', 'url', 'assignments'
                   )
    column_filters = ('url', 'course_id', 'name')
    column_formatters = {'assignments': _list_assignments}
    form_excluded_columns = ('memberships', 'submissions')
    form_ajax_refs = {
        'owner': make_ajax_fields('first_name', 'last_name', 'email', 'id'),
        'course': make_ajax_fields('id', 'url', 'name'),
        'forked': make_ajax_fields('name', 'url', 'id')
    }


class LogView(RegularView):
    can_export = True
    column_list = ('id', 'date_modified',
                   'course_id', 'assignment_id', 'subject_id',
                   'event_type', 'category',
                   'label', 'message'
                   )
    column_formatters = {'message': _render_code}
    column_filters = ('id', 'date_modified',
                      'course_id', 'assignment_id', 'subject_id', 'event_type', 'category', 'label', 'message')
    form_ajax_refs = {
        'assignment': make_ajax_fields('name', 'url', 'id'),
        'course': make_ajax_fields('id', 'url', 'name'),
        'subject': make_ajax_fields('first_name', 'last_name', 'email', 'id')
    }
    simple_list_pager = True

    def get_count_query(self):
        """
        Need to override this because we have MASSIVE tables sometimes
        """
        # dialect_name = self.session.get_bind().dialect.name
        # if dialect_name == "postgresql":
        #     query = sql_text("""
        #         SELECT reltuples::bigint
        #         FROM pg_class
        #         WHERE relname = :table_name;
        #     """)
        #     return self.session.execute(query, {"table_name": self.model.__tablename__})
        # elif dialect_name == "sqlite":
        #     query = sql_text(f"SELECT count(*) FROM {self.model.__tablename__};")
        #     return self.session.execute(query)
        # else:
        return self.session.query(func.count('*')).select_from(self.model)


class AssignmentGroupMembershipView(RegularView):
    can_export = True
    column_list = ('id', 'date_modified',
                   'assignment_group_id', 'assignment_id',
                   'position'
                   )
    # form_columns = ('assignment_group_id', 'assignment_id', 'position')
    column_filters = ('id', 'date_modified', 'assignment_id', 'assignment_group_id')
    column_formatters = {'user_id': _editable(User, 'id'),
                         'course_id': _editable(Course, 'id')}
    form_ajax_refs = {
        'assignment': make_ajax_fields('name', 'url', 'id'),
        'assignment_group': make_ajax_fields('name', 'url', 'id')
    }


class AssignmentTagView(RegularView):
    can_export = True
    column_list = ('id', 'date_modified',
                   'owner_id', 'course_id',
                   'name', 'kind', 'description',
                   'version'
                   )
    column_formatters = {'owner_id': _editable(User, 'id'),
                         'course_id': _editable(Course, 'id')}
    form_excluded_columns = ('reviews', 'assignments', )


class ReviewView(RegularView):
    can_export = True
    column_list = ('id', 'date_modified',
                   'comment', 'location', 'generic',
                   'tag_id', 'score', 'submission_id',
                   'author_id', 'assignment_version',
                   'submission_version', 'version',
                   'forked_id', 'forked_version')
    column_formatters = {'author_id': _editable(User, 'id'), 'submission_id': _editable(Submission, 'id')}

    form_ajax_refs = {
        'submission': QueryAjaxModelLoader('submission', db.session, Submission, fields=['id'], page_size=10),
        'author': make_ajax_fields('first_name', 'last_name', 'email', 'id'),
        'forked': make_ajax_fields('id')
    }
    form_excluded_columns = ('tag', )


class SampleSubmissionView(RegularView):
    can_export = True
    column_list = ('id', 'date_modified',
                   'owner_id', 'assignment_id', 'version'
                                                'name', 'score', 'code',
                   'correct', 'forked_id', 'forked_version',
                   'version'
                   )
    column_formatters = {'owner_id': _editable(User, 'id'),
                         'assignment_id': _editable(Assignment, 'id')}
    form_ajax_refs = {
        'assignment': make_ajax_fields('name', 'url', 'id'),
    }

class AuthenticationView(ModelIdView):
    form_ajax_refs = {
        'user': make_ajax_fields('first_name', 'last_name', 'email', 'id')
    }


class InviteView(ModelIdView):
    form_ajax_refs = {
        'user': make_ajax_fields('first_name', 'last_name', 'email', 'id'),
        'course': make_ajax_fields('id', 'url', 'name')
    }


class ReportView(ModelIdView):
    column_filters = ('id',
                      'task', 'status', 'attempt', 'result', 'progress', 'message',
                      'date_started', 'date_modified', 'date_finished',
                      'parameters', 'visibility',
                      'owner_id', 'assignment_id', 'course_id',
                      )
    form_ajax_refs = {
        'assignment': make_ajax_fields('name', 'url', 'id'),
        'course': make_ajax_fields('id', 'url', 'name'),
        'owner': make_ajax_fields('first_name', 'last_name', 'email', 'id')
    }
    column_searchable_list = ('task', 'status', 'message', 'parameters')
    column_formatters = {'parameters': _render_code}
    column_list = ('id',
                   'task', 'status', 'attempt', 'result', 'progress', 'message',
                   'date_created', 'date_started', 'date_modified', 'date_finished',
                   'parameters', 'visibility',
                   'owner', 'assignment', 'course',
                   )


class SubmissionView(RegularView):
    can_export = True
    column_list = ('id', 'date_modified',
                   'user_id', 'assignment_id', 'course_id',
                   'code', 'correct', 'score',
                   "submission_status", "grading_status",
                   'version', 'url'
                   )
    column_sortable_list = column_list
    column_filters = ('id', 'user_id', 'assignment_id', 'course_id',
                      'date_modified', 'correct', 'submission_status', 'grading_status',
                      'endpoint')
    column_formatters = {'code': _render_code, 'endpoint': _smaller,
                         'version': _render_version}
    column_formatters_export = None
    column_export_list = None

    form_ajax_refs = {
        'assignment': make_ajax_fields('name', 'url', 'id'),
        'assignment_group': make_ajax_fields('name', 'url', 'id'),
        'course': make_ajax_fields('id', 'url', 'name'),
        'user': make_ajax_fields('first_name', 'last_name', 'email', 'id')
    }
    form_excluded_columns = ('reviews', 'grade_history', 'submission_logs')
    simple_list_pager = True


class GradeHistoryView(RegularView):
    can_export = True
    form_ajax_refs = {
        'grader': make_ajax_fields('first_name', 'last_name', 'email', 'id'),
        'submission': QueryAjaxModelLoader('submission', db.session, Submission, fields=['id'], page_size=10),
    }
    column_filters = ('id', 'submission_id', 'grader_id', 'score', 'date_submitted')

class SubmissionCountView(RegularView):
    can_export = True
    form_ajax_refs = {
        'submission': QueryAjaxModelLoader('submission', db.session, Submission, fields=['id'], page_size=10),
    }
    column_list = ('id', 'submission_id', 'metric', 'value')
    column_filters = ('id', 'submission_id', 'metric', 'value')

class ProtectedFileAdmin(FileAdmin):
    can_upload = False
    can_delete = False
    can_delete_dirs = False
    can_mkdir = False
    can_rename = False

    def is_accessible(self):
        if g.user:
            return g.user.is_admin()
        return False

def setup_admin(app):
    admin = Admin(app)
    admin.add_view(UserView(User, db.session, category='Tables'))
    admin.add_view(CourseView(Course, db.session, category='Tables'))
    admin.add_view(SubmissionView(Submission, db.session, category='Tables'))
    admin.add_view(SampleSubmissionView(SampleSubmission, db.session, category='Tables'))
    admin.add_view(AssignmentView(Assignment, db.session, category='Tables'))
    admin.add_view(AssignmentGroupView(AssignmentGroup, db.session, category='Tables'))
    admin.add_view(AssignmentGroupMembershipView(AssignmentGroupMembership, db.session, category='Tables'))
    admin.add_view(AssignmentTagView(AssignmentTag, db.session, category='Tables'))
    admin.add_view(AuthenticationView(Authentication, db.session, category='Tables'))
    admin.add_view(RoleView(Role, db.session, category='Tables'))
    admin.add_view(LogView(SubmissionLog, db.session, category='Tables'))
    # TODO: Other logs tables
    admin.add_view(ReviewView(Review, db.session, category='Tables'))
    admin.add_view(ReportView(Report, db.session, category='Tables'))
    admin.add_view(InviteView(Invite, db.session, category='Tables'))
    admin.add_view(GradeHistoryView(GradeHistory, db.session, category='Tables'))
    admin.add_view(SubmissionCountView(SubmissionCounts, db.session, category='Tables'))

    # admin.add_view(FileAdmin(app.config['BLOCKPY_LOG_DIR'], base_url='/admin/code_logs/', name='Disk Logs'))
    # TODO: Add redis console
    admin.add_view(ProtectedFileAdmin(app.config['UPLOADS_DIR'], '', name='File Uploads'))
    # TODO: Figure out how to make multiple fileadmin work
    report_dir = ProtectedFileAdmin(app.config['REPORT_DIR'], '', name='Reports')
    report_dir.endpoint = 'ReportFiles'
    admin.add_view(report_dir)
    return admin
