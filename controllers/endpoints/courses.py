from datetime import datetime, timezone
from pprint import pprint
from collections import defaultdict
import json
from natsort import natsorted

from flask_wtf import Form
from wtforms import IntegerField, BooleanField, StringField, SubmitField, SelectField, TextAreaField, HiddenField

from flask import Blueprint, send_from_directory
from flask import Flask, redirect, url_for, session, request, jsonify, g, \
    make_response, Response, render_template, flash, abort, current_app

from common.highlighters import strip_tags
from controllers.auth import get_user
from controllers.helpers import (get_lti_property, require_request_parameters, login_required,
                                 require_course_instructor, require_course_grader, get_select_menu_link,
                                 check_resource_exists, get_course_id, ajax_success, ajax_failure, maybe_int,
                                 maybe_bool, require_admin, check_course_unlocked,
                                 get_assignments_in_groups, make_log_entry)
from models.data_formats.report import make_report
from models import db, AssignmentGroup
from models.data_formats.portation import export_bundle
from models.enums import USER_DISPLAY_ROLES, SubmissionLogEvent
from models.user import User
from models.course import Course
from models.role import Role
from models.submission import Submission
from models.assignment import Assignment
from models.report import Report
from models.log_tables import SubmissionLog as Log
from tasks import tasks

courses = Blueprint('courses', __name__, url_prefix='/courses')


class AddCourseForm(Form):
    name = StringField("Name", description="A title for the course, shown when navigating to the course on BlockPy.")
    visibility = SelectField('Visibility',
                             choices=[('private', 'Private'), ('public', 'Public'),
                                      ('archived', 'Archived')],
                             description="Public courses are visible to all users, but private courses are not visible outside of folks with roles in that course. Archived courses are concluded courses that should not be shown anymore (they can be restored). ")
    term = StringField("Term")
    url = StringField("URL", description="A unique URL for the course. Must be different from any other URLs for other courses. I recommend using underscores.")
    submit = SubmitField("Add new course")


SETTINGS_EXPLANATION = """
Additional JSON settings for the course
"""

class EditCourseForm(AddCourseForm):
    id = HiddenField("id", description="The ID of the course, used to identify it in the database.")
    settings = TextAreaField("Settings", description=SETTINGS_EXPLANATION)
    submit = SubmitField("Edit course")

@courses.route('/add', methods=['GET', 'POST'])
@courses.route('/add/', methods=['GET', 'POST'])
@login_required
def add():
    """
    Create a new course with the given information
    """
    add_form = AddCourseForm(request.form)
    if request.method == 'POST':
        new_course = Course.new(name=add_form.name.data,
                                owner_id=g.user.id,
                                visibility=add_form.visibility.data,
                                term=add_form.term.data,
                                url=add_form.url.data)
        if new_course:
            flash('New course added')
            return redirect(url_for('courses.index'))
        else:
            flash('Course not created; Non-unique URL perhaps?')
    return render_template('courses/add.html', add_form=add_form)


@courses.route('/edit/<course_id>', methods=['GET', 'POST'])
@courses.route('/edit/<course_id>/', methods=['GET', 'POST'])
@login_required
def edit(course_id):
    """
    Edit an existing course.
    """
    user, user_id = get_user()
    if not user.in_course(course_id):
        flash(f"You are not in {course_id}")
        return redirect(url_for('courses.index'))
    course = Course.by_id(course_id)
    if not user.is_instructor(course_id):
        flash(f"You are not an instructor in course: {course_id}")
        return redirect(url_for("courses.index"))

    edit_form = EditCourseForm(request.form, obj=course)
    if request.method == 'POST':
        course_id = edit_form.id.data
        course = Course.by_id(course_id)
        # Verify exists
        check_resource_exists(course, "Course", course_id)
        # Verify permissions
        require_course_instructor(g.user, course_id)
        check_course_unlocked(course)
        # Edit the course
        course_url = edit_form.url.data
        if not Course.check_url_is_unique(course_url, course_id):
            flash('Course not edited; URLs must be unique.')
        else:

            # Safety check the settings is proper JSON
            try:
                json.loads(edit_form.settings.data)
            except json.JSONDecodeError as e:
                flash(f"Settings are not valid JSON: {e}")
                modified = False
            else:
                modified = course.edit(name=edit_form.name.data,
                                       visibility=edit_form.visibility.data,
                                       term=edit_form.term.data,
                                       url=edit_form.url.data,
                                       settings=edit_form.settings.data)
            if modified:
                flash('Course settings updated')
            else:
                flash('No modifications were made')
    return render_template('courses/edit.html', edit_form=edit_form, course=course, course_id=course_id)


@courses.route('/remove/', methods=['GET', 'POST'])
@courses.route('/remove', methods=['GET', 'POST'])
@require_request_parameters('course_id')
@login_required
def remove_course():
    course_id = int(request.values.get('course_id'))
    course = Course.by_id(course_id)
    # Verify exists
    check_resource_exists(course, "Course", course_id)
    # Verify permissions
    require_admin(g.user)
    check_course_unlocked(course)
    # Perform action
    Course.remove(course_id)
    flash('Course removed')
    return redirect(url_for('courses.index'))


