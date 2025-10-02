import random
from statistics import mean, stdev
import time
import json
import os
import subprocess
import csv
import difflib
from itertools import combinations, zip_longest
from dataclasses import asdict

from emoji import emoji_count
from thefuzz import fuzz
from flask import current_app, render_template, url_for

from common.filesystem import ensure_dirs
from common.urls import append_parameters
from controllers.helpers import make_log_entry
from controllers.pylti.common import LTIPostMessageException
from controllers.pylti.flask import LTI
from controllers.pylti.post_grade import TransmissionStatuses
from models import User
from models.data_formats.quiz_analysis import process_quizzes
from models.log_tables import SubmissionLog as Log
from models.report import Report
from models.assignment import Assignment
from models.submission import Submission
from models.course import Course
from models.enums import GradingStatuses, AssignmentTypes
from tasks.similarity_report import make_report

ctx = current_app.app_context()

@current_app.huey.context_task(ctx, context=True)
def get_events(course_id, user_id, task=None):
    """Background task that runs a long function with progress reports."""
    history = Log.get_history(course_id, assignment_id=None, user_id=user_id)
    return history


@current_app.huey.context_task(ctx, context=True)
def bulk_retry_all_failed_grades(course_id, json_lti):
    pass


@current_app.huey.context_task(ctx, context=True)
def check_similarity(user_id, assignment_id, exclude_courses, target_course, passes, use_starting_code,
                     number_of_matches, task=None):
    """

    :param assignment_id:
    :param exclude_courses:
    :param target_courses:
    :param settings:
    :return:
    """
    # Settings:
    # Comparison algorithms (passes): structure, text, exact, nocomments, misspellings
    # Use starting_code as archive
    # Number of matches
    report = Report.new('check_similarity', json.dumps(
        dict(assignment_id=assignment_id, exclude_courses=exclude_courses, target_course=target_course,
             passes=passes, use_starting_code=use_starting_code, number_of_matches=number_of_matches)
    ), owner_id=user_id, course_id=target_course)
    report.start()

    report.update_progress(message="Getting all the submissions relevant to the assignment.")
    assignment: Assignment = Assignment.by_id(assignment_id)
    # TODO: Check that the assignment exists
    # TODO: Check permissions
    submissions = Submission.all_by_assignment(assignment_id)

    report.update_progress(
        message="Grouping them as excluded, archived, or normal depending on exclude_courses and target_courses")
    included = [submission for submission in submissions if submission.course_id not in exclude_courses]
    archived = [submission for submission in included if submission.course_id != target_course]
    target = [submission for submission in included if submission.course_id == target_course]

    report.update_progress(message="Writing out all the files to the disk in a folder")
    directory = report.get_report_folder()
    ensure_dirs(directory)
    for folder in ["archived", "target", "distribution"]:
        ensure_dirs(os.path.join(directory, folder))
    for folder, submissions in [("archived", archived), ("target", target)]:
        for submission in submissions:
            path = os.path.join(directory, folder, f"{submission.course_id}_{submission.user_id}.py")
            with open(path, 'w') as out:
                out.write(submission.code)
    with open(os.path.join(directory, "distribution", "starting_code.py"), 'w') as out:
        out.write(assignment.starting_code)
    error_path = open(os.path.join(directory, f"error_log.txt"), 'wb')

    report.update_progress(message="Run the compare50 program on them")
    command = " ".join([current_app.config['COMPARE50_EXECUTABLE'],
                        os.path.join(directory, "target", "*.py"),
                        "-a", os.path.join(directory, "archived", "*.py"),
                        "-d", os.path.join(directory, "distribution", "*.py"),
                        "-p", passes if isinstance(passes, str) else " ".join(passes),
                        #"-n", str(number_of_matches),
                        "--verbose",
                        "-o", os.path.join(directory, "output")
                        ])
    try:
        p = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=error_path, shell=True)
        out, err = p.communicate()
        if out.strip():
            report.update_progress(message=out)
        error_path.write(out)
        error_path.write(err)
    except Exception as e:
        report.error("Task Error: " + str(e))
    finally:
        error_path.close()

    report.finish(result="output/index.html")


