import json

from flask import Blueprint, send_from_directory, Response, render_template, flash, abort
from flask import Flask, redirect, url_for, session, request, jsonify, g, current_app

from common.maybe import maybe_bool
from controllers.auth import get_user
from controllers.helpers import (require_request_parameters, require_course_instructor, login_required,
                                 require_course_adopter,
                                 check_resource_exists, get_select_menu_link, get_course_id, ajax_success,
                                 maybe_int, require_course_grader, make_log_entry, abort_with_failure)
from models import Course, Submission, AssignmentLog

from models.enums.logs import AssignmentLogEvent
from models.assignment import Assignment
from models.assignment_group import AssignmentGroup
from models.assignment_group_membership import AssignmentGroupMembership
from models.assignment_group_variation import AssignmentGroupVariation
from models.data_formats.portation import export_bundle, import_bundle, export_zip, export_pdf_zip
from models.role import Role
from models.enums.roles import UserRoles

blueprint_assignment_group = Blueprint('assignment_group', __name__, url_prefix='/assignment_group')


@blueprint_assignment_group.route('/add', methods=['GET', 'POST'])
@blueprint_assignment_group.route('/add/', methods=['GET', 'POST'])
@require_request_parameters('course_id', 'name')
@login_required
def add_group():
    ''' Adds a group to a course'''
    # Get arguments
    course_id = int(request.values.get('course_id'))
    new_name = request.values.get('name')
    new_url = request.values.get('url')
    is_embedded = ('embed' == request.values.get('menu', "select"))
    # Verify permissions
    require_course_instructor(g.user, course_id)
    # Perform action
    assignment_group = AssignmentGroup.new(owner_id=g.user.id, course_id=course_id,
                                           name=new_name, url=new_url)
    # Result
    select_url = get_select_menu_link(assignment_group.id,
                                      assignment_group.name, is_embedded, True)
    return jsonify(success=True, id=assignment_group.id, url=assignment_group.url,
                   link=assignment_group.get_select_url(),
                   name=assignment_group.name, select=select_url)


@blueprint_assignment_group.route('/fork', methods=['GET', 'POST'])
@blueprint_assignment_group.route('/fork/', methods=['GET', 'POST'])
@require_request_parameters('assignment_group_id')
@login_required
def fork_group():
    ''' Adds a group to a course'''
    # Get arguments
    assignment_group_id = int(request.values.get('assignment_group_id'))
    assignment_group = AssignmentGroup.by_id(assignment_group_id)
    is_embedded = ('embed' == request.values.get('menu', "select"))
    # Verify exists
    check_resource_exists(assignment_group, "Assignment Group", assignment_group_id)
    # Verify permissions
    require_course_instructor(g.user, assignment_group.course_id)
    # Perform action
    new_assignment_group, assignments = assignment_group.fork(new_owner_id=g.user.id,
                                                              new_course_id=assignment_group.course_id)
    # Result
    select_url = get_select_menu_link(new_assignment_group.id, new_assignment_group.name, is_embedded, True)
    return jsonify(success=True, id=new_assignment_group.id,
                   link=new_assignment_group.get_select_url(),
                   name=new_assignment_group.name, select=select_url)


@blueprint_assignment_group.route('/remove', methods=['GET', 'POST'])
@blueprint_assignment_group.route('/remove/', methods=['GET', 'POST'])
@require_request_parameters('assignment_group_id')
@login_required
def remove_group():
    ''' Removes a group from a course'''
    assignment_group_id = int(request.values.get('assignment_group_id'))
    assignment_group = AssignmentGroup.by_id(assignment_group_id)
    # Verify exists
    check_resource_exists(assignment_group, "Assignment Group", assignment_group_id)
    # Verify permissions
    require_course_instructor(g.user, assignment_group.course_id)
    # Perform action
    AssignmentGroup.remove(assignment_group.id)
    # Result
    return jsonify(success=True)