@courses.route('/change_course_visibility/', methods=['GET', 'POST'])
@courses.route('/change_course_visibility', methods=['GET', 'POST'])
@require_request_parameters('course_id', 'visibility')
@login_required
def change_course_visibility():
    course_id = int(request.values.get('course_id'))
    visibility = request.values.get('visibility')
    course = Course.by_id(course_id)
    # Verify exists
    check_resource_exists(course, "Course", course_id)
    # Verify permissions
    require_course_instructor(g.user, course_id)
    check_course_unlocked(course)
    # Perform action
    success = Course.change_course_visibility(course_id, visibility)
    if success:
        flash(f'Course {course.url} visibility set to f{visibility}')
    return redirect(url_for('courses.index'))


@courses.route('/pin_course/', methods=['GET', 'POST'])
@courses.route('/pin_course', methods=['GET', 'POST'])
@require_request_parameters('course_id', 'pin_status')
@login_required
def pin_course():
    course_id = int(request.values.get('course_id'))
    pin_status = maybe_bool(request.values.get('pin_status'))
    course = Course.by_id(course_id)
    # Verify exists
    check_resource_exists(course, "Course", course_id)
    # Verify permissions
    require_course_instructor(g.user, course_id)
    check_course_unlocked(course)
    # Perform action
    try:
        course.set_setting("pinned", pin_status, g.user)
        return ajax_success({"updatedSettings": course.settings})
    except Exception as e:
        return ajax_failure("Failed to set pinned status:"+str(e))


@courses.route('/rename', methods=['GET', 'POST'])
@courses.route('/rename/', methods=['GET', 'POST'])
@require_request_parameters('course_id', 'name')
@login_required
def rename_course():
    course_id = int(request.values.get('course_id'))
    course = Course.by_id(course_id)
    # Verify exists
    check_resource_exists(course, "Course", course_id)
    # Verify permissions
    require_course_instructor(g.user, course_id)
    check_course_unlocked(course)
    # Perform action
    new_name = request.values.get('name')
    Course.rename(course_id, new_name)
    return jsonify(success=True)


@courses.route('/add_canvas/', methods=['GET', 'POST'])
@courses.route('/add_canvas', methods=['GET', 'POST'])
@login_required
def add_canvas():
    """
    Create a new assignment with the given information
    """
    return render_template('courses/add_canvas.html')


@courses.route('/<course_id>/', methods=['GET', 'POST'])
@courses.route('/<course_id>', methods=['GET', 'POST'])
def course(course_id):
    user, user_id = get_user()
    if course_id.isdigit():
        course_id = int(course_id)
        course: Course = Course.by_id(course_id)
    else:
        course: Course = Course.by_url(course_id)
    check_resource_exists(course, "Course", course_id)
    if not user.in_course(course_id) and course.visibility != "public":
        flash("You are not a user in this course and/or it is not public.")
        return redirect(url_for('courses.index'))
    is_instructor = user.is_instructor(course_id)
    is_grader = user.is_grader(course_id)
    textbooks = course.get_textbooks()
    return render_template('courses/course.html',
                               course=course,
                               course_id=course_id,
                               is_grader=is_grader,
                               is_instructor=is_instructor,
                               textbooks=textbooks)
    #return view_assignments(course_id)


@courses.route('/assignments/<course_id>/', methods=['GET', 'POST'])
@courses.route('/assignments/<course_id>', methods=['GET', 'POST'])
@login_required
def assignments(course_id):
    user, user_id = get_user()
    # TODO: Check if public course
    if not g.user.in_course(course_id):
        return redirect(url_for('courses.index'))
    assignments = Assignment.get_available()
    groups = AssignmentGroup.query.all()
    course_groups = Course.get_all_groups()
    editable_courses = g.user.get_editable_courses()
    course = Course.by_id(course_id)

    return render_template('courses/assignments.html',
                           assignments=assignments,
                           groups=groups,
                           editable_courses=editable_courses,
                           course_groups=course_groups,
                           course_id=course_id,
                           course=course)

@courses.route('/users/', methods=['GET'])
@courses.route('/users', methods=['GET'])
@login_required
def users():
    user_ids = request.values.get('user_ids', "")
    course_id = get_course_id()
    user, user_id = get_user()
    if course_id is None:
        return ajax_failure("You are not in a course context.")
    is_grader = user.is_grader(course_id)
    if not is_grader and user_ids != str(user_id):
        return ajax_failure("You do not have permissions to see those users.", 403)
    users = []
    errors = []
    # If blank, then get all the available users
    if not user_ids:
        course = Course.by_id(course_id)
        check_resource_exists(course, "Course", course_id)
        user_roles = course.get_users()
        user_data = {}
        for role, user in user_roles:
            if user not in user_data:
                user_data[user] = user.encode_json()
                user_data[user]['roles'] = []
            user_data[user]['roles'].append(role.encode_json())
        users.extend(user_data.values())
    # Otherwise, get the subset suggested
    else:
        for user_id in user_ids.split(","):
            if not user_id.isdigit():
                errors.append(f"Unknown User ID: {user_id!r}")
                continue
            user_id = int(user_id)
            # With Course Role Information
            user = User.by_id(user_id)
            check_resource_exists(user, "User", user_id)
            user_data = user.encode_json()
            user_data['roles'] = [r.encode_json() for r in user.get_course_roles(course_id)]
            users.append(user_data)
    return ajax_success(dict(users=users, errors=errors))


