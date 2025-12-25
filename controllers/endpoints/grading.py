from datetime import datetime
import os
import csv
import json
import io
from pprint import pprint
from typing import Tuple

from flask.views import MethodView
from slugify import slugify
from natsort import natsorted

from quart import Blueprint, url_for, session, request, jsonify, g, render_template, redirect, make_response, current_app, flash

from controllers.pylti.common import LTIPostMessageException
from controllers.pylti.post_grade import grade_submission, get_outcomes, calculate_submissions_score

from models.review import Review
from models.submission import Submission, GradingStatuses
from models.assignment import Assignment
from models.assignment_group import AssignmentGroup
from models.course import Course
from models.assignment_tag import AssignmentTag

from common.urls import normalize_url
from common.filesystem import ensure_dirs
from controllers.auth import get_user
from controllers.helpers import (ajax_failure, parse_assignment_load, require_request_parameters,
                                 get_course_id, maybe_int, check_resource_exists, ajax_success,
                                 login_required, require_course_instructor, require_course_grader, maybe_bool,
                                 make_log_entry, get_assignments_in_groups)
from models.user import User

blueprint_grading = Blueprint('grading', __name__, url_prefix='/grading')


@blueprint_grading.route('/static/<path:path>', methods=['GET', 'POST'])
def grading_static(path):
    return current_app.send_static_file(path)


@blueprint_grading.route('/update_grading_status', methods=['POST'])
def update_grading_status():
    submission_id = maybe_int(request.values.get("submission_id"))
    # TODO: Pretty sure multiple assignments are broken for grading
    assignment_group_id = maybe_int(request.values.get('assignment_group_id'))
    new_grading_status = request.values.get("new_grading_status", GradingStatuses.FULLY_GRADED)
    user, user_id = get_user()

    submission = Submission.by_id(submission_id)
    check_resource_exists(submission, "Submission", submission_id)

    if new_grading_status == GradingStatuses.FULLY_GRADED:
        report = grade_submission(submission_id, assignment_group_id,
                                  user, request.remote_addr,
                                  None, None, None, None,
                                  True, by_human=True, must_be_grader=True,
                                  date_submitted=submission.date_submitted)
        result = report.for_ajax()
        if report.no_errors:
            result['new_status'] = new_grading_status
            submission = Submission.by_id(submission_id)
            result['new_status_human'] = submission.human_grading_status() if submission else ""
            return ajax_success(result)
        else:
            return ajax_failure(result)
    else:
        submission.update_grading_status(new_grading_status)
        return ajax_success({
            'submitted': False,
            'new_status': new_grading_status,
            'new_status_human': submission.human_grading_status()
        })

@blueprint_grading.route('/update_submission_status', methods=['POST'])
def update_submission_status():
    submission_id = maybe_int(request.values.get("submission_id"))
    assignment_group_id = maybe_int(request.values.get('assignment_group_id'))
    new_submission_status = request.values.get("new_submission_status")
    user, user_id = get_user()

    submission = Submission.by_id(submission_id)
    check_resource_exists(submission, "Submission", submission_id)

    report = grade_submission(submission_id, assignment_group_id,
                              user, request.remote_addr,
                              None, None, new_submission_status, None,
                              True, by_human=False, must_be_grader=True,
                              date_submitted=submission.date_submitted)
    result = report.for_ajax()
    if report.no_errors:
        result['new_status'] = new_submission_status
        result['new_status_human'] = submission.human_submission_status()
        return ajax_success(result)
    else:
        return ajax_failure(result)