@current_app.huey.context_task(ctx, context=True)
def queue_grade_submission(previous_report, attempts, force_update, overwrite_human_grades, submission_score, at_time, task=None):
    report = Report.new('queue_lti_post_grade', json.dumps(
        dict(**asdict(previous_report),
             force_update= force_update,
             overwrite_human_grades=overwrite_human_grades,
             submission_score=submission_score,
             attempts=attempts)
    ), owner_id=previous_report.grader_id, course_id=previous_report.course_id)
    success = False
    while not success and attempts > 0:
        time.sleep(10)
        report.start()

        # Make a new grade post
        submission = Submission.by_id(previous_report.submission_id)
        report.update_progress(message="Loaded the submission.")
        course = Course.by_id(previous_report.course_id)
        report.update_progress(message="Loaded the course.")
        student = User.by_id(submission.user)
        report.update_progress(message="Loaded the student.")
        grade_post = report.create_grade_post(submission, course,
                                              force_update, overwrite_human_grades,
                                              at_time)
        report.update_progress(message="Created the grade post.")
        # Try to send the LTI submission bundle
        try:
            transmission_status, error = grade_post.submit()
            report.update_progress(message="Submitted the grade post.")
        except LTIPostMessageException as e:
            transmission_status = TransmissionStatuses.FAILURE
            error = str(e)
            report.update_progress(message="Error during grade post.")
        success = report.handle_transmission_result(transmission_status, error, submission,
                                                    grade_post, submission_score)
        if success:
            report.finish()
        else:
            attempts -= 1
            report.error("Retrying after transmission failure:" + str(error))
    if not success:
        report.error("Too many retries, giving up.")
    return False

@current_app.huey.context_task(ctx, context=True)
def queue_lti_post_grade(json_lti, post_params,
                         submission_id, assignment_group_id, user_id, course_id,
                         attempts, log_params, subscore, task=None):
    """ This is the old one, shouldn't be needed any more! """
    report = Report.new('queue_lti_post_grade', json.dumps(
        dict(post_params=post_params, submission_id=submission_id,
             assignment_group_id=assignment_group_id, user_id=user_id,
             course_id=course_id, log_params=log_params, subscore=subscore, attempts=attempts)
    ), owner_id=user_id, course_id=course_id)
    success = False
    total_score, view_url, lis_result_sourcedid, lis_outcome_service_url, reviewed = post_params
    while not success and attempts > 0:
        time.sleep(10)
        error = f"General retry failure. There are {attempts} left."
        report.start()
        try:
            lti = LTI(use_session=json_lti)
            lti.session['lis_outcome_service_url'] = lis_outcome_service_url
            lti.session['lis_result_sourcedid'] = lis_result_sourcedid
            lti.post_grade(total_score, view_url, endpoint=lis_result_sourcedid, url=True,
                           # Seems to give the wrong time? Need to find a better source than "date_modified" anyway
                           # when_submitted_at=to_iso_time(submission.date_modified)
                           needs_review=reviewed)
            success = True
            report.update_progress(message="GAMMA")
        except LTIPostMessageException as e:
            error = str(e)
            success = False
        if success:
            submission = Submission.by_id(submission_id)
            submission.update_grading_status(GradingStatuses.FULLY_GRADED)
            make_log_entry(**log_params, event_type="X-Submission.LMS", message=f"{total_score}|{subscore}")
            report.finish()
            return True
        else:
            make_log_entry(**log_params, event_type="X-Submission.LMS.Retry-Failure", message=error)
            report.error("Task Error: " + str(error))
            attempts -= 1
    return False


class SimilarityRings:
    def __init__(self):
        self.rings = []
        self.suspects = set()

    def add_to_rings(self, s1, s2, sim):
        for possible in self.rings:
            if s1 in possible or s2 in possible:
                if s1 in possible:
                    possible[s1].append((s2, sim))
                else:
                    possible[s1] = [(s2, sim)]
                if s2 in possible:
                    possible[s2].append((s1, sim))
                else:
                    possible[s2] = [(s1, sim)]
                return
        else:
            self.rings.append({
                s1: [(s2, sim)],
                s2: [(s1, sim)]
            })
        self.suspects.add(s1)
        self.suspects.add(s2)