@courses.route('/manage_assignments/<course_id>/', methods=['GET', 'POST'])
@courses.route('/manage_assignments/<course_id>', methods=['GET', 'POST'])
@login_required
def manage_assignments(course_id):
    user, user_id = get_user()
    if not user.in_course(course_id):
        flash("You are not in course_id")
        return redirect(url_for('courses.index'))
    course = Course.by_id(course_id)
    if user.is_instructor(course_id):
        flash(f"You are not an instructor in course: {course_id}")
        return redirect(url_for("courses.index"))
    return render_template('courses/manage_assignments.html',
                           course_id=course_id, user=user, course=course)


@courses.route('/manage_assignments/get/', methods=['GET'])
@courses.route('/manage_assignments/get', methods=['GET'])
@login_required
def get_assignments():
    course_id = request.values.get('course_id')
    if not g.user.in_course(course_id):
        return redirect(url_for('courses.index'))
    groups = [g.encode_json() for g in AssignmentGroup.query.all()]

    return ajax_success(dict(
                           groups=groups,
                           course_id=course_id))


@courses.route('/watch_events/', methods=['GET'])
@courses.route('/watch_events', methods=['GET'])
@login_required
def watch_events():
    course_id = get_course_id(False)
    user, user_id = get_user()
    return render_template('courses/watch_events.html', course_id=course_id, user=user)



@courses.route('/view_assignments/<course_id>/', methods=['GET', 'POST'])
@courses.route('/view_assignments/<course_id>', methods=['GET', 'POST'])
@login_required
def view_assignments(course_id):
    course = Course.by_id(course_id)
    if not g.user.in_course(course_id) and course.visibility != "public":
        return redirect(url_for('courses.index'))
    assignments = Assignment.by_course(course_id)
    default_assignment = course.get_default_assignment()
    groups = natsorted(AssignmentGroup.by_course(course_id), key=lambda g: g.name)
    is_instructor = g.user.is_instructor(course.id)
    is_grader = g.user.is_grader(course.id)
    return render_template('courses/view_assignments.html', assignments=assignments,
                           groups=groups, course=course, is_instructor=is_instructor,
                           is_grader=is_grader,
                           course_id=course_id, default_assignment=default_assignment)


@courses.route('/', methods=['GET', 'POST'])
def index():
    """
    List all of the courses associated with the user.
    """
    user, user_id = get_user()
    # Get this user's course with their roles
    my_courses = []
    if user:
        my_courses = user.get_courses()
    # Get all public courses
    public_courses = Course.get_public()

    return render_template('courses/index.html',
                           user=user,
                           my_courses=my_courses,
                           public_courses=public_courses)


@courses.route('/manage_users/<course_id>/', methods=['GET', 'POST'])
@courses.route('/manage_users/<course_id>', methods=['GET', 'POST'])
@login_required
def manage_users(course_id):
    ''' List all the users in the course '''
    if not g.user.in_course(course_id):
        return redirect(url_for('courses.index'))
    is_instructor = g.user.is_instructor(int(course_id))
    students = Course.by_id(int(course_id)).get_users()
    return render_template('courses/manage_users.html',
                           students=students,
                           course_id=course_id,
                           is_instructor=is_instructor)


class AddUsersForm(Form):
    # invite = BooleanField("Add Without Invitation")
    # send_email = BooleanField('Send Email')
    new_users = TextAreaField("Emails")
    role = SelectField("Role", choices=list(USER_DISPLAY_ROLES.items()))
    submit = SubmitField("Add student")


@courses.route('/add_users/<course_id>/', methods=['GET', 'POST'])
@courses.route('/add_users/<course_id>', methods=['GET', 'POST'])
@login_required
def add_users(course_id):
    ''' Generate a form to add a student '''
    if not g.user.is_instructor(int(course_id)):
        return redirect(url_for('courses.index'))
    course_id = int(course_id)
    add_form = AddUsersForm(request.form)
    if request.method == 'POST':
        newly_created = []
        newly_added = []
        for new_email in add_form.new_users.data.split("\n"):
            first_name, last_name = '', ''
            if '|' in new_email:
                first_name, last_name, new_email = new_email.split('|', maxsplit=2)
            new_user = User.find_student(email=new_email.strip())
            if new_user is None:
                new_user = current_app.user_datastore.create_user(first_name=first_name,
                                                                  last_name=last_name,
                                                                  email=new_email,
                                                                  confirmed_at=datetime.now(timezone.utc))
                newly_created.append(new_user)
            new_role = add_form.role.data
            # TODO: Update this to reflect new enums
            if new_role in ('student', 'learner') and not new_user.is_student(course_id):
                new_user.add_role('learner', course_id=course_id)
                newly_added.append(new_user)
            elif new_role == 'teachingassistant' and not new_user.is_grader(course_id):
                new_user.add_role('teachingassistant', course_id=course_id)
                newly_added.append(new_user)
            elif new_role == 'instructor' and not new_user.is_instructor(course_id):
                new_user.add_role('instructor', course_id=course_id)
                newly_added.append(new_user)
            # TODO: Add an invite for the course and that user
            # TODO: Send an email to reset their password
        flash('New users added: ' + ", ".join([u.email for u in newly_added]))
        return redirect(url_for('courses.manage_users', course_id=course_id))
    return render_template('courses/add_users.html', add_form=add_form, course_id=course_id)