@blueprint_grading.route('/mass_close_assignment', methods=['GET', 'POST'])
def mass_close_assignment():
    assignment_id = maybe_int(request.values.get("assignment_id"))
    course_id = maybe_int(request.values.get("course_id"))
    new_submission_status = request.values.get("new_submission_status")
    skip_unchanged = maybe_bool(request.values.get("skip_unchanged"))
    user, user_id = get_user()
    submissions = Submission.by_assignment(assignment_id=assignment_id, course_id=course_id)
    # Verify permissions
    if not user.is_grader(course_id):
        return ajax_failure("You are not a grader in this course.")
    # Do action
    changed = []
    for submission, student, assignment in submissions:
        if not skip_unchanged or submission.version:
            # TODO: Make this use the new grade_submission approach
            submission.update_submission_status(new_submission_status)
            changed.append(student.id)
    return ajax_success({'new_status': new_submission_status, "students": changed})


def get_request_list(name: str, default=None, element_conversion=int):
    if name in request.values:
        values = request.values.get(name).split(",")
        converted = []
        for value in values:
            try:
                if element_conversion:
                    converted.append(element_conversion(value))
                else:
                    converted.append(value)
            except ValueError:
                ajax_failure(f"Invalid value for {name}: {value}")
        return converted
    if default is None:
        return []
    return default

@blueprint_grading.route('/get_grading_spreadsheet/', methods=['GET', 'POST'])
@blueprint_grading.route('/get_grading_spreadsheet', methods=['GET', 'POST'])
@login_required
def get_grading_spreadsheet():
    course_ids = get_request_list('course_ids')
    assignment_ids = get_request_list('assignment_ids')
    assignment_group_ids = get_request_list('assignment_group_ids')
    student_ids = get_request_list('student_ids')
    role_names = get_request_list('role_names', element_conversion=str)
    estimate_time_spent = maybe_bool(request.values.get('estimate_time_spent'))
    with_code = maybe_bool(request.values.get('with_code'))
    user, user_id = get_user()
    # Verify existence and permissions of courses
    courses = {}
    for course_id in course_ids:
        course = Course.by_id(course_id)
        check_resource_exists(course, "Course", course_id)
        if not user.is_grader(course_id):
            return ajax_failure(f"You are not a grader in the course {course_id}.")
        courses[course_id] = course
    # Get data
    submissions = [submission for course in courses.values()
                   for submission in course.get_filtered_submissions(assignment_ids=assignment_ids,
                                                      assignment_group_ids=assignment_group_ids,
                                                      student_ids=student_ids,
                                                      role_names=role_names)]
    # Create spreadsheet
    with io.StringIO() as f:
        cw = csv.writer(f)
        cw.writerows([["Course", "Group", "Assignment", "Student", "Role", "Email",
                      "Correct", "Raw Score", "Full Score", "Reviews", "Status", "Submission Status", "Grading Status",
                      "Edit Count", "Estimated Time Spent", "Date Created", "Date Modified", "Date Started", "Extra Files",
                      "Course ID", "Group ID", "Assignment ID", "User ID",
                      "Assignment Type", "Code"
                      ]])
        cw.writerows([[submission.course.name if submission.course else "Unknown Course",
                       submission.assignment_group.name if submission.assignment_group else "No Group",
                       submission.assignment.name, submission.user.name(),
                       ",".join([role.name for role, user in User.get_user_role(submission.course_id, submission.user_id)]),
                       submission.user.email,
                       submission.correct, submission.score, submission.full_score(), len(submission.get_reviews()),
                       submission.full_status(False), submission.submission_status, submission.grading_status,
                       submission.version, submission.estimate_duration() if estimate_time_spent else "",
                       submission.date_created, submission.date_modified, submission.get_session_start_time() or "",
                       submission.extra_files,
                       submission.course_id, submission.assignment_group_id, submission.assignment_id, submission.user_id,
                       submission.assignment.type,
                       submission.code if with_code else "",
                       ]
                      for submission in submissions])
        output = make_response(f.getvalue())
        filename = make_grading_spreadsheet_filename(course_ids, assignment_ids, assignment_group_ids, student_ids, role_names)
        output.headers["Content-Disposition"] = f"attachment; filename={filename}.csv"
        output.headers["Content-type"] = "text/csv"
        return output