@blueprint_assignment_group.route('/edit', methods=['GET', 'POST'])
@blueprint_assignment_group.route('/edit/', methods=['GET', 'POST'])
@require_request_parameters('assignment_group_id', 'new_name')
@login_required
def edit_group():
    # Get arguments
    assignment_group_id = int(request.values.get('assignment_group_id'))
    assignment_group = AssignmentGroup.by_id(assignment_group_id)
    new_name = request.values.get('new_name')
    new_url = request.values.get('new_url')
    # Verify exists
    check_resource_exists(assignment_group, "Assignment Group", assignment_group_id)
    # Verify permissions
    require_course_instructor(g.user, assignment_group.course_id)
    # Perform action
    changed = assignment_group.edit(dict(name=new_name, url=new_url))
    # Result
    return jsonify(success=True, name=assignment_group.name,
                   link=assignment_group.get_select_url(),
                   url=assignment_group.url)


@blueprint_assignment_group.route('/move_membership', methods=['GET', 'POST'])
@blueprint_assignment_group.route('/move_membership/', methods=['GET', 'POST'])
@require_request_parameters('assignment_id', 'old_group_id', 'new_group_id')
@login_required
def move_membership():
    # Get arguments
    assignment_id = int(request.values.get('assignment_id'))
    old_group_id = int(request.values.get('old_group_id'))
    new_group_id = int(request.values.get('new_group_id'))
    assignment = Assignment.by_id(assignment_id)
    # Verify exists
    check_resource_exists(assignment, "Assignment", assignment_id)
    # Verify permissions
    require_course_instructor(g.user, assignment.course_id)

    # Verify permissions
    if new_group_id != -1:
        new_assignment_group = AssignmentGroup.by_id(new_group_id)
        require_course_instructor(g.user, new_assignment_group.course_id)
    if old_group_id != -1:
        old_assignment_group = AssignmentGroup.by_id(old_group_id)
        require_course_instructor(g.user, old_assignment_group.course_id)
    # Perform action
    AssignmentGroupMembership.move_assignment(assignment_id, new_group_id)
    # Result
    return jsonify(success=True)


@blueprint_assignment_group.route('/export/', methods=['GET', 'POST'])
@blueprint_assignment_group.route('/export', methods=['GET', 'POST'])
@require_request_parameters('assignment_group_id')
def export():
    assignment_group_id = int(request.values.get('assignment_group_id'))
    assignment_group = AssignmentGroup.by_id(assignment_group_id)
    course_id = get_course_id(True)
    user, user_id = get_user()
    # Verify exists
    check_resource_exists(assignment_group, "Assignment Group", assignment_group_id)
    # Verify permissions
    require_course_instructor(g.user, assignment_group.course_id)
    # Get linked data
    assignments = assignment_group.get_assignments()
    memberships = assignment_group.get_memberships()
    # Verify permissions of linked resources
    for assignment in assignments:
        require_course_instructor(g.user, assignment.course_id)
    # Perform action
    bundle = export_bundle(groups=[assignment_group], assignments=assignments,
                           memberships=memberships)
    filename = assignment_group.get_filename()
    return Response(json.dumps(bundle, indent=2), mimetype='application/json',
                    headers={'Content-Disposition': 'attachment;filename={}'.format(filename)})