@courses.route('/remove_role/<role_id>/', methods=['GET', 'POST'])
@courses.route('/remove_role/<role_id>', methods=['GET', 'POST'])
@login_required
def remove_role(role_id):
    ''' Endpoint to bounce a student from the course '''
    role = Role.by_id(int(role_id))
    if role is None:
        return "Role not found"
    course_id = role.course_id
    is_instructor = g.user.is_instructor(course_id)
    if not is_instructor:
        return "You're not an instructor in this course!"
    Role.remove(int(role_id))
    return redirect(url_for('courses.manage_users', course_id=course_id))


@courses.route('/change_role/', methods=['GET', 'POST'])
@courses.route('/change_role', methods=['GET', 'POST'])
@login_required
def change_role():
    ''' Endpoint to change the role of a student '''
    role_id = maybe_int(request.values.get("role_id"))
    new_role = request.values.get("new_role")
    if role_id is None or new_role is None:
        return "Invalid role_id or new_role not given"
    role = Role.by_id(role_id)
    if role is None:
        return "Role not found"
    course_id = role.course_id
    is_instructor = g.user.is_instructor(course_id)
    if not is_instructor:
        return "You're not an instructor in this course!"
    role.update_role(new_role)
    return ajax_success({"new_role": new_role})



def grader_dashboard(user, course_id):
    pending_review = [(s, u, a) for (s, u, a) in Submission.by_pending_review(course_id)
                      if u.is_student(course_id)]
    users = {user.email: user.encode_json() for _, user, _ in pending_review}
    is_instructor = user.is_instructor(course_id)
    course = Course.by_id(course_id)
    textbooks = course.get_textbooks()

    return render_template('courses/dashboard_grader.html', embed=True,
                           course_id=course_id, user=user, pending_review=pending_review,
                           users=users, is_instructor=is_instructor, textbooks=textbooks)

@courses.route('dashboard/', methods=['GET', 'POST'])
@courses.route('dashboard', methods=['GET', 'POST'])
def dashboard():
    force_default_assignment = maybe_bool(request.values.get('force_default_assignment', "false"))
    if 'user' not in g and not g.user:
        return "You are not logged in."
    course_id = get_course_id()
    user, user_id = get_user()
    if course_id is None:
        return "You are not in a course context."
    is_grader = user.is_grader(course_id)
    if is_grader and not force_default_assignment:
        return grader_dashboard(user, course_id)

    course = Course.by_id(course_id)
    assignment = course.get_default_assignment()
    if force_default_assignment and assignment is not None:
        return redirect(url_for("blockpy.load", assignment_id=assignment.id,
                                course_id=course_id, user_id=user_id, force_download=False,
                                embed=True))
    else:
        # Sub - Assign - Group
        textbooks = course.get_textbooks()
        grouped_assignments = natsorted(course.get_users_submitted_assignments_grouped(user_id),
                                        key=lambda r: (
                                        r.AssignmentGroup.name if r.AssignmentGroup is not None else "~~~~~~~~",
                                        r.Assignment.title()))
        assignments_by_group = {}
        for row in grouped_assignments:
            #group_name = row.AssignmentGroup.name if row.AssignmentGroup is not None else None
            assignments_by_group.setdefault(row.AssignmentGroup, []).append(
                (row.Submission, row.Assignment, row.AssignmentGroup)
            )
        # Horrifying hack to move Ungrouped elements to end
        assignments_by_group[None] = assignments_by_group.pop(None, None)
        return render_template('courses/dashboard.html', embed=True,
                               course_id=course_id, user=user, textbooks=textbooks,
                               assignments_by_group=assignments_by_group)


@courses.route('/config/', methods=['GET', 'POST'])
@courses.route('/config', methods=['GET', 'POST'])
def config():
    """ Provide course configuration
    """
    return render_template('courses/config.html',
                           xml_content=render_template('courses/config.xml',
                                                       version=current_app.config['SITE_VERSION']))
    # return Response(render_template('courses/config.xml',
    #                                version=app.config['SITE_VERSION']),
    #                mimetype='text/xml')

@courses.route('/submissions_user/<course_id>/<owner_id>/', methods=['GET', 'POST'])
@courses.route('/submissions_user/<course_id>/<owner_id>', methods=['GET', 'POST'])
@login_required
def submissions_user(course_id, owner_id):
    ''' List all the users in the course '''
    course_id = int(course_id)
    course = Course.by_id(course_id)
    check_resource_exists(course, "Course", course_id)
    user, user_id = get_user()
    if course_id is not None:
        is_grader = user.is_grader(course_id)
    else:
        is_grader = False
    is_owner = user_id == maybe_int(owner_id)
    if not is_grader and not is_owner:
        return "You are not an instructor or the owner of the assignment!"
    owner = User.by_id(maybe_int(owner_id))
    assignments = natsorted(course.get_submitted_assignments(),
                            key=lambda r: r.name)
    all_subs = Submission.by_student(owner_id, course_id)
    all_subs = {s[0].assignment_id: s for s in all_subs}
    submissions = [all_subs.get(assignment.id, (None, owner, assignment))
                   for assignment in assignments]
    return render_template('courses/submissions_user.html',
                           course_id=course_id,
                           assignments=assignments,
                           submissions=submissions,
                           owner=owner,
                           is_instructor=is_grader)