def make_grading_spreadsheet_filename(course_ids, assignment_ids, assignment_group_ids, student_ids, role_names):
    parts = []
    if course_ids:
        parts.append(f"c{'-'.join([str(course_id) for course_id in course_ids])}")
    if assignment_ids:
        parts.append(f"a{'-'.join([str(assignment_id) for assignment_id in assignment_ids])}")
    if assignment_group_ids:
        parts.append(f"g{'-'.join([str(assignment_group_id) for assignment_group_id in assignment_group_ids])}")
    if student_ids:
        parts.append(f"s{'-'.join([str(student_id) for student_id in student_ids])}")
    if role_names:
        parts.append(f"r{'-'.join([role_name for role_name in role_names])}")
    return f"grading_spreadsheet_{'_'.join(parts)}.csv"

def fix_nullables(review_data):
    for nullable in ['score', 'tag_id', 'forked_id', 'submission_id']:
        if nullable not in review_data or review_data[nullable] in (None, '', 'null'):
            review_data[nullable] = None


def normalize_score(score: str) -> float:
    try:
        score = score.replace("%", "")
        return float(score)
    except:
        return score



@blueprint_grading.route("/bulk_update_submission/", methods=['GET', 'POST'])
@blueprint_grading.route("/bulk_update_submission", methods=['GET', 'POST'])
def bulk_update_submission():
    """
    This endpoint is if the user has a JSON list of submission objects uploaded.
    The submission objects must have the following fields:
    - submission_id
    - score
    - correct
    """
    if request.method == 'POST':
        if 'file' not in request.files:
            flash('No file part')
            return redirect(request.url)
        file = request.files['file']
        if file.filename == '':
            flash('No selected file')
            return redirect(request.url)
        if file:
            bundle = json.loads(file.read().decode('utf-8'))
            changed = 0
            for submission_data in bundle:
                if 'submission_id' not in submission_data or 'score' not in submission_data or 'correct' not in submission_data:
                    flash("Submission object missing fields: " + str(submission_data))
                    return redirect(request.url)
                submission_id = submission_data['submission_id']
                score = submission_data['score']
                correct = submission_data['correct']
                message = submission_data.get('message', "")
                submission = Submission.by_id(submission_id)
                if submission:
                    grade_submission(submission_id, None, g.user, request.remote_addr,
                                     score, correct, None, None, True, by_human=True, must_be_grader=True)
                    make_log_entry(submission_id, submission.version,
                                   submission.assignment_id, submission.assignment_version,
                                   submission.course_id, submission.user_id, "X-Grade.Instructor", message=json.dumps({
                            "grader_id": g.user.id,
                            "score": score,
                            "correct": correct,
                            "message": message
                        }))
                    changed += 1
            flash(f"File uploaded successfully: {changed} submissions updated.")
            return redirect(request.url)
        flash("No file contents")
        return redirect(request.url)
    else:
        return render_template("courses/bulk_update_submission.html")