@current_app.huey.context_task(ctx, context=True)
def check_similarity_simple(user_id, assignment_id, exclude_courses, target_course,
                            other_student_threshold=95, starter_change_threshold=95,
                            minimum_file_length=100,
                            task=None):
    """

    :param assignment_id:
    :param exclude_courses:
    :return:
    """
    report = Report.new('check_similarity_simple', json.dumps(
        dict(assignment_id=assignment_id, exclude_courses=exclude_courses, target_course=target_course,
             other_student_threshold=other_student_threshold, starter_change_threshold=starter_change_threshold,
             minimum_file_length=minimum_file_length)
    ), owner_id=user_id, course_id=target_course, assignment_id=assignment_id)
    report.start()

    report.update_progress(message="Getting all the submissions relevant to the assignment.")
    assignment: Assignment = Assignment.by_id(assignment_id)
    # TODO: Check that the assignment exists
    # TODO: Check permissions
    submissions = Submission.all_by_assignment(assignment_id)

    report.update_progress(
        message="Grouping them as excluded, archived, or normal depending on exclude_courses and target_courses")
    included = [submission for submission in submissions if submission.course_id not in exclude_courses
                and fuzz.ratio(assignment.starting_code, submission.code) < starter_change_threshold]
    archived = [submission for submission in included if submission.course_id != target_course
                and fuzz.ratio(assignment.starting_code, submission.code) < starter_change_threshold]
    target = [submission for submission in included if submission.course_id == target_course]
    interesting_targets = [submission for submission in target
                           if fuzz.ratio(assignment.starting_code, submission.code) < starter_change_threshold]

    report.update_progress(message="Running comparisons using thefuzz")
    all_possible_pairs = list(combinations(interesting_targets, 2)) + [
        (t, o) for t in interesting_targets for o in (included + archived)
    ]
    rings = SimilarityRings()
    total = len(all_possible_pairs)
    report.update_progress(message=f"Running comparisons using thefuzz: 0/{total}")
    for progress, (left, right) in enumerate(all_possible_pairs):
        if left == right:
            continue
        if not left.code.strip() or not right.code.strip():
            continue
        if len(left.code) < minimum_file_length or len(right.code) < minimum_file_length:
            continue
        similarity_score = fuzz.ratio(left.code, right.code)
        # Check that they actually changed the starter file
        if similarity_score > other_student_threshold:
            rings.add_to_rings(left, right, similarity_score)
        if progress % 100 == 0:
            report.update_progress(message=f"Running comparisons using thefuzz: {progress}/{total}")

    report.update_progress(message="Writing out the final report")
    directory = report.get_report_folder()
    ensure_dirs(directory)
    index_file = make_report(directory, rings.rings)

    report.finish(result="index.html",
                  message=f"Task finished. Checked {len(all_possible_pairs)} pairs ({len(target)} submissions in this course), found {len(rings.rings)} rings and {len(rings.suspects)} suspects.")
    return index_file


CODING_ASSIGNMENTS = (AssignmentTypes.PYTHON, AssignmentTypes.BLOCKPY, AssignmentTypes.TYPESCRIPT)

# Generate a RFR Index for each student, sort students by that, and then show all their submissions
# that had a Red Flag, ordering the assignments by the number of red flags