@courses.route('/submissions_filter/<course_id>/', methods=['GET', 'POST'])
@courses.route('/submissions_filter/<course_id>', methods=['GET', 'POST'])
@login_required
def submissions_filter(course_id):
    ''' List all the users in the course '''
    is_grader = g.user.is_grader(int(course_id))
    if not is_grader:
        return "You are not an instructor or TA in this course!"
    course_id = int(course_id)
    course = Course.by_id(course_id)
    students = natsorted(course.get_students(), key=lambda r: r.name())
    grouped_assignments, assignments_by_group, group_headers, groups = get_assignments_in_groups(course)
    criteria = request.values.get("criteria", "none")
    search_key = int(request.values.get("search_key", "-1"))
    submissions = []
    if criteria == "student":
        all_subs = Submission.by_student(search_key, course_id)
        all_subs = {s[0].assignment_id: s for s in all_subs}
        submissions = [all_subs.get(row.Assignment.id, (None, None, row.Assignment))
                       for row in grouped_assignments]
    elif criteria == "assignment":
        all_subs = Submission.by_assignment(search_key, course_id)
        all_subs = {s[0].user_id: s for s in all_subs}
        submissions = [all_subs.get(student.id, (None, student, None))
                       for student in students]
    return render_template('courses/submissions_filter.html',
                           course_id=course_id,
                           course=course,
                           assignments_by_group=assignments_by_group,
                           group_headers=group_headers,
                           students=students,
                           submissions=submissions,
                           criteria=criteria,
                           search_key=search_key,
                           is_instructor=is_grader)


@courses.route('/submissions_specific/<submission_id>/', methods=['GET', 'POST'])
@courses.route('/submissions_specific/<submission_id>', methods=['GET', 'POST'])
@login_required
def submissions_specific(submission_id):
    ''' List all the users in the course '''
    submission, user, assignment = Submission.full_by_id(int(submission_id))
    if submission is None:
        return "Submission not found"
    course_id = submission.course_id
    if course_id is not None:
        is_instructor = g.user.is_instructor(int(course_id))
    else:
        is_instructor = False
    is_owner = g.user.id == submission.user_id
    if not is_instructor and not is_owner:
        return "You are not an instructor or the owner of the assignment!"
    return render_template('courses/submissions_specific.html',
                           submission=submission,
                           assignment=assignment,
                           user=user,
                           course_id=course_id)


@courses.route('/submissions_grid/<course_id>/', methods=['GET', 'POST'])
@courses.route('/submissions_grid/<course_id>', methods=['GET', 'POST'])
@login_required
def submissions_grid(course_id):
    ''' List all the users in the course '''
    course_id = get_course_id()
    user, user_id = get_user()
    # Check permissions
    require_course_grader(user, course_id)
    # Get course
    course = Course.by_id(course_id)
    # Organize the students and non-students
    users = course.get_users()
    students, non_students = set(), set()
    for role, user in users:
        if "learner" in role.name.lower():
            students.add(user)
        else:
            non_students.add(user)
            if user in students:
                students.remove(user)
    students = natsorted(students, key=lambda s: s.name())
    non_students = natsorted(non_students, key=lambda s: s.name())
    students = list(students) + list(non_students)
    # Get all the assignments
    assignments = natsorted(course.get_submitted_assignments_grouped(),
                            key=lambda r: r[0].name)
    grouped_assignments = defaultdict(list)
    total_points = 0
    for assignment, group in assignments:
        grouped_assignments[group].append(assignment)
        total_points += (assignment.points or 1)
    #assignment_groups = course.get_assignment_groups()
    submissions = {(s.assignment_id, s.user_id): s for s in course.get_submissions()}
    scores = {}
    for student in students:
        scores[student.id] = 0
        for assignment, group in assignments:
            if (assignment.id, student.id) in submissions:
                submission = submissions[(assignment.id, student.id)]
                scores[student.id] += ((assignment.points or 1)
                                       if submission.correct else
                                       (submission.score or 0)/100 * (assignment.points or 1))
    return render_template('courses/submissions_grid.html',
                           course_id=course_id,
                           students=students,
                           submissions=submissions,
                           total_points=total_points,
                           scores=scores,
                           assignment_groups=grouped_assignments,
                           grouped_assignments=grouped_assignments,
                           is_instructor=True)


@courses.route('/making_problems', methods=['GET', 'POST'])
@courses.route('/making_problems/', methods=['GET', 'POST'])
def making_problems():
    """
    Making problems instructions
    """

    return render_template('courses/making_problems.html')


def switch_course():
    # TODO: Create the ability to switch current course without going through canvas
    pass

# TODO: update course via JSON file or API


@courses.route('/fix_course_outcome_url/', methods=['GET', 'POST'])
@courses.route('/fix_course_outcome_url', methods=['GET', 'POST'])
@require_request_parameters('new_url')
@login_required
def fix_course_outcome_url():
    new_url = request.values.get("new_url")
    course_id = get_course_id()
    user, user_id = get_user()
    require_course_instructor(user, course_id)
    course = Course.by_id(course_id)
    course.update_endpoint(new_url)
    return ajax_success({"success": "True"})


def unpack(value):
    if isinstance(value, list):
        return value[0]
    return value