@blueprint_assignment_group.route('/edit_security_settings', methods=['GET', 'POST'])
@blueprint_assignment_group.route('/edit_security_settings/', methods=['GET', 'POST'])
@login_required
def edit_security_settings():
    # Get arguments
    assignment_group_id = maybe_int(request.values.get('assignment_group_id'))
    assignment_group_url = request.values.get("assignment_group_url")
    if assignment_group_id is None and not assignment_group_url:
        return render_template('courses/edit_security.html',
                               group_name=None,
                               ip_ranges="",
                               passcode="",
                               warning="Set an assignment group id or url via the URL.")
    if not assignment_group_id:
        assignment_group = AssignmentGroup.by_url(assignment_group_url)
    else:
        assignment_group = AssignmentGroup.by_id(assignment_group_id)
        assignment_group_id = assignment_group_url
    ip_ranges = request.values.get('ip_ranges')
    protected_ip_ranges = request.values.get('protected_ip_ranges')
    passcode = request.values.get('passcode')
    # Verify exists
    check_resource_exists(assignment_group, "Assignment Group", assignment_group_id)
    # Verify permissions
    require_course_instructor(g.user, assignment_group.course_id)
    # Perform action
    if request.method == 'POST':
        assignments = assignment_group.get_assignments()
        if ip_ranges is not None:
            message = []
            for assignment in assignments:
                is_instructor =g.user.is_instructor(assignment.course_id)
                # Update protected_ip_ranges
                if is_instructor:
                    assignment.update_setting('protected_ip_ranges', protected_ip_ranges)
                # Update ip_ranges
                old_ranges = assignment.ip_ranges
                #if old_ranges != ip_ranges:
                if assignment.update_ip_address(ip_ranges, is_instructor):
                    message.append(f"{assignment.name} ip_ranges is now <code>{assignment.ip_ranges}</code>")
                else:
                    message.append(f"Failed to update {assignment.name} ip_ranges.")
                # Update passcode
                if g.user.is_instructor(assignment.course_id):
                    if assignment.update_setting("passcode", passcode):
                        message.append(f"{assignment.name} passcode to <code>{passcode}</code>")
                # Record a log of this
                AssignmentLog.new(assignment.id, assignment.version,
                                  assignment.course_id, g.user.id, AssignmentLogEvent.EDIT,
                                  "assignment_settings.blockpy",
                                  json.dumps({
                                   "is_instructor": is_instructor,
                                   "old_ranges": old_ranges,
                                   "ip_ranges": ip_ranges,
                                   "protected_ip_ranges": protected_ip_ranges,
                                   "passcode": passcode
                               }), "", "")
            if message:
                flash("Updating:<br>" + "<br>".join(message))
            else:
                flash("No updates made.")
        return redirect(request.url)
    # Result
    else:
        assignments = assignment_group.get_assignments()
        passcode = assignments[0].get_setting("passcode", "")
        ip_ranges = merge_assignment_ranges([assignment.ip_ranges for assignment in assignments])
        protected_ip_ranges = merge_assignment_ranges([assignment.get_setting('protected_ip_ranges', '')
                                                       for assignment in assignments])
        return render_template('courses/edit_security.html',
                               group_name=assignment_group.name,
                               protected_ip_ranges=protected_ip_ranges,
                               is_instructor=g.user.is_instructor(assignment_group.course_id),
                               ip_ranges=ip_ranges if ip_ranges else "",
                               passcode=passcode if passcode else "",
                               warning="")


def merge_assignment_ranges(set_of_ranges):
    ip_ranges = [ip_range.strip()
                 for ip_ranges in set_of_ranges
                 for ip_range in ip_ranges.split(",")
                 if ip_range.strip()]
    return ",".join(list(set(ip_ranges)))


@blueprint_assignment_group.route('/forking_menu', methods=['GET', 'POST'])
@blueprint_assignment_group.route('/forking_menu/', methods=['GET', 'POST'])
@login_required
def forking_menu():
    # Get arguments
    course_id = maybe_int(request.values.get('course_id'))
    assignment_group_id = maybe_int(request.values.get('assignment_group_id'))
    assignment_group_url = request.values.get("assignment_group_url")
    if not assignment_group_id and not assignment_group_url:
        if "course_id" in request.values:
            assignment_group = None
        else:
            return jsonify(success=False,
                           message="Set an assignment group id or url via the URL, or at least set a course_id.")
    elif not assignment_group_id:
        assignment_group = AssignmentGroup.by_url(assignment_group_url)
        assignment_group_id = assignment_group.id
    else:
        assignment_group = AssignmentGroup.by_id(assignment_group_id)
    if assignment_group:
        assignments = assignment_group.get_assignments()
        # Verify exists
        check_resource_exists(assignment_group, "Assignment Group", assignment_group_id)
        course_id = assignment_group.course_id
    else:
        assignments = []
    # Verify permissions
    if not course_id:
        return jsonify(success=False, message="No valid assignment_group_id, assignment_group_url, or course_id provided.")
    require_course_adopter(g.user, course_id)
    # Perform action
    if request.method == 'POST':
        if not assignment_group:
            return jsonify(success=False, message="Cannot fork unless you provide an assignment group.")
        message = []
        new_assignment_group_url = request.form.get('new_assignment_group_url')
        new_assignment_group_name = request.form.get('new_assignment_group_name')
        if new_assignment_group_url and AssignmentGroup.check_if_url_exists(new_assignment_group_url):
            message.append(f"Assignment Group with URL Already Exists: <code>{new_assignment_group_url}</code>")
        new_urls = {request.form.get(f"new_url[{assignment.id}]"): assignment
                    for assignment in assignments
                    if f"new_url[{assignment.id}]" in request.form}
        for url, assignment in new_urls.items():
            if url and Assignment.check_if_url_exists(url):
                message.append(f"Assignment with URL Already Exists: <code>{url}</code>")
        target_course_id = maybe_int(request.form.get('target_course_id'))
        if target_course_id is None:
            message.append(f"Invalid target course id: <code>{target_course_id}</code>")
        # TODO: PICK UP HERE
        if message:
            flash("Updating:<br>" + "<br>".join(message))
            return redirect(request.url)

        forked_group, new_assignments = assignment_group.fork(new_owner_id=g.user.id, new_course_id=target_course_id,
                                             with_assignments=False, new_url=new_assignment_group_url,
                                             new_name=new_assignment_group_name)
        for url, assignment in new_urls.items():
            new_assignment = assignment.fork(new_owner_id=g.user.id, new_course_id=target_course_id, new_url=url,
                            new_name=assignment.name)
            AssignmentGroupMembership.move_assignment(new_assignment.id, forked_group.id)
            new_assignments.append(new_assignment)
        links = "<br>\n".join([
            "<a href='"+url_for('assignments.load', assignment_group_id=forked_group.id,
                                course_id=target_course_id)
                + "' target=_blank>" + forked_group.name + "</a>"
        ] + [
            "<a href='"+url_for('assignments.load', assignment_id=assignment.id, course_id=target_course_id)
                + "' target=_blank>" + assignment.name + "</a>"
            for assignment in new_assignments
        ])
        flash(f"Forked {len(new_assignments)} assignments to {forked_group.name}:\n<br>{links}")
        return redirect(request.url)
    # Result
    else:
        # TODO: Check if the user is an instructor forks' courses
        existing_forks = [
            fork for fork in
            assignment_group.get_existing_forks()
            if g.user.is_instructor(fork.course_id)
        ] if assignment_group else []
        possible_groups = AssignmentGroup.by_course(course_id)
        return render_template('assignments/make_forks.html',
                               course_id=course_id,
                               group_name=assignment_group.name if assignment_group is not None else None,
                               group_id=assignment_group_id,
                               possible_groups=possible_groups,
                               assignments=assignments,
                               assignment_group=assignment_group,
                               editable_courses=g.user.get_editable_courses(),
                               existing_forks=existing_forks,
                               is_instructor=g.user.is_instructor(course_id),
                               warning="")


@blueprint_assignment_group.route('/export_submissions/', methods=['GET', 'POST'])
@blueprint_assignment_group.route('/export_submissions', methods=['GET', 'POST'])
@login_required
@require_request_parameters('assignment_group_id')
def export_submissions():
    assignment_group_id = int(request.values.get('assignment_group_id'))
    with_history = maybe_bool(request.values.get('history', "false"))
    assignment_group = AssignmentGroup.by_id(assignment_group_id)
    course_id = get_course_id(True)
    user, user_id = get_user()
    # File format of results: {"pdf", "code"}
    format = request.values.get("format", "code")
    # Verify exists
    check_resource_exists(assignment_group, "Assignment Group", assignment_group_id)
    # Get associated assignments and memberships
    assignments = assignment_group.get_assignments()
    # Verify permissions
    require_course_instructor(user, course_id)
    require_course_instructor(user, assignment_group.course_id)
    for assignment in assignments:
        assignment_id = assignment.id
        assignment = Assignment.by_id(int(assignment_id))
        if not user.is_instructor(int(assignment.course_id)):
            abort(403, "You are not an instructor or the owner of the assignment: " + str(assignment_id))
    # Get data
    course = Course.by_id(course_id)
    submissions, users = set(), set()
    for assignment in assignments:
        suas = Submission.by_assignment(assignment.id, course_id)
        assignment_submissions = [sua[0] for sua in suas]
        assignment_users = [sua[1] for sua in suas]
        submissions.update(assignment_submissions)
        users.update(assignment_users)

    # TODO: Download cleaned version
    # Generate the bundle
    if format == "pdf":
        bundle = export_pdf_zip(assignments=assignments, submissions=submissions, users=users,
                                jinja_environment=current_app.jinja_env)
    else:
        bundle = export_zip(assignments=assignments, submissions=submissions,
                            users=users, with_history=with_history)
    filename = course.get_url_or_id() + '-' + assignment_group.get_filename(extension='.zip')
    return Response(bundle, mimetype='application/zip',
                    headers={'Content-Disposition': 'attachment;filename={}'.format(filename)})


# ---------------------------------------------------------------------------
# Question Variations Endpoints
# ---------------------------------------------------------------------------

@blueprint_assignment_group.route('/get_variations', methods=['GET'])
@blueprint_assignment_group.route('/get_variations/', methods=['GET'])
@require_request_parameters('assignment_group_id')
@login_required
def get_variations():
    """
    Return variation configuration and, optionally, the assignments assigned to a
    specific user in this group.

    Query parameters:
        assignment_group_id  – required
        user_id              – optional; if omitted, defaults to the current user
    """
    if g.user.anonymous:
        return jsonify(success=False, message="You must be logged in to view variation assignments.")
    assignment_group_id = int(request.values.get('assignment_group_id'))
    assignment_group = AssignmentGroup.by_id(assignment_group_id)
    check_resource_exists(assignment_group, "Assignment Group", assignment_group_id)

    requested_user_id = maybe_int(request.values.get('user_id'))
    if requested_user_id is None:
        requested_user_id = g.user.id
    # Instructors may view any student's variations; students may only view their own
    if requested_user_id != g.user.id:
        require_course_instructor(g.user, assignment_group.course_id)

    variation_groups = assignment_group.get_variation_groups()
    assigned_ids = AssignmentGroupVariation.get_assignment_ids_for_user(
        requested_user_id, assignment_group_id)

    return jsonify(
        success=True,
        assignment_group_id=assignment_group_id,
        variation_count=assignment_group.variation_count,
        variation_groups=variation_groups,
        assigned_assignment_ids=assigned_ids,
        user_id=requested_user_id,
    )


@blueprint_assignment_group.route('/assign_variation', methods=['POST'])
@blueprint_assignment_group.route('/assign_variation/', methods=['POST'])
@require_request_parameters('assignment_group_id', 'user_id', 'assignment_ids')
@login_required
def assign_variation():
    """
    Explicitly assign a set of variation assignments to a specific user.

    Form parameters:
        assignment_group_id  – required
        user_id              – required; the student being assigned
        assignment_ids       – required; JSON array of assignment IDs
    """
    assignment_group_id = int(request.values.get('assignment_group_id'))
    assignment_group = AssignmentGroup.by_id(assignment_group_id)
    check_resource_exists(assignment_group, "Assignment Group", assignment_group_id)
    require_course_instructor(g.user, assignment_group.course_id)

    target_user_id = int(request.values.get('user_id'))
    try:
        assignment_ids = json.loads(request.values.get('assignment_ids'))
    except (ValueError, TypeError):
        return jsonify(success=False, message="assignment_ids must be a JSON array of integers")
    if not isinstance(assignment_ids, list):
        return jsonify(success=False, message="assignment_ids must be a list of integers")

    # Validate all IDs belong to this group
    valid_ids = {a.id for a in assignment_group.get_assignments()}
    invalid = [aid for aid in assignment_ids if aid not in valid_ids]
    if invalid:
        return jsonify(success=False,
                       message="Some assignment IDs do not belong to this group: {}".format(invalid))

    assignment_group.assign_variation_to_user(target_user_id, assignment_ids)

    return jsonify(
        success=True,
        assignment_group_id=assignment_group_id,
        user_id=target_user_id,
        assigned_assignment_ids=assignment_ids,
    )


@blueprint_assignment_group.route('/assign_variations_random', methods=['POST'])
@blueprint_assignment_group.route('/assign_variations_random/', methods=['POST'])
@require_request_parameters('assignment_group_id')
@login_required
def assign_variations_random():
    """
    Randomly assign variation assignments to all students enrolled in the group's course
    who do not yet have a variation assignment for this group.

    Form parameters:
        assignment_group_id  – required
        course_id            – optional; defaults to the group's own course
        overwrite            – optional boolean; if true, re-assign even existing students
    """
    assignment_group_id = int(request.values.get('assignment_group_id'))
    assignment_group = AssignmentGroup.by_id(assignment_group_id)
    check_resource_exists(assignment_group, "Assignment Group", assignment_group_id)
    require_course_instructor(g.user, assignment_group.course_id)

    overwrite = maybe_bool(request.values.get('overwrite', 'false'))
    course_id = maybe_int(request.values.get('course_id')) or assignment_group.course_id

    if assignment_group.variation_count == 0:
        return jsonify(success=False,
                       message="This group has variation_count=0; set it > 0 to use variations.")

    if not assignment_group.get_variation_groups():
        return jsonify(success=False,
                       message="No variation groups defined. "
                               "Set variation_group on AssignmentGroupMembership records first.")

    # Find all students in the course
    student_roles = Role.query.filter_by(course_id=course_id, name=UserRoles.LEARNER).all()
    assigned_count = 0
    skipped_count = 0
    for role in student_roles:
        user_id = role.user_id
        existing = AssignmentGroupVariation.get_assignment_ids_for_user(user_id, assignment_group_id)
        if existing and not overwrite:
            skipped_count += 1
            continue
        assignment_group.assign_random_variation(user_id)
        assigned_count += 1

    return jsonify(
        success=True,
        assignment_group_id=assignment_group_id,
        course_id=course_id,
        assigned_count=assigned_count,
        skipped_count=skipped_count,
    )


@blueprint_assignment_group.route('/edit_variation_settings', methods=['GET', 'POST'])
@blueprint_assignment_group.route('/edit_variation_settings/', methods=['GET', 'POST'])
@require_request_parameters('assignment_group_id')
@login_required
def edit_variation_settings():
    """
    GET  – return the current variation_count and membership variation_group values.
    POST – update variation_count on the group and variation_group on individual memberships.

    Form parameters (POST):
        assignment_group_id  – required
        variation_count      – required integer; 0 = all assignments, N = student does N
        variation_group[<membership_id>]  – optional per-membership variation group tag
    """
    assignment_group_id = int(request.values.get('assignment_group_id'))
    assignment_group = AssignmentGroup.by_id(assignment_group_id)
    check_resource_exists(assignment_group, "Assignment Group", assignment_group_id)
    require_course_instructor(g.user, assignment_group.course_id)

    if request.method == 'POST':
        variation_count = maybe_int(request.values.get('variation_count'))
        if variation_count is None or variation_count < 0:
            return jsonify(success=False, message="variation_count must be a non-negative integer")
        assignment_group.variation_count = variation_count

        memberships = assignment_group.get_memberships()
        for membership in memberships:
            key = 'variation_group[{}]'.format(membership.id)
            if key in request.values:
                raw = request.values.get(key)
                membership.variation_group = maybe_int(raw)

        from models.generics.models import db
        db.session.commit()

        return jsonify(
            success=True,
            assignment_group_id=assignment_group_id,
            variation_count=assignment_group.variation_count,
        )
    else:
        memberships = assignment_group.get_memberships()
        membership_data = [
            {
                'id': m.id,
                'assignment_id': m.assignment_id,
                'position': m.position,
                'variation_group': m.variation_group,
            }
            for m in memberships
        ]
        return jsonify(
            success=True,
            assignment_group_id=assignment_group_id,
            variation_count=assignment_group.variation_count,
            memberships=membership_data,
        )