@current_app.huey.context_task(ctx, context=True)
def make_red_flag_report(user_id, target_course, short_threshold, characters_per_second_threshold, max_backstep_threshold, base_url="", task=None):
    """

    :param target_course:
    :return:
    """
    report = Report.new('make_red_flag_report', json.dumps(
        dict(target_course=target_course, version=1, short_threshold=short_threshold,
             characters_per_second_threshold=characters_per_second_threshold, max_backstep_threshold=max_backstep_threshold,
             base_url=base_url)
    ), owner_id=user_id, course_id=target_course)

    report.start()

    report.update_progress(message="Getting all the learners in the course.")
    course = Course.by_id(target_course)
    students = course.get_users(roles=['learner', 'instructor', 'grader'])

    directory = report.get_report_folder()
    ensure_dirs(directory)

    report.update_progress(message=f"Making report for each student: 0/{len(students)}")
    reports = {}
    errors = []
    try:
        for progress, (role, student) in enumerate(students):
            submissions = course.get_users_submitted_assignments_grouped(student.id)
            # Filter for only coding problems that have been edited at least once
            submissions = [(s, a, g) for (s, a, g) in submissions if a.type in CODING_ASSIGNMENTS
                           and s.version > 0]
            reports[student] = []
            for (submission, assignment, assignment_group) in submissions:
                try:
                    history = submission.get_logs()
                    filename = f"{directory}/{assignment.id}_{student.id}.json"
                    additions_per_second, cpa = copy_paste_additions(history, characters_per_second_threshold=characters_per_second_threshold)
                    reports[student].append(dict(
                        submission_id=submission.id,
                        assignment_id=assignment.id,
                        assignment_url=assignment.url,
                        edit_count=submission.version,
                        score=submission.full_score(),
                        duration_until_success=duration_until_success(history, filename, short_threshold=short_threshold),
                        copy_paste_additions=cpa,
                        additions_per_second=additions_per_second,
                        emoji_count=count_all_emojis(history),
                        #working_at_end=working_at_end(history, max_backstep_threshold)
                    ))
                except Exception as e:
                    report.update_progress(message=f"Error for {student.id} on {assignment.id}: {str(e)}")
                    errors.append(f"Error for {student.id} on {assignment.id}: {str(e)}")
            report.update_progress(message=f"Making report for each student: {progress}/{len(students)}")
    except Exception as e:
        report.error("Task Error: " + str(e))
        raise

    report.update_progress(message="Trying to standardize columns")
    NUMERIC_COLUMNS = ["duration_until_success", "copy_paste_additions",
                       "additions_per_second", "emoji_count", "edit_count"]
    NUMERIC_LABELS = ["Duration Until Success", "Copy Paste Additions",
                      "Additions Per Second", "Emoji Count", "Edit Count", ]
    standardized = standardize_columns(reports, NUMERIC_COLUMNS)

    report.update_progress(message="Writing out the final report")
    with open(os.path.join(directory, "red_flags.csv"), 'w', newline="") as out:
        csv_out = csv.writer(out)
        csv_out.writerow(["Course", "Student", "BlockPy User ID", "Email", "Assignment", "Url", "Link",
                          "Red Flag Index", "Reasons",
                          *NUMERIC_LABELS,
                          *[f"Standardized {l}" for l in NUMERIC_LABELS],
                          "Score"])

        for student, rs in reports.items():
            for r in rs:
                link = append_parameters(base_url, submission_id=r['submission_id'])
                url = r['assignment_url']
                numeric_row = [r[c] for c in NUMERIC_COLUMNS]
                standardized_row = standardized.get(student, {}).get(url, {})
                standardized_values = [standardized_row.get(c) for c in NUMERIC_COLUMNS]
                reasons, red_flag_index = identify_red_flags(r, standardized_row)
                csv_out.writerow([course.name,
                                  student.name(), student.id, student.email,
                                  r['assignment_id'], url,
                                  link,
                                  red_flag_index,
                                  "|".join(reasons),
                                  *numeric_row,
                                  *standardized_values,
                                  r['score']])
    if errors:
        with open(os.path.join(directory, "errors.txt"), 'w') as out:
            out.write("\n".join(errors))
    report.finish(result="red_flags.csv",
                  message=f"Task finished. Checked {len(students)} students in this course.")
    return "red_flags.csv"

class RedFlagIndexer:
    def __init__(self):
        self.index = 0
        self.reasons = []

    def add(self, reason, index_increase=1):
        self.reasons.append(reason)
        self.index += index_increase

    def get(self):
        return self.reasons, self.index

