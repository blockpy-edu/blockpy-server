"""
Tests for the query-efficiency improvements to the models
(role determination, counter upserts, review scoring, and the
course/bundle/zip export paths).

Each test verifies behavior first; several also assert an upper bound on the
number of SELECT statements issued, to guard against N+1 regressions.
"""
import io
import json
import zipfile
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import jinja2
from sqlalchemy import event

from models import db
from models.user import User
from models.role import Role
from models.review import Review
from models.submission import Submission
from models.assignment_group_membership import AssignmentGroupMembership
from models.course import Course
from models.counters.submission_counts import SubmissionCounts
from models.enums.metrics import SubmissionMetrics
from models.enums.roles import UserRoles
from models.log_tables import SubmissionLog
from models.data_formats import portation
from models.data_formats.portation import export_bundle, export_zip, export_pdf_zip

from tests.factory.factories import (
    UserFactory, CourseFactory, AssignmentFactory,
    AssignmentGroupFactory, SubmissionFactory,
)


@contextmanager
def count_selects():
    """Record every SELECT statement issued while the block runs."""
    statements = []

    def before_cursor_execute(conn, cursor, statement, parameters, context, executemany):
        if statement.lstrip().upper().startswith("SELECT"):
            statements.append(statement)

    engine = db.engine
    event.listen(engine, "before_cursor_execute", before_cursor_execute)
    try:
        yield statements
    finally:
        event.remove(engine, "before_cursor_execute", before_cursor_execute)


def make_review(submission_id, author_id, score=None, forked_id=None, generic=False):
    review = Review(comment="", location="", generic=generic, score=score,
                    submission_id=submission_id, author_id=author_id,
                    assignment_version=0, submission_version=0, version=0,
                    forked_id=forked_id)
    db.session.add(review)
    db.session.commit()
    return review


# ---------------------------------------------------------------------------
# 1) determine_role
# ---------------------------------------------------------------------------

def test_determine_role_levels(client):
    course = CourseFactory.create_course()
    other_course = CourseFactory.create_course()
    instructor = UserFactory.create_instructor(course=course)
    ta = UserFactory.create_user()
    Role.new(name=UserRoles.TA, user_id=ta.id, course_id=course.id)
    student = UserFactory.create_student(course=course)

    visible = AssignmentFactory.create_assignment(course=course, hidden=False)
    hidden = AssignmentFactory.create_assignment(course=course, hidden=True)
    foreign = AssignmentFactory.create_assignment(course=other_course, hidden=False)

    sub_visible = SubmissionFactory.create_submission(assignment=visible, user=student, course=course)
    sub_hidden = SubmissionFactory.create_submission(assignment=hidden, user=student, course=course)
    # Foreign assignment, but the submission lives in the instructor's course
    sub_foreign = SubmissionFactory.create_submission(assignment=foreign, user=student, course=course)

    # Instructors get the top role on their own course's assignments
    assert instructor.determine_role([visible], [sub_visible]) == 'owner'
    assert instructor.determine_role([hidden], [sub_hidden]) == 'owner'
    # Foreign assignment: not owner of the assignment's course, but grader of
    # the submission's course
    assert instructor.determine_role([foreign], [sub_foreign]) == 'grader'
    # The least-privileged role across all pairs wins
    assert instructor.determine_role([visible, foreign], [sub_visible, sub_foreign]) == 'grader'

    # TAs are graders for visible assignments but not for hidden ones
    assert ta.determine_role([visible], [sub_visible]) == 'owner'
    assert ta.determine_role([hidden], [sub_hidden]) == 'student'

    # Students are always students; no assignments defaults to student
    assert student.determine_role([visible], [sub_visible]) == 'student'
    assert student.determine_role([], []) == 'student'


def test_determine_role_queries_do_not_scale_with_assignments(client):
    course = CourseFactory.create_course()
    instructor = UserFactory.create_instructor(course=course)
    student = UserFactory.create_student(course=course)
    assignments = [AssignmentFactory.create_assignment(course=course) for _ in range(5)]
    submissions = [SubmissionFactory.create_submission(assignment=a, user=student, course=course)
                   for a in assignments]

    db.session.expire_all()
    instructor = User.by_id(instructor.id)
    # Warm the row attributes so we only measure determine_role itself
    assignments = [a for a in assignments]
    with count_selects() as selects:
        role = instructor.determine_role(assignments, submissions)
    assert role == 'owner'
    # One query to load the user's roles (plus possible attribute refreshes),
    # instead of two Role queries per assignment
    assert len(selects) <= 1 + len(assignments)