@blueprint_grading.route("/review_editor/", methods=['GET', 'POST'])
@blueprint_grading.route("/review_editor", methods=['GET', 'POST'])
def review_editor():
    user, user_id = get_user()
    # Might have been provided identifying information
    course_id = maybe_int(request.values.get('course_id'))
    assignment_id = maybe_int(request.values.get('assignment_id'))
    student_id = maybe_int(request.values.get('student_id'))
    submission_id = maybe_int(request.values.get('submission_id'))

    # Sorting order
    sort_courses_by = request.values.get('sort_courses_by', 'name')
    sort_students_by = request.values.get('sort_students_by', 'last_name')

    # Load up potential information
    course = Course.by_id(course_id)
    assignment = Assignment.by_id(assignment_id)
    submission = Submission.by_id(submission_id)
    student = User.by_id(student_id)

    # If they provide a submission, load them directly
    if submission_id is not None:
        submission = Submission.by_id(submission_id)
        check_resource_exists(submission, "Submission", submission_id)
        require_course_grader(user, submission.course_id)
        assignment_id = submission.assignment_id
        course_id = submission.course_id
        student_id = submission.user_id
        assignment = Assignment.by_id(assignment_id)
        student = User.by_id(student_id)
        course = Course.by_id(course_id)
        has_submission = True
    else:
        has_submission = False
        # Otherwise, make sure they have the right permissions for what we do know
        if course_id is not None:
            check_resource_exists(course, "Course", course_id)
            require_course_grader(user, course_id)
        if assignment_id is not None:
            check_resource_exists(assignment, "Assignment", assignment_id)
            if assignment.hidden:
                require_course_instructor(user, assignment.course_id)
            else:
                require_course_grader(user, assignment.course_id)
        if student_id is not None:
            check_resource_exists(student, "Student", student_id)

    if not submission and assignment and course and student:
        submission = Submission.get_submission(assignment_id, student_id, course_id)
        has_submission = submission is not None

    # Get the information for dropdowns
    available_courses = user.get_grading_courses(sort_courses_by)
    if course is not None:
        grouped_assignments, assignments_by_group, group_headers, groups = get_assignments_in_groups(course)
        students = natsorted(course.get_students(sort_students_by), key=lambda x: x.name())
    else:
        grouped_assignments, assignments_by_group, group_headers, groups = [], {}, {}, []
        students = []

    tags = [tag.encode_json() for tag in AssignmentTag.get_all()]

    return render_template("grading/review_editor.html",
                           course=course, course_id=course_id,
                           available_courses=available_courses,
                           assignment_id=assignment_id,
                           assignments_by_group=assignments_by_group,
                           group_headers=group_headers,
                           students=students,
                           # Target data
                           student=student, student_id=student_id,
                           submission=submission,
                           assignment=assignment,
                           # Sorting
                           sort_courses_by=sort_courses_by,
                           sort_students_by=sort_students_by,
                           # Grading setup
                           tags=tags,
                           is_instructor=True,
                           is_grader=True,
                           force_manual_review=True,
                           has_submission=has_submission,
                           )


@blueprint_grading.route("/group_review_editor/", methods=['GET', 'POST'])
@blueprint_grading.route("/group_review_editor", methods=['GET', 'POST'])
def group_review_editor():
    user, user_id = get_user()
    # Might have been provided identifying information
    course_id = maybe_int(request.values.get('course_id'))
    assignment_group_id = maybe_int(request.values.get('assignment_group_id'))
    student_id = maybe_int(request.values.get('student_id'))

    # Sorting order
    sort_courses_by = request.values.get('sort_courses_by', 'name')
    sort_students_by = request.values.get('sort_students_by', 'last_name')

    # Load up potential information
    course = Course.by_id(course_id)
    assignment_group = AssignmentGroup.by_id(assignment_group_id)
    student = User.by_id(student_id)

    # Check that this is allowed
    if course_id is not None:
        check_resource_exists(course, "Course", course_id)
        require_course_grader(user, course_id)
    if assignment_group_id is not None:
        check_resource_exists(assignment_group, "AssignmentGroup", assignment_group_id)
    if student_id is not None:
        check_resource_exists(student, "Student", student_id)

    if assignment_group:
        assignments = assignment_group.get_assignments()
        submissions = [a.load(student_id, course_id) for a in assignments]
    else:
        assignments = []
        submissions = []

    for assignment, submission in zip(assignments, submissions):
        check_resource_exists(assignment, "Assignment", assignment.id)
        if submission is not None:
            require_course_grader(user, submission.course_id)

    # Get the information for dropdowns
    available_courses = user.get_grading_courses(sort_courses_by)
    if course is not None:
        grouped_assignments, assignments_by_group, group_headers, groups = get_assignments_in_groups(course)
        students = natsorted(course.get_students(sort_students_by), key=lambda x: x.name())
    else:
        grouped_assignments, assignments_by_group, group_headers, groups = [], {}, {}, []
        students = []

    total_score, total_possible, all_explanations = calculate_submissions_score(assignments, submissions, None)

    return render_template("grading/bulk_review_editor.html",
                           course=course, course_id=course_id,
                           available_courses=available_courses,
                           assignment_group_id=assignment_group_id,
                           assignment_group=assignment_group,
                           groups=groups,
                           students=students,
                           # Target data
                           student=student, student_id=student_id,
                           submissions=submissions,
                           assignments=assignments,
                           # Sorting
                           sort_courses_by=sort_courses_by,
                           sort_students_by=sort_students_by,
                           # Results
                            total_score=total_score,
                           total_possible=total_possible,
                           )