def identify_red_flags(numeric_row, standardized_row):
    red_flags = RedFlagIndexer()
    if standardized_row["duration_until_success"] is not None:
        if standardized_row["duration_until_success"] < -1:
            red_flags.add("Very Fast Success")
        elif standardized_row["duration_until_success"] < -2:
            red_flags.add("Extremely Fast Success", 2)
    if numeric_row["copy_paste_additions"] is not None:
        if numeric_row["copy_paste_additions"] == 1:
            red_flags.add("Addition Spike")
        elif numeric_row["copy_paste_additions"] > 1:
            red_flags.add("Multiple Addition Spikes", 2)
    if standardized_row["additions_per_second"] is not None:
        if standardized_row["additions_per_second"] > 2:
            red_flags.add("Massive Edit", 2)
        elif standardized_row["additions_per_second"] > 1:
            red_flags.add("Large Edit")
    if standardized_row["edit_count"] is not None:
        if standardized_row["edit_count"] < -2:
            red_flags.add("Very Few Edits", 2)
        elif standardized_row["edit_count"] < -1:
            red_flags.add("Few Edits")
    if numeric_row['emoji_count'] > 0:
        red_flags.add("Used Emojis")

    return red_flags.get()

def standardize_columns(reports, numeric_columns):
    column_submits = {col: {} for col in numeric_columns}
    for student, rs in reports.items():
        for r in rs:
            for col in numeric_columns:
                if r.get(col) is None:
                    continue
                url = r['assignment_url']
                if url not in column_submits[col]:
                    column_submits[col][url] = []
                column_submits[col][url].append(r.get(col, 0) or 0)
                # if r.get(col) is not None:
                #     column_totals[col] += r.get(col, 0) or 0
                #     column_counts[col] += 1

    means = {col: {} for col in numeric_columns}
    stds = {col: {} for col in numeric_columns}
    for column, rs in column_submits.items():
        for url, values in rs.items():
            means[column][url] = mean(values) if values else None
            stds[column][url] = stdev(values) if len(values) > 1 else None

    standardized = {}
    for student, rs in reports.items():
        standardized[student] = {}
        for r in rs:
            url = r['assignment_url']
            standardized[student][url] = {}
            for col in numeric_columns:
                m = means.get(col, {}).get(url)
                s = stds.get(col, {}).get(url)
                a = r.get(col)
                if m is None or s is None or a is None:
                    standardized[student][url][col] = None
                else:
                    standardized[student][url][col] = (a - m) / s if s > 0 else 0

    return standardized

def count_all_emojis(history):
    total = 0
    for log in history:
        if log.event_type == 'File.Edit':
            total += emoji_count(log.message)
    return total


def duration_until_success(history, filename, short_threshold=10):
    started = False
    start_time = None
    end_time = None
    current, total = history[0].date_created if history else None, 0
    for log in history:
        if not started and log.event_type == 'Session.Start':
            started = True
            start_time = log.date_created
            current = start_time
        elif log.event_type.lower() == 'intervention' and log.category.lower() == 'complete':
            end_time = log.date_created
            break
        else:
            diff = max(0, min((current - log.date_created).seconds, short_threshold))
            total += diff
            current = log.date_created
    if not start_time or not end_time:
        return None
    return total
    #return (end_time - start_time).total_seconds()

def _added_chars(a: str, b: str) -> int:
    # Count only inserted text; deletions don't reduce the count.
    sm = difflib.SequenceMatcher(None, a, b, autojunk=False)
    add = 0
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == 'insert':
            add += (j2 - j1)
        elif tag == 'replace':
            add += (j2 - j1)  # inserted side of the replacement counts as additions
    return add

def copy_paste_additions(history, characters_per_second_threshold=30):
    # Find the difference between consecutive edits in terms of additive edit distance (non negative length change)
    started = False
    start_time = None
    end_time = None
    total_additions, total_durations = 0, 0
    spikes = 0
    previous_code, previous_time = "", None
    for log in history:
        if not started and log.event_type == 'Session.Start':
            started = True
            start_time = log.date_created
        elif log.event_type.lower() == 'intervention' and log.category.lower() == 'complete':
            end_time = log.date_created
            break
        elif log.event_type in ('File.Edit', 'File.Create'):
            code = log.message
            if previous_time is not None:
                additions = _added_chars(previous_code, code)
                duration = min(5, max(1, abs((log.date_created - previous_time).total_seconds())))
                total_additions += additions
                total_durations += duration
                if additions / duration > characters_per_second_threshold:
                    spikes += 1
            previous_code, previous_time = code, log.date_created
    if not start_time or not end_time:
        return None, None
    return (total_additions / total_durations if total_durations > 0 else 0, spikes)