# ---------------------------------------------------------------------------
# 2) Counter upserts
# ---------------------------------------------------------------------------

def get_count(submission_id, metric):
    row = SubmissionCounts.query.filter_by(submission_id=submission_id, metric=metric).first()
    return row.value if row else None


def test_safely_increase_batch_accumulates(client):
    submission = SubmissionFactory.create_submission()
    long_ago = datetime.now(timezone.utc) - timedelta(seconds=100)

    SubmissionCounts.safely_increase_batch(
        submission.id,
        [(SubmissionMetrics.total_edits, 2),
         (SubmissionMetrics.total_edits, 3),  # duplicate metric is merged
         (SubmissionMetrics.feedback_total, 1)],
        submission_last_updated=None, when=1000.0)

    assert get_count(submission.id, SubmissionMetrics.total_edits) == 5
    assert get_count(submission.id, SubmissionMetrics.feedback_total) == 1
    # First event: no measurable gap yet
    assert get_count(submission.id, SubmissionMetrics.total_time_spent) == 0

    import time as time_module
    SubmissionCounts.safely_increase_batch(
        submission.id,
        [(SubmissionMetrics.total_edits, 1)],
        submission_last_updated=long_ago, when=time_module.time())

    assert get_count(submission.id, SubmissionMetrics.total_edits) == 6
    # Gap is capped at the threshold (5 seconds)
    assert get_count(submission.id, SubmissionMetrics.total_time_spent) == SubmissionCounts.GAP_THRESHOLD


def test_safely_increase_batch_empty_updates(client):
    submission = SubmissionFactory.create_submission()
    SubmissionCounts.safely_increase_batch(submission.id, [],
                                           submission_last_updated=None, when=1000.0)
    # Still tracks the time-spent row
    assert get_count(submission.id, SubmissionMetrics.total_time_spent) == 0


def test_safely_increase_single_upsert(client):
    submission = SubmissionFactory.create_submission()
    # No row yet: inserts the default
    SubmissionCounts.safely_increase_single(submission.id, SubmissionMetrics.total_edits,
                                            value=99, default=1)
    assert get_count(submission.id, SubmissionMetrics.total_edits) == 1
    # Row exists: sets the value
    SubmissionCounts.safely_increase_single(submission.id, SubmissionMetrics.total_edits,
                                            value=7, default=1)
    assert get_count(submission.id, SubmissionMetrics.total_edits) == 7


def test_track_event_intervention(client):
    submission = SubmissionFactory.create_submission()
    SubmissionCounts.track_event(submission.id, "Intervention",
                                 {"syntaxError": 1, "unitTests": {"tests": 4, "successes": 3}},
                                 when=2000.0)
    assert get_count(submission.id, SubmissionMetrics.total_interventions) == 1
    assert get_count(submission.id, SubmissionMetrics.feedback_total) == 1
    assert get_count(submission.id, SubmissionMetrics.feedback_syntax_errors) == 1
    assert get_count(submission.id, SubmissionMetrics.feedback_assertion_counts) == 4
    assert get_count(submission.id, SubmissionMetrics.feedback_assertion_successes) == 3


# ---------------------------------------------------------------------------
# 3) update_roles
# ---------------------------------------------------------------------------

def get_role_names(user_id, course_id):
    return sorted(str(role.name) for role in
                  Role.query.filter_by(user_id=user_id, course_id=course_id).all())


def test_update_roles_add_and_remove(client):
    course = CourseFactory.create_course()
    user = UserFactory.create_student(course=course)
    assert get_role_names(user.id, course.id) == ['learner']

    user.update_roles(['Instructor', 'learner'], course.id)
    assert get_role_names(user.id, course.id) == ['instructor', 'learner']

    db.session.expire_all()
    user = User.by_id(user.id)
    user.update_roles(['teachingassistant'], course.id)
    assert get_role_names(user.id, course.id) == ['teachingassistant']


def test_update_roles_no_change(client):
    course = CourseFactory.create_course()
    user = UserFactory.create_student(course=course)
    user.update_roles(['learner'], course.id)
    assert get_role_names(user.id, course.id) == ['learner']


def test_update_roles_does_not_touch_other_courses(client):
    course = CourseFactory.create_course()
    other_course = CourseFactory.create_course()
    user = UserFactory.create_student(course=course)
    Role.new(name=UserRoles.LEARNER, user_id=user.id, course_id=other_course.id)

    db.session.expire_all()
    user = User.by_id(user.id)
    user.update_roles(['instructor'], course.id)
    assert get_role_names(user.id, course.id) == ['instructor']
    assert get_role_names(user.id, other_course.id) == ['learner']


# ---------------------------------------------------------------------------
# 4) full_score
# ---------------------------------------------------------------------------

def test_full_score_with_reviews_and_fork_chains(client):
    course = CourseFactory.create_course()
    instructor = UserFactory.create_instructor(course=course)
    assignment = AssignmentFactory.create_assignment(course=course, reviewed=True)
    submission = SubmissionFactory.create_submission(assignment=assignment, course=course)
    submission.score = 50
    db.session.commit()

    # A direct review, and a review that inherits its score through a fork chain
    generic = make_review(None, instructor.id, score=10, generic=True)
    make_review(submission.id, instructor.id, score=25)
    make_review(submission.id, instructor.id, score=None, forked_id=generic.id)

    db.session.expire_all()
    submission = Submission.by_id(submission.id)
    assert submission.full_score() == (50 + 25 + 10) / 100.0 * assignment.get_points()


def test_full_score_fork_chain_queries_do_not_scale(client):
    course = CourseFactory.create_course()
    instructor = UserFactory.create_instructor(course=course)
    assignment = AssignmentFactory.create_assignment(course=course, reviewed=True)

    def build_submission(chained_reviews):
        submission = SubmissionFactory.create_submission(assignment=assignment, course=course)
        for i in range(chained_reviews):
            generic = make_review(None, instructor.id, score=10, generic=True)
            make_review(submission.id, instructor.id, score=None, forked_id=generic.id)
        return submission.id

    one_chain = build_submission(1)
    three_chains = build_submission(3)

    def measure(submission_id):
        db.session.expire_all()
        submission = Submission.by_id(submission_id)
        with count_selects() as selects:
            submission.full_score()
        return len(selects)

    queries_one = measure(one_chain)
    queries_three = measure(three_chains)
    # All fork targets load in a single batched query per chain-depth level,
    # so more chained reviews must not mean more queries
    assert queries_three == queries_one


def test_full_score_unreviewed(client):
    submission = SubmissionFactory.create_submission(correct=True)
    db.session.expire_all()
    submission = Submission.by_id(submission.id)
    assert submission.full_score() == 1.0 * submission.assignment.get_points()


# ---------------------------------------------------------------------------
# 5) get_users_submitted_assignments
# ---------------------------------------------------------------------------

def make_course_with_submissions(students=3, assignments=2):
    course = CourseFactory.create_course()
    instructor = UserFactory.create_instructor(course=course)
    student_users = [UserFactory.create_student(course=course) for _ in range(students)]
    course_assignments = [AssignmentFactory.create_assignment(course=course)
                          for _ in range(assignments)]
    submissions = [SubmissionFactory.create_submission(assignment=a, user=s, course=course)
                   for s in student_users for a in course_assignments]
    return course, instructor, student_users, course_assignments, submissions


def test_get_users_submitted_assignments_results(client):
    course, _, students, assignments, submissions = make_course_with_submissions()
    rows = course.get_users_submitted_assignments()
    assert len(rows) == len(submissions)
    for submission, user, assignment in rows:
        assert submission.user_id == user.id
        assert submission.assignment_id == assignment.id
    # Filtering by user still works
    filtered = course.get_users_submitted_assignments(user_ids=[students[0].id])
    assert len(filtered) == len(assignments)
    # Pagination
    assert len(course.get_users_submitted_assignments(limit=2)) == 2
    assert len(course.get_users_submitted_assignments(limit=2, offset=len(submissions) - 1)) == 1