@courses.route('/student_report/', methods=['GET', 'POST'])
@courses.route('/student_report', methods=['GET', 'POST'])
@login_required
def student_report():
    ''' List all the users in the course '''
    course_id = get_course_id()
    user, user_id = get_user()
    student_id = maybe_int(request.values.get('user_id'))

    if course_id is not None:
        is_instructor = user.is_grader(int(course_id))
    else:
        is_instructor = False
    is_owner = user_id == student_id
    if not is_instructor and not is_owner:
        return "You are not an instructor or this specific student!"
    logs = Log.get_logs_for_user_course(course_id, student_id)
    assignment_ids = set(log.assignment_id for log in logs)
    assignments = {aid: Assignment.by_id(aid).encode_json() for aid in assignment_ids}
    groups = {}
    for aid in assignment_ids:
        group = AssignmentGroup.by_assignment(aid)
        if group:
            groups[aid] = group[0].encode_json()
    return ajax_success({
        'assignments': assignments,
        'groups': groups,
        'logs': [l.encode_json() for l in logs]
    })
    return "<br>\n".join(make_report([l.encode_json() for l in logs], assignments, groups))
    #return render_template('courses/student_report.html',
    #                       submission=submission,
    #                       assignment=assignment,
    #                       user=user,
    #                       course_id=course_id)


@courses.route("/list_grading_failures/", methods=["GET", "POST"])
@courses.route("/list_grading_failures", methods=["GET", "POST"])
@login_required
def list_grading_failures():
    course_id = get_course_id()
    user, user_id = get_user()
    # Load Resources
    course: Course = Course.by_id(course_id)
    # Check Resource Exists
    check_resource_exists(course, "Course", course_id)
    # Check permissions
    require_course_grader(g.user, course_id)
    is_grader = g.user.is_grader(int(course_id))
    # Get failed-to-grade submissions
    failures = course.get_grading_failures()
    return render_template("courses/grading_failures.html",
                           course_id=course_id,
                           assignments=assignments,
                           #students=students,
                           submissions=failures,
                           criteria='fails',
                           is_instructor=is_grader)


def bulk_assignment_editor_setup(all_submitted=False):
    course_id = get_course_id()
    user, user_id = get_user()
    # Load Resources
    course: Course = Course.by_id(course_id)
    # Check Resource Exists
    check_resource_exists(course, "Course", course_id)
    grouped_assignments = natsorted(course.get_assignments_grouped() if not all_submitted else course.get_submitted_assignments_grouped(),
                                    key=lambda r: (r.AssignmentGroup.name if r.AssignmentGroup is not None else "",
                                                   r.Assignment.name))
    # assignments = [a.Assignment for a in grouped_assignments]
    groups = {}
    for a in grouped_assignments:
        if a.AssignmentGroup not in groups:
            groups[a.AssignmentGroup] = []
        groups[a.AssignmentGroup].append(a.Assignment)
    # Verify permissions
    for group, assignments in groups.items():
        if group:
            require_course_instructor(g.user, group.course_id, f"This course has assignment group {group.id}")
        for assignment in assignments:
            require_course_instructor(g.user, assignment.course_id, f"This course has assignment {assignment.id}")
    return user, user_id, course, course_id, groups


@courses.route('/edit_points', methods=['GET', 'POST'])
@courses.route('/edit_points/', methods=['GET', 'POST'])
@login_required
def edit_points():
    user, user_id, course, course_id, groups = bulk_assignment_editor_setup()
    # Perform action
    if request.method == 'POST':
        check_course_unlocked(course)
        modified = []
        for group, assignments in groups.items():
            for assignment in assignments:
                target_field = f'assignment-points-{assignment.id}'
                points = maybe_int(request.values.get(target_field))
                if points is not None and assignment.points != points:
                    assignment.edit(dict(points=points))
                    modified.append(assignment.name or "(Missing Name)")
        flash("Modified: "+", ".join(modified))
        #if ip_ranges is not None:
        #    for assignment in assignment_group.get_assignments():
        #        assignment.edit(dict(ip_ranges=ip_ranges))
        #        assignment.update_setting("passcode", passcode)
        return redirect(request.url)
    # Result
    else:
        warning = ""
        return render_template('courses/edit_points.html',
                               course_id=course_id,
                               course=course,
                               groups=groups)


ATTRIBUTES_BY_LEVEL = {
    'group': [('name', str), ('url', str)],
    'assignment': [('name', str), ('url', str), ('hidden', maybe_bool), ('reviewed', maybe_bool), ('public', maybe_bool),
                   ('subordinate', maybe_bool)]
}

def get_updated_settings(group_or_assignment, obj):
    new_settings = {}
    if not obj:
        return new_settings
    for attribute, converter in ATTRIBUTES_BY_LEVEL[group_or_assignment]:
        target_field = f'{group_or_assignment}-{attribute}-{obj.id}'
        if target_field in request.values:
            original_value = request.values.get(target_field)
            value = converter(original_value)
            if original_value is not None and value is not None and getattr(obj, attribute) != value:
                new_settings[attribute] = value
    return new_settings