def working_at_end(history, max_backstep_threshold=5):
    # Find a series of edits between the last begin session and the last success where only the last n characters
    # change at each time step, for the most part
    started = False
    start_time = None
    end_time = None
    previous_code, previous_time = "", None
    additions = []
    for log in history:
        if not started and log.event_type == 'Session.Start':
            started = True
            start_time = log.date_created
        elif log.event_type.lower() == 'intervention' and log.category.lower() == 'complete':
            end_time = log.date_created
            break
        elif log.event_type in ('File.Edit', 'File.Create'):
            code = log.message
            if previous_time is not None:
                #diff = difflib.ndiff(previous_code, code)
                additions.extend(diff_positions(previous_code, code))
            previous_code, previous_time = code, log.date_created

    if not start_time or not end_time:
        return None
    # If additions is mostly monotonic, then it's probably just typing at the end
    return mostly_monotonic(additions, max_backstep_threshold)


def mostly_monotonic(additions, max_backsteps):
    """
    Returns whether the sequence of numbers is mostly linearly increasing
    :param additions:
    :return:
    """
    backsteps = 0
    for previous, i in zip(additions[:-1], additions[1:]):
        if previous > i:
            backsteps += 1
    return backsteps < max_backsteps


def diff_positions(a, b):
    for i, (x, y) in enumerate(zip_longest(a, b, fillvalue="")):
        if x != y:
            yield i


@current_app.huey.context_task(ctx, context=True)
def quiz_report(user_id, assignment_id, course_id,
                adjacent_courses, included_roles,
                close_open_quizzes, regrade_quizzes, lower_scores,
                task=None):
    """

    :param assignment_id:
    :param exclude_courses:
    :return:
    """
    report = Report.new('quiz_report', json.dumps(
        dict(assignment_id=assignment_id, adjacent_courses=adjacent_courses,
             included_roles=included_roles, close_open_quizzes=close_open_quizzes, regrade_quizzes=regrade_quizzes,
             lower_scores=lower_scores)
    ), owner_id=user_id, course_id=course_id, assignment_id=assignment_id)
    report.start()

    report.update_progress(message="Getting all the submissions relevant to the quiz.")
    assignment: Assignment = Assignment.by_id(assignment_id)
    # TODO: Check that the assignment exists
    # TODO: Check permissions
    submissions = Submission.all_by_assignment(assignment_id)
    report.update_progress(message="Filtering for the given courses")
    included = [submission for submission in submissions if submission.course_id in adjacent_courses]
    report.update_progress(message="Filtering for the given roles")
    # print(included, included_roles, adjacent_courses)
    submissions = []
    for submission in included:
        if 'anonymous' not in included_roles and submission.user.anonymous:
            pass # Do not keep anonymous users in this case
        if 'test' not in included_roles and submission.user.is_test_user(submission.course_id):
            pass # Do not include test users
        elif 'instructors' in included_roles and submission.user.is_instructor(submission.course_id):
            submissions.append(submission)
        elif 'students' in included_roles and submission.user.is_student(submission.course_id):
            submissions.append(submission)
        elif 'graders' in included_roles and submission.user.is_grader(submission.course_id):
            submissions.append(submission)
    # TODO: Handle other parameters
    report.update_progress(message="Setting up the final report space")
    directory = report.get_report_folder()
    ensure_dirs(directory)
    report.update_progress(message="Processing quiz submissions")
    processed = process_quizzes(assignment, submissions, directory)
    with open(os.path.join(directory, "index.html"), "w") as out:
        out.write(render_template("reports/quiz_summary.html", stats=processed))
    report.finish(result="index.html",
                  message=f"Task finished. Processed {len(submissions)} quiz submissions.")
    return processed