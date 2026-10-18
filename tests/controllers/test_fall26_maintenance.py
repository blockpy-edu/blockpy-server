"""
Regression tests for the fall 2026 maintenance round:
- late-penalty scoring survives naive grade_history timestamps next to aware due dates
- LTI launches that carry roles outside UserRoles do not poison the user's role list
- deleting a course detaches other courses' submissions from its assignment groups
- the course "delete" audit row is only written once the delete has happened
"""
import json
from datetime import datetime, timedelta, timezone

import pytest

from models import db
from models.assignment import Assignment
from models.assignment_group import AssignmentGroup
from models.course import Course, CourseHasSubmissions
from models.enums import CourseLogEvent, RoleLogEvent, UserRoles
from models.enums.roles import clean_role
from models.grade_history import GradeHistory
from models.log_tables import CourseLog, RoleLog
from models.role import Role
from models.submission import Submission
from models.user import User

ADMIN = "admin@blockpy.com"   # id 1
ADA = 10                      # instructor of course 6
LULU = 100                    # student in course 6
LATE_POLICY = {"late_policy": {"allowed": True, "interval": "hours", "amount": "10%",
                               "rounding": "ceil", "max_penalty": "50%"}}


def make_course(name, owner_id=ADA, **fields):
    course = Course(name=name, owner_id=owner_id, url=name.lower().replace(' ', '_'), **fields)
    db.session.add(course)
    db.session.commit()
    return course


def still_exists(model, pk):
    """ Course.remove deletes with bulk queries, so ask the database rather than the identity map. """
    db.session.expunge_all()
    return model.query.filter_by(id=pk).count() == 1


class TestLatePenaltyTimestamps:

    def test_history_rows_are_compared_as_utc(self, app, test_data):
        course = make_course("Late course", settings=json.dumps(LATE_POLICY))
        assignment = Assignment.new(owner_id=ADA, course_id=course.id, type='blockpy', name='late', url='late_q')
        due = datetime.now(timezone.utc) - timedelta(days=1)
        submission = Submission.load_or_new(assignment, LULU, course.id, new_due_date=due)
        submission.update_submission(0.5, False, False, datetime.now(timezone.utc))
        GradeHistory.remember(submission.id, ADA, submission.full_score(), datetime.now(timezone.utc))
        # Reload from the database: the plain DateTime column hands the history row back naive
        db.session.expire_all()
        submission = Submission.by_id(submission.id)
        assert submission.grade_history[0].date_submitted.tzinfo is None
        assert submission.date_due.tzinfo is not None
        score, explanations = submission.penalized_full_score()
        assert 0 <= score < 0.5
        assert explanations[0].startswith("Late submission")


class TestUnknownLtiRoles:

    def test_unknown_roles_are_dropped_and_known_ones_kept(self, app, test_data):
        course = make_course("Roles course")
        lulu = User.by_id(LULU)
        launch_roles = ["Learner", "urn:lti:instrole:ims/lis/Observer", "urn:lti:sysrole:ims/lis/User"]
        lulu.update_roles([clean_role(role)[0] for role in launch_roles], course.id)
        db.session.expire_all()
        # Loading the roles is exactly what used to raise LookupError on an unknown enum value
        names = [role.name for role in User.by_id(LULU).roles if role.course_id == course.id]
        assert names == [UserRoles.LEARNER]
        assert Role.query.filter(Role.name.in_(["observer", "user"])).count() == 0
        assert RoleLog.query.filter_by(subject_id=LULU, course_id=course.id, event_type=RoleLogEvent.GIVEN).count() == 1

    def test_repeated_launch_is_a_no_op(self, app, test_data):
        course = make_course("Roles again")
        lulu = User.by_id(LULU)
        lulu.update_roles(["learner", "observer"], course.id)
        lulu.update_roles(["learner", "observer", "learner"], course.id)
        db.session.expire_all()
        assert Role.query.filter_by(user_id=LULU, course_id=course.id).count() == 1
        assert RoleLog.query.filter_by(subject_id=LULU, course_id=course.id).count() == 1


class TestCourseRemoval:

    def test_remove_detaches_other_courses_submissions_from_its_groups(self, app, test_data):
        template_id = make_course("Exam template").id
        exam_id = AssignmentGroup.new(owner_id=ADA, course_id=template_id, name='Exam', url='exam_group').id
        assignment = Assignment.new(owner_id=ADA, course_id=6, type='blockpy', name='q1', url='exam_q1')
        submission_id = Submission.new(assignment.id, LULU, 6, assignment_group_id=exam_id).id
        Course.remove(template_id)
        assert not still_exists(Course, template_id)
        assert not still_exists(AssignmentGroup, exam_id)
        assert Submission.by_id(submission_id).assignment_group_id is None

    def test_audit_row_is_written_only_after_a_successful_delete(self, client, test_data, act_as, monkeypatch):
        course_id = make_course("Doomed course", owner_id=1).id
        act_as(test_data.user(ADMIN))

        def refuse(course_id, remove_linked=False):
            raise CourseHasSubmissions(course_id, 3)
        monkeypatch.setattr(Course, 'remove', staticmethod(refuse))
        client.post('/courses/remove', data={'course_id': course_id})
        assert still_exists(Course, course_id)
        assert CourseLog.query.filter_by(course_id=course_id, event_type=CourseLogEvent.DELETE).count() == 0

        monkeypatch.undo()
        act_as(test_data.user(ADMIN))
        client.post('/courses/remove', data={'course_id': course_id})
        assert not still_exists(Course, course_id)
        assert CourseLog.query.filter_by(course_id=course_id, event_type=CourseLogEvent.DELETE).count() == 1

    def test_cli_delete_logs_after_the_delete(self, app, test_data):
        from click.testing import CliRunner
        from scripts.db_commands import delete_course
        course_id = make_course("CLI course", owner_id=1).id
        result = CliRunner().invoke(delete_course, ['--course', str(course_id)], input='y\n')
        assert 'Deleted course' in result.output, result.output
        assert not still_exists(Course, course_id)
        assert CourseLog.query.filter_by(course_id=course_id, event_type=CourseLogEvent.DELETE).count() == 1