@courses.route('/edit_settings', methods=['GET', 'POST'])
@courses.route('/edit_settings/', methods=['GET', 'POST'])
@login_required
def edit_settings():
    user, user_id, course, course_id, groups = bulk_assignment_editor_setup()
    # Perform action
    if request.method == 'POST':
        check_course_unlocked(course)
        modified = []
        for group, assignments in groups.items():
            for assignment in assignments:
                new_settings = get_updated_settings('assignment', assignment)
                if new_settings:
                    assignment.edit(new_settings)
                    modified.append(f"Assignment: {assignment.name} ({assignment.id})"
                                    if assignment.name else f"Unknown Assignment: {assignment.id}")
            if group:
                new_settings = get_updated_settings('group', group)
                if new_settings:
                    group.edit(new_settings)
                    modified.append(f"Group: {group.name} ({group.id})"
                                     if group.name else f"Unknown Group: {group.id}")
        if modified:
            flash("Modified: " + ", ".join(modified))
        else:
            flash("No assignments modified")
        # if ip_ranges is not None:
        #    for assignment in assignment_group.get_assignments():
        #        assignment.edit(dict(ip_ranges=ip_ranges))
        #        assignment.update_setting("passcode", passcode)
        return redirect(request.url)
    return render_template('courses/edit_settings.html', course_id=course_id, course=course, groups=groups,
                           group_assignment_map=[[group.id if group else None,
                                                  [assignment.id for assignment in assignments]]
                                                 for group, assignments in groups.items()])


@courses.route('/edit_textbooks', methods=['GET', 'POST'])
@courses.route('/edit_textbooks/', methods=['GET', 'POST'])
@login_required
def edit_textbooks():
    user, user_id, course, course_id, groups = bulk_assignment_editor_setup()
    current_textbooks = course.get_textbooks()
    all_possible_textbooks = [textbook for textbook in Assignment.get_textbooks(user_id) if textbook not in current_textbooks]
    # Perform action
    if request.method == 'POST':
        check_course_unlocked(course)
        new_textbook_url = request.values.get('textbook_url', '')
        action = request.values.get("action", "")
        if not new_textbook_url or not action:
            flash(f"Could not take action '{action}' on textbook '{new_textbook_url}'")
            return redirect(request.url)
        action_taken = course.do_textbook_action(action, new_textbook_url, user_id)
        flash(action_taken)
        return redirect(request.url)
    # Result
    else:
        warning = ""
        return render_template('courses/edit_textbooks.html',
                               course_id=course_id,
                               course=course,
                               current_textbooks=current_textbooks,
                               all_possible_textbooks=all_possible_textbooks,
                               groups=groups)


@courses.route('/get_group_submission_links', methods=['GET', 'POST'])
@courses.route('/get_group_submission_links/', methods=['GET', 'POST'])
@login_required
def get_group_submission_links():
    course_id = get_course_id()
    user, user_id = get_user()
    assignment_group_id = maybe_int(request.values.get('assignment_group_id'))
    # Load Resources
    course: Course = Course.by_id(course_id)
    assignment_group: AssignmentGroup = AssignmentGroup.by_id(assignment_group_id)
    # Check exists
    check_resource_exists(assignment_group, "Assignment Group", assignment_group_id)
    # Check grader
    require_course_grader(user, course_id)
    # Get users
    students = course.get_students()
    return "\n".join([f"{student.name()}\t{student.email}\t" +
                      url_for('blockpy.view_submissions', _external=True,
                          assignment_group_id=assignment_group_id, course_id=course_id,
                          user_id=student.id, _scheme="https")
                      for student in students])


@courses.route('/export/', methods=['GET', 'POST'])
@courses.route('/export', methods=['GET', 'POST'])
def export():
    course_id = get_course_id(True)
    user, user_id = get_user()
    if not user.is_instructor(course_id):
        return abort(400, "Not an instructor in this course.")
    course = Course.by_id(course_id)
    check_resource_exists(course, "Course", course_id)
    groups = course.get_assignment_groups()
    assignment_and_memberships = course.get_assignments()
    assignments = [a for a, m in assignment_and_memberships]
    memberships = [m for a, m in assignment_and_memberships]
    bundle = export_bundle(groups=groups, assignments=assignments,
                           memberships=memberships)
    filename = course.get_filename()
    return Response(json.dumps(bundle, indent=2), mimetype='application/json',
                    headers={'Content-Disposition': 'attachment;filename={}'.format(filename)})

@courses.route('/pages/<course_id_or_url>/', methods=['GET', "POST"])
@courses.route('/pages/<course_id_or_url>', methods=["GET", "POST"])
def pages(course_id_or_url):
    user, user_id = get_user()
    # Load Resources
    course: Course = Course.by_id_or_url(course_id_or_url)
    # Check Resource Exists
    check_resource_exists(course, "Course", course_id_or_url)
    # Get all assignments
    grouped_assignments = natsorted(course.get_assignments_grouped(),
                                    key=lambda r: (r.AssignmentGroup.name if r.AssignmentGroup is not None else None,
                                                   r.Assignment.name))
    # Group and verify permissions
    if not user.in_course(course.id) and course.visibility != "public":
        return redirect(url_for('courses.index'))
    groups = {}
    for a in grouped_assignments:
        if not user.in_course(a.Assignment.course_id) and not a.Assignment.public:
            continue
        if a.AssignmentGroup not in groups:
            groups[a.AssignmentGroup] = []
        groups[a.AssignmentGroup].append(a.Assignment)
    # All ready
    return render_template('courses/textbook.html', course_id=course.id, course=course, groups=groups)