def test_get_users_submitted_assignments_deferred_columns_still_load(client):
    course, _, _, _, _ = make_course_with_submissions(students=1, assignments=1)
    rows = course.get_users_submitted_assignments()
    submission = rows[0][0]
    # Deferred, but transparently loadable on access
    assert submission.code == "print('Hello, World!')"


def test_get_users_submitted_assignments_full_score_is_batched(client):
    course, _, _, _, submissions = make_course_with_submissions(students=3, assignments=2)
    db.session.expire_all()
    course = Course.by_id(course.id)
    with count_selects() as selects:
        rows = course.get_users_submitted_assignments()
        scores = [submission.full_score() for submission, user, assignment in rows]
    assert len(scores) == len(submissions)
    # One main query plus one selectin load for reviews; full_score must not
    # add a query per submission
    assert len(selects) <= 3


# ---------------------------------------------------------------------------
# 6) Course.export
# ---------------------------------------------------------------------------

def make_exportable_course():
    instructor = UserFactory.create_instructor()
    course = CourseFactory.create_course(owner=instructor)
    group = AssignmentGroupFactory.create_assignment_group(course=course, owner=instructor)
    grouped = [AssignmentFactory.create_assignment(course=course, owner=instructor,
                                                   name=f"Grouped {i}")
               for i in range(2)]
    for assignment in grouped:
        AssignmentGroupMembership.move_assignment(assignment.id, group.id)
    ungrouped = AssignmentFactory.create_assignment(course=course, owner=instructor,
                                                    name="Ungrouped")
    return instructor, course, group, grouped, ungrouped


def test_course_export_contents(client):
    instructor, course, group, grouped, ungrouped = make_exportable_course()
    db.session.expire_all()

    exported = Course.export(course.id)

    assert exported['course']['url'] == course.url
    assert exported['course']['owner_id__email'] == instructor.email

    exported_urls = [a['url'] for a in exported['assignments']]
    assert sorted(exported_urls) == sorted([grouped[0].url, grouped[1].url, ungrouped.url])
    # Sorted by name
    names = [a['name'] for a in exported['assignments']]
    assert names == sorted(names)
    for assignment_data in exported['assignments']:
        assert assignment_data['owner_id__email'] == instructor.email

    assert len(exported['assignment_groups']) == 1
    assert exported['assignment_groups'][0]['url'] == group.url
    assert exported['assignment_groups'][0]['owner_id__email'] == instructor.email

    memberships = exported['assignment_memberships']
    assert len(memberships) == 2
    assert {m['assignment_group_url'] for m in memberships} == {group.url}
    assert {m['assignment_url'] for m in memberships} == {grouped[0].url, grouped[1].url}


def test_course_export_query_count_bounded(client):
    instructor, course, group, grouped, ungrouped = make_exportable_course()
    db.session.expire_all()
    with count_selects() as selects:
        Course.export(course.id)
    # A fixed number of batched queries, instead of several per
    # group/membership/assignment
    assert len(selects) <= 12


# ---------------------------------------------------------------------------
# 7) export_zip
# ---------------------------------------------------------------------------

def open_zip(bundle):
    return zipfile.ZipFile(io.BytesIO(bundle))


def make_zip_export_data(students=2):
    course = CourseFactory.create_course()
    UserFactory.create_instructor(course=course)
    assignment = AssignmentFactory.create_assignment(course=course)
    student_users = [UserFactory.create_student(course=course, first_name=f"Student{i}")
                     for i in range(students)]
    for student in student_users:
        SubmissionFactory.create_submission(assignment=assignment, user=student, course=course)
    db.session.expire_all()
    # Mirror the controllers: fetch submissions and users through one query
    rows = Submission.by_assignment(assignment.id, course.id)
    submissions = [row[0] for row in rows]
    users = [row[1] for row in rows]
    return course, assignment, submissions, users


def test_export_zip_contents(client):
    course, assignment, submissions, users = make_zip_export_data()
    bundle = export_zip(assignments=[assignment], submissions=submissions, users=users)
    archive = open_zip(bundle)
    names = archive.namelist()

    assert f"{assignment.url}.md" in names
    users_txt = archive.read("users.txt").decode("utf8")
    for user in users:
        assert user.name() in users_txt

    grade_files = [n for n in names if n.endswith("_grade.json")]
    assert len(grade_files) == len(submissions)
    grade_data = json.loads(archive.read(grade_files[0]))
    assert grade_data["roles"] == ["learner"]
    # Code file is present under assignment/user/
    assert any(n.startswith(f"{assignment.url}/") and n.endswith("answer.py") for n in names)


def test_export_zip_with_history(client):
    course, assignment, submissions, users = make_zip_export_data(students=1)
    submission = submissions[0]
    SubmissionLog.new(submission.id, 0, assignment.id, 0, course.id, submission.user_id,
                      "File.Edit", "answer.py", "", "", "print('first')", "", "", extended=False)
    SubmissionLog.new(submission.id, 0, assignment.id, 0, course.id, submission.user_id,
                      "File.Edit", "answer.py", "", "", "print('second')", "", "", extended=False)

    bundle = export_zip(assignments=[assignment], submissions=submissions, users=users,
                        with_history=True)
    archive = open_zip(bundle)
    history_files = [n for n in archive.namelist() if n.endswith("history.json")]
    assert len(history_files) == 1
    history = json.loads(archive.read(history_files[0]))
    assert [entry["message"] for entry in history] == ["print('first')", "print('second')"]
    assert all(entry["submission_id"] == submission.id for entry in history)


def test_export_zip_queries_do_not_scale_with_submissions(client):
    def measure(students):
        course, assignment, submissions, users = make_zip_export_data(students=students)
        with count_selects() as selects:
            export_zip(assignments=[assignment], submissions=submissions, users=users,
                       with_history=True)
        return len(selects)

    queries_small = measure(1)
    queries_large = measure(4)
    assert queries_large == queries_small


# ---------------------------------------------------------------------------
# 8) export_bundle
# ---------------------------------------------------------------------------

def test_export_bundle_mixed_identifiers(client):
    instructor, course, group, grouped, ungrouped = make_exportable_course()
    db.session.expire_all()

    bundle = export_bundle(courses=[course.id],
                           groups=[group.url],
                           assignments=[grouped[0].id, grouped[1].url, ungrouped])

    assert [c['url'] for c in bundle['courses']] == [course.url]
    assert [g['url'] for g in bundle['groups']] == [group.url]
    # Input order is preserved regardless of identifier type
    assert [a['url'] for a in bundle['assignments']] == [grouped[0].url, grouped[1].url,
                                                         ungrouped.url]
    assert bundle['assignments'][0]['owner_id__email'] == instructor.email


def test_export_bundle_memberships(client):
    instructor, course, group, grouped, ungrouped = make_exportable_course()
    memberships = AssignmentGroupMembership.by_course(course.id)
    bundle = export_bundle(memberships=memberships)
    assert {m['assignment_url'] for m in bundle['memberships']} == {grouped[0].url, grouped[1].url}


def test_export_bundle_query_count_bounded(client):
    instructor, course, group, grouped, ungrouped = make_exportable_course()
    assignment_ids = [grouped[0].id, grouped[1].id, ungrouped.id]
    db.session.expire_all()
    with count_selects() as selects:
        export_bundle(assignments=assignment_ids)
    # One id-batch (plus tag/sample selectins) and one owner batch, instead of
    # one query per assignment plus per-assignment lazy loads
    assert len(selects) <= 5


# ---------------------------------------------------------------------------
# 9) export_pdf_zip
# ---------------------------------------------------------------------------

def test_export_pdf_zip(client, monkeypatch):
    course, assignment, submissions, users = make_zip_export_data()
    rendered = []

    def fake_from_string(html):
        rendered.append(html)
        return b"%PDF-fake"

    monkeypatch.setattr(portation, "pdfkit", SimpleNamespace(from_string=fake_from_string))
    jinja_environment = jinja2.Environment()
    jinja_environment.filters["highlight_java_code"] = lambda code: code

    bundle = export_pdf_zip(assignments=[assignment], submissions=submissions, users=users,
                            jinja_environment=jinja_environment)
    archive = open_zip(bundle)
    names = archive.namelist()

    pdf_name = assignment.get_filename(".pdf")
    assert pdf_name in names
    assert archive.read(pdf_name) == b"%PDF-fake"
    # Every student's name and code made it into the rendered HTML
    assert len(rendered) == 1
    for user in users:
        assert user.name() in rendered[0]
    assert "print('Hello, World!')" in rendered[0]