class ReviewAPI(MethodView):

    def get(self, review_id):
        if review_id is None:
            return self.get_all()
        else:
            return self.get_one(review_id)

    def get_all(self):
        submission_id = maybe_int(request.values.get('submission_id'))
        user, user_id = get_user()
        if submission_id is None:
            reviews = Review.get_generic_reviews()
        else:
            submission = Submission.by_id(submission_id)
            check_resource_exists(submission, "Submission", submission_id)
            reviews = Review.get_for_submission(submission_id)
            if submission.user_id != user_id:
                require_course_grader(user, submission.course_id)
        return ajax_success(dict(reviews=[review.encode_json() for review in reviews]))

    def get_one(self, review_id):
        user, user_id = get_user()
        review = Review.by_id(review_id)
        check_resource_exists(review, "Review", review_id)
        submission = Submission.by_id(review.submission_id)
        check_resource_exists(submission, "Submission", review.submission_id)
        if submission.user_id != user_id:
            require_course_grader(user, submission.course_id)
        return ajax_success(dict(review=review.encode_json()))

    def post(self):
        user, user_id = get_user()
        submission_id = maybe_int(request.values.get('submission_id'))
        submission = Submission.by_id(submission_id)
        check_resource_exists(submission, "Submission", submission_id)
        require_course_grader(user, submission.course_id)
        review_data = request.values.copy()
        del review_data['id']
        review_data['author_id'] = user_id
        review_data['submission_version'] = submission.version
        review_data['assignment_version'] = submission.assignment_version
        fix_nullables(review_data)
        review_data['score'] = normalize_score(review_data['score'])
        new_review = Review.new(review_data)
        submission.mark_graded()
        return ajax_success(dict(review=new_review.encode_json()))


    def put(self, review_id):
        user, user_id = get_user()
        review = Review.by_id(review_id)
        check_resource_exists(review, "Review", review_id)
        submission = Submission.by_id(review.submission_id)
        check_resource_exists(submission, "Submission", review.submission_id)
        require_course_grader(user, submission.course_id)
        review_data = request.json.copy()
        del review_data['id']
        fix_nullables(review_data)
        review_data['score'] = normalize_score(review_data['score'])
        review_data['author_id'] = user_id
        edited_review = review.edit(review_data)
        submission.mark_graded()
        return ajax_success(dict(review=edited_review.encode_json()))

    def delete(self, review_id):
        user, user_id = get_user()
        review = Review.by_id(review_id)
        check_resource_exists(review, "Review", review_id)
        submission = Submission.by_id(review.submission_id)
        check_resource_exists(submission, "Submission", review.submission_id)
        require_course_grader(user, submission.course_id)
        review.delete()
        return ajax_success(dict(success=True))


review_view = ReviewAPI.as_view('review_api')
blueprint_grading.add_url_rule('/review/', defaults={'review_id': None},
                               view_func=review_view, methods=['GET'])
blueprint_grading.add_url_rule('/review/', view_func=review_view, methods=['POST'])
blueprint_grading.add_url_rule('/review/<int:review_id>', view_func=review_view,
                               methods=['GET', 'PUT', 'DELETE'])