@courses.route('/check_similar', methods=['GET', 'POST'])
@courses.route('/check_similar/', methods=['GET', 'POST'])
@login_required
def check_similar():
    user, user_id, course, course_id, groups = bulk_assignment_editor_setup(all_submitted=True)
    if request.method == 'POST':
        assignment_id = maybe_int(request.form.get('assignment_id'))
        if not assignment_id:
            flash("No assignment selected")
            return redirect(request.url)
        other_student_threshold = maybe_int(request.form.get('other_student_threshold', 95))
        starter_change_threshold = maybe_int(request.form.get('starter_change_threshold', 95))
        minimum_file_length = maybe_int(request.form.get('minimum_file_length', 100))
        exclude_courses = [maybe_int(c) for c in request.form.get('exclude_courses', '').split(',')
                           if maybe_int(c) is not None]
        task = tasks.check_similarity_simple(user_id, assignment_id, exclude_courses, course_id,
                                             other_student_threshold=other_student_threshold,
                                             starter_change_threshold=starter_change_threshold,
                                             minimum_file_length=minimum_file_length)
        flash(f"Started a new similarity check, which may not appear until you reload the page: {task}")
        return redirect(request.url)
    existing_reports = Report.by_course(course_id, "check_similarity_simple")
    return render_template('assignments/similarity.html',
                           course_id=course_id,
                           course=course,
                           groups=groups,
                           existing_reports=existing_reports)

@courses.route('/bulk_groups', methods=['GET', 'POST'])
@courses.route('/bulk_groups/', methods=['GET', 'POST'])
@login_required
def bulk_groups():
    user, user_id, course, course_id, groups = bulk_assignment_editor_setup(True)
    # Perform action
    if request.method == 'POST':
        # request.values.get
        # flash("Modified: "+", ".join(modified))
        #if ip_ranges is not None:
        #    for assignment in assignment_group.get_assignments():
        #        assignment.edit(dict(ip_ranges=ip_ranges))
        #        assignment.update_setting("passcode", passcode)
        return redirect(request.url)
    # Result
    else:
        return render_template('courses/export_groups.html',
                               course_id=course_id,
                               course=course,
                               groups=groups)

@courses.route('/modify_time', methods=['GET', 'POST'])
@courses.route('/modify_time/', methods=['GET', 'POST'])
@login_required
def modify_time():
    course_id = get_course_id(False)
    user, user_id = get_user()
    student_id = maybe_int(request.values.get("student_id", ""))
    assignment_ids = request.values.get("assignment_ids", "")
    amount = request.values.get("amount", "")
    # Check permissions
    require_course_instructor(g.user, course_id)
    # Load Resources
    course = Course.by_id(course_id)
    student = User.by_id(student_id)
    check_resource_exists(student, "User", student_id)
    check_resource_exists(course, "Course", course_id)
    # Load or create the submission for the assignments of this user
    new_limits = []
    for assignment_id in assignment_ids.split(","):
        assignment_id = maybe_int(assignment_id)
        if assignment_id is None:
            continue
        assignment = Assignment.by_id(assignment_id)
        submission = assignment.load_or_new_submission(student_id, course_id)
        submission.edit(dict(time_limit=amount))
        make_log_entry(submission.id, submission.version, assignment_id, assignment.version,
                       course_id, student_id, SubmissionLogEvent.EXTEND_TIME,
                       message=f"User {user_id} set time limit to `{amount}`")
        shown_amount = amount if amount else "default"
        new_limits.append({"assignment": assignment.encode_json(), "time_limit": shown_amount})
    return ajax_success({'new_limits': new_limits})

@courses.route('/manage_time', methods=['GET', 'POST'])
@courses.route('/manage_time/', methods=['GET', 'POST'])
@login_required
def manage_time():
    course_id = get_course_id(False)
    user, user_id = get_user()
    chosen_assignment_ids = request.values.get("assignment_ids", "")
    # Check permissions
    require_course_instructor(g.user, course_id)
    # Load Resources
    course = Course.by_id(course_id)
    # Get all timed assignments that are available to this user
    all_timed_assignments = Assignment.get_timed_assignments()
    all_timed_assignments = {a.id: a for a in all_timed_assignments}

    if chosen_assignment_ids:
        chosen_assignment_ids = [int(aid) for aid in chosen_assignment_ids.split(",") if maybe_int(aid) is not None]
    else:
        chosen_assignment_ids = []

    # Get all the users in the course
    all_users = course.get_users()

    # Get the submissions for the chosen assignments, grouped by user
    submissions_by_user = {
        user.id: [
            Submission.get_submission(aid, user.id, course_id)
            for aid in chosen_assignment_ids
        ]
        for role, user in all_users
    }

    all_users.sort(key=lambda ru: (-sum(len(s.time_limit) if s else 0
                                       for s in submissions_by_user[ru[1].id]),
                                   -len(submissions_by_user[ru[1].id]),
                                   ru[1].name()
                                   ))

    return render_template("courses/manage_time.html",
                            course_id=course_id,
                            course=course,
                            all_timed_assignments=all_timed_assignments,
                            chosen_assignment_ids=chosen_assignment_ids,
                            all_users=all_users,
                            submissions_by_user=submissions_by_user
                           )