"""
Regression tests for the third audit round:
- LTI form fields (sourcedid, due/lock dates) are only honoured on a verified launch
- new submissions are only created for users who may join the course
- grader scope obtained through a using course keeps the assignment's IP/passcode locks
- feedback drafts never reach students through the history routes
- the LMS passback group must contain the submission's assignment
- public-assignment viewers do not receive the owner's passback id or feedback
- log rows are filed under the submission's own course and assignment
- assignment/group urls cannot collide; `<course>_default` is reserved
- removing an assignment archives it unless hard_delete is requested
- imported bundles cannot claim a fork origin
"""
import json
from datetime import datetime, timezone

import pytest
from flask import g

from models.assignment import Assignment
from models.assignment_group import AssignmentGroup
from models.assignment_group_membership import AssignmentGroupMembership
from models.course import Course
from models.log_tables import SubmissionLog
from models.role import Role
from models.submission import Submission
from models.user import User
from models.enums import UserRoles, AssignmentStatus

ADA = "ada@blockpy.com"        # id 10, instructor of 6-13
CAPTAIN = "captain@blockpy.com"  # id 12, instructor of 14-16
LULU = "lulu@blockpy.com"      # id 100, learner in 6
PRIVATE_COURSE = 14            # Captain's, visibility private
PUBLIC_COURSE = 6              # Ada's, visibility public


def feedback_code(contents, published):
    return json.dumps({"contents": contents, "published": published})


LAUNCH_FIELDS = {
    'custom_canvas_assignment_dueat': '2099-01-01T00:00:00Z',
    'custom_canvas_assignment_lockat': '2099-02-01T00:00:00Z',
    'lis_result_sourcedid': 'launch-sourcedid',
}


def run_parse_assignment_load(app, user, query, form, lti_course=None, verified=False):
    """ Run parse_assignment_load in a request context that mimics the auth hook's state. """
    from controllers.helpers import parse_assignment_load
    from controllers.services import ValidUserPermissionLayer
    with app.test_request_context('/assignments/load', method='POST', query_string=query, data=form):
        g.user = user
        g.safely = ValidUserPermissionLayer(user)
        g.course = lti_course
        g.roles = []
        if verified:
            g.lti_launch_verified = True
        return parse_assignment_load()


class TestLaunchFieldsNeedVerifiedLaunch:

    def test_plain_post_cannot_set_dates_or_sourcedid(self, client, test_data, act_as):
        act_as(test_data.user(LULU))
        response = client.post('/assignments/load?assignment_id=100&course_id=6', data=LAUNCH_FIELDS)
        assert response.status_code == 200
        submission = Submission.get_submission(100, 100, 6)
        assert submission is not None
        assert submission.date_due is None
        assert submission.date_locked is None
        assert submission.endpoint == ""

    def test_verified_launch_still_sets_them(self, app, client, test_data):
        lulu = test_data.user(LULU)
        run_parse_assignment_load(app, lulu, {'assignment_id': 100}, LAUNCH_FIELDS,
                                  lti_course=Course.by_id(6), verified=True)
        submission = Submission.get_submission(100, 100, 6)
        assert submission.date_due.year == 2099
        assert submission.date_locked.month == 2
        assert submission.endpoint == 'launch-sourcedid'

    def test_stored_lti_session_without_launch_does_not(self, app, client, test_data):
        lulu = test_data.user(LULU)
        run_parse_assignment_load(app, lulu, {'assignment_id': 100}, LAUNCH_FIELDS,
                                  lti_course=Course.by_id(6), verified=False)
        submission = Submission.get_submission(100, 100, 6)
        assert submission.date_due is None and submission.endpoint == ""


class TestSubmissionCreationGate:

    def test_anonymous_cannot_join_private_course(self, client, test_data):
        response = client.get('/assignments/load', query_string={'assignment_id': 100, 'course_id': PRIVATE_COURSE})
        assert response.status_code == 200
        assert Submission.query.filter_by(assignment_id=100, course_id=PRIVATE_COURSE).count() == 0

    def test_learner_cannot_join_another_private_course(self, client, test_data, act_as):
        act_as(test_data.user(LULU))
        response = client.get('/assignments/load', query_string={'assignment_id': 100, 'course_id': PRIVATE_COURSE})
        assert response.status_code == 200
        assert Submission.get_submission(100, 100, PRIVATE_COURSE) is None
        response = client.get('/blockpy/load_assignment', query_string={'assignment_id': 100, 'course_id': PRIVATE_COURSE})
        data = response.get_json()
        assert data['success'] is True and data['submission'] is None
        assert Submission.get_submission(100, 100, PRIVATE_COURSE) is None

    def test_member_of_course_can(self, client, test_data, act_as):
        act_as(test_data.user(CAPTAIN))
        client.get('/assignments/load', query_string={'assignment_id': 100, 'course_id': PRIVATE_COURSE})
        assert Submission.get_submission(100, 12, PRIVATE_COURSE) is not None

    def test_public_course_stays_open(self, client, test_data, act_as):
        act_as(test_data.user(CAPTAIN))   # not in course 6
        client.get('/assignments/load', query_string={'assignment_id': 100, 'course_id': PUBLIC_COURSE})
        assert Submission.get_submission(100, 12, PUBLIC_COURSE) is not None

    def test_anonymous_try_it_out_still_uses_default_course(self, client, test_data):
        response = client.get('/assignments/load', query_string={'assignment_id': 140})
        assert response.status_code == 200
        assert Submission.query.filter_by(assignment_id=140, course_id=Course.get_default().id).count() == 1

    def test_lti_context_course_can_without_a_role(self, app, client, test_data):
        """ The launch that enrols a user sets g.course; a role string we cannot map must not block the join. """
        lulu = test_data.user(LULU)
        run_parse_assignment_load(app, lulu, {'assignment_id': 100}, {}, lti_course=Course.by_id(PRIVATE_COURSE))
        assert Submission.get_submission(100, 100, PRIVATE_COURSE) is not None

    def test_existing_submissions_always_load(self, client, test_data, act_as):
        Submission.load_or_new(Assignment.by_id(100), 100, PRIVATE_COURSE)
        act_as(test_data.user(LULU))
        response = client.get('/blockpy/load_assignment', query_string={'assignment_id': 100, 'course_id': PRIVATE_COURSE})
        assert response.get_json()['submission'] is not None

    def test_grader_creates_only_for_enrolled_students(self, client, test_data, act_as):
        act_as(test_data.user(CAPTAIN))
        # Captain adopts the assignment into 14 (so he grades with it there); Lulu is not in 14
        client.get('/assignments/load', query_string={'assignment_id': 100, 'course_id': PRIVATE_COURSE})
        response = client.get('/blockpy/load_assignment', query_string={
            'assignment_id': 100, 'course_id': PRIVATE_COURSE, 'student_id': 100})
        assert response.get_json()['submission'] is None
        Role.new(UserRoles.LEARNER, user_id=100, course_id=PRIVATE_COURSE)
        response = client.get('/blockpy/load_assignment', query_string={
            'assignment_id': 100, 'course_id': PRIVATE_COURSE, 'student_id': 100})
        assert response.get_json()['submission'] is not None


class TestUsingCourseGraderKeepsLocks:
    LOAD = '/blockpy/load_assignment'

    @pytest.fixture
    def locked_exam(self, client, test_data):
        """ Assignment 100 becomes a locked exam of a private course 6. """
        Course.by_id(PUBLIC_COURSE).edit(visibility='private')
        exam = Assignment.by_id(100)
        exam.edit({'hidden': True, 'ip_ranges': '10.0.0.0/8',
                   'settings': json.dumps({'passcode': 'secret'})})
        return exam

    def adopt_into_own_course(self, client):
        client.get('/assignments/load', query_string={'assignment_id': 100, 'course_id': PRIVATE_COURSE})
        assert Submission.get_submission(100, 12, PRIVATE_COURSE) is not None

    def test_self_adoption_does_not_bypass_ip_lock(self, client, test_data, act_as, locked_exam):
        act_as(test_data.user(CAPTAIN))
        self.adopt_into_own_course(client)
        response = client.get(self.LOAD, query_string={'assignment_id': 100, 'course_id': PRIVATE_COURSE})
        assert response.status_code == 403
        response = client.get('/assignments/by_url', query_string={'url': locked_exam.url, 'course_id': PRIVATE_COURSE})
        assert response.status_code == 403

    def test_self_adoption_does_not_bypass_passcode(self, client, test_data, act_as, locked_exam):
        locked_exam.edit({'ip_ranges': ''})
        act_as(test_data.user(CAPTAIN))
        self.adopt_into_own_course(client)
        response = client.get(self.LOAD, query_string={'assignment_id': 100, 'course_id': PRIVATE_COURSE})
        assert response.get_json()['success'] is False
        assert 'secret' not in response.get_data(as_text=True)
        # With the passcode the using-course instructor still grades with it (sharing by URL keeps working)
        response = client.get(self.LOAD, query_string={'assignment_id': 100, 'course_id': PRIVATE_COURSE,
                                                       'passcode': 'secret'})
        assert response.get_json()['success'] is True

    def test_adopter_of_home_course_is_exempt(self, client, test_data, act_as, locked_exam):
        Role.new(UserRoles.ADOPTER, user_id=12, course_id=PUBLIC_COURSE)
        act_as(test_data.user(CAPTAIN))
        self.adopt_into_own_course(client)
        response = client.get(self.LOAD, query_string={'assignment_id': 100, 'course_id': PRIVATE_COURSE})
        assert response.get_json()['success'] is True

    def test_unlocked_shared_assignment_unchanged(self, client, test_data, act_as):
        Course.by_id(PUBLIC_COURSE).edit(visibility='private')
        act_as(test_data.user(CAPTAIN))
        self.adopt_into_own_course(client)
        response = client.get(self.LOAD, query_string={'assignment_id': 100, 'course_id': PRIVATE_COURSE})
        assert response.get_json()['success'] is True


class TestFeedbackHistoryRedaction:

    @pytest.fixture
    def draft(self, client, test_data):
        assignment = Assignment.new(owner_id=10, course_id=6, type='feedback', name='fb', url='fb_draft')
        submission = Submission.load_or_new(assignment, 100, 6)
        submission.save_code('answer.py', feedback_code("Draft: blunt notes", False))
        SubmissionLog.new(submission.id, submission.version, assignment.id, assignment.version, 6, 100,
                          'File.Edit', 'answer.py', '', '', feedback_code("Draft: blunt notes", False), '', '', False)
        return assignment

    def test_load_history_hides_draft_from_student(self, client, test_data, act_as, draft):
        act_as(test_data.user(LULU))
        response = client.get('/blockpy/load_history', query_string={
            'course_id': 6, 'assignment_id': draft.id, 'with_submission': 'true'})
        assert response.get_json()['success'] is True
        assert 'Draft: blunt notes' not in response.get_data(as_text=True)

    def test_browse_history_hides_draft_from_student(self, client, test_data, act_as, draft):
        act_as(test_data.user(LULU))
        response = client.get('/blockpy/browse_history', query_string={
            'course_id': 6, 'assignment_id': draft.id, 'user_id': 100})
        assert response.status_code == 200
        assert 'Draft: blunt notes' not in response.get_data(as_text=True)

    def test_grader_still_sees_draft(self, client, test_data, act_as, draft):
        act_as(test_data.user(ADA))
        response = client.get('/blockpy/load_history', query_string={
            'course_id': 6, 'assignment_id': draft.id, 'user_id': 100, 'with_submission': 'true'})
        assert 'Draft: blunt notes' in response.get_data(as_text=True)

    def test_normal_assignment_history_unchanged(self, client, test_data, act_as):
        submission = Submission.load_or_new(Assignment.by_id(100), 100, 6)
        submission.save_code('answer.py', 'print("mine")')
        SubmissionLog.new(submission.id, 1, 100, 0, 6, 100, 'File.Edit', 'answer.py', '', '', 'print("mine")', '', '', False)
        act_as(test_data.user(LULU))
        response = client.get('/blockpy/load_history', query_string={'course_id': 6, 'assignment_id': 100})
        assert 'print(\\"mine\\")' in response.get_data(as_text=True)


class TestPassbackGroup:

    def test_group_must_contain_the_assignment(self, app, client, test_data):
        from controllers.pylti.post_grade import grade_submission
        easy = Assignment.new(owner_id=10, course_id=6, type='blockpy', name='easy', url='easy_q')
        hard = Assignment.new(owner_id=10, course_id=6, type='blockpy', name='hard', url='hard_q')
        g_easy = AssignmentGroup.new(owner_id=10, course_id=6, name='practice', url='g_easy')
        g_hard = AssignmentGroup.new(owner_id=10, course_id=6, name='exam', url='g_hard')
        AssignmentGroupMembership.move_assignment(easy.id, g_easy.id)
        AssignmentGroupMembership.move_assignment(hard.id, g_hard.id)
        Submission.load_or_new(easy, 100, 6, assignment_group_id=g_easy.id).set_submission(100, True)
        s_hard = Submission.load_or_new(hard, 100, 6, assignment_group_id=g_hard.id)
        lulu = User.by_id(100)
        with app.test_request_context('/blockpy/update_submission'):
            swapped = grade_submission(s_hard.id, g_easy.id, lulu, '127.0.0.1', None, None, None, None, False)
            honest = grade_submission(s_hard.id, g_hard.id, lulu, '127.0.0.1', None, None, None, None, False)
        assert swapped.assignment_group_id == g_hard.id
        assert honest.assignment_group_id == g_hard.id


class TestViewerRedaction:

    @pytest.fixture
    def public_submission(self, client, test_data):
        assignment = Assignment.by_id(100)
        assignment.edit({'public': True})
        submission = Submission.load_or_new(assignment, 100, 6, new_submission_url='lulu-sourcedid-xyz')
        submission.feedback = "private instructor note"
        from models import db
        db.session.commit()
        return submission

    def test_other_viewer_does_not_get_sourcedid_or_feedback(self, client, test_data, act_as, public_submission):
        act_as(test_data.user(CAPTAIN))
        response = client.get('/blockpy/load_submission', query_string={
            'submission_id': public_submission.id, 'course_id': PRIVATE_COURSE})
        assert response.status_code == 200
        body = response.get_data(as_text=True)
        assert 'lulu-sourcedid-xyz' not in body
        assert 'private instructor note' not in body
        assert LULU not in body

    def test_grader_still_gets_them(self, client, test_data, act_as, public_submission):
        act_as(test_data.user(ADA))
        response = client.get('/blockpy/load_submission', query_string={
            'submission_id': public_submission.id, 'course_id': 6})
        assert 'lulu-sourcedid-xyz' in response.get_data(as_text=True)


class TestLogRowsFollowTheSubmission:

    def test_log_event_ignores_foreign_ids(self, client, test_data, act_as):
        submission = Submission.load_or_new(Assignment.by_id(100), 100, 6)
        act_as(test_data.user(LULU))
        response = client.post('/blockpy/log_event', data={
            'event_type': 'Session.Start', 'submission_id': submission.id,
            'assignment_id': 999, 'course_id': PRIVATE_COURSE, 'message': 'hello'})
        assert response.get_json()['success'] is True
        row = SubmissionLog.by_id(response.get_json()['log_id'])
        assert (row.course_id, row.assignment_id) == (6, 100)
        assert SubmissionLog.query.filter_by(course_id=PRIVATE_COURSE, subject_id=100).count() == 0

    def test_save_file_logs_under_submission_course(self, client, test_data, act_as):
        submission = Submission.load_or_new(Assignment.by_id(100), 100, 6)
        act_as(test_data.user(LULU))
        response = client.post('/blockpy/save_file', data={
            'filename': 'answer.py', 'submission_id': submission.id, 'course_id': PRIVATE_COURSE, 'code': 'x = 1'})
        assert response.get_json()['success'] is True
        latest = (SubmissionLog.query.filter_by(submission_id=submission.id)
                  .order_by(SubmissionLog.id.desc()).first())
        assert latest.course_id == 6


class TestUrlUniqueness:

    def test_new_assignment_rejects_taken_url(self, client, test_data, act_as):
        act_as(test_data.user(CAPTAIN))
        response = client.post('/assignments/new', data={'course_id': PRIVATE_COURSE,
                                                          'url': Assignment.by_id(100).url, 'name': 'squat'})
        assert response.get_json()['success'] is False
        assert Assignment.query.filter_by(url=Assignment.by_id(100).url).count() == 1

    def test_save_assignment_rejects_taken_url(self, client, test_data, act_as):
        act_as(test_data.user(CAPTAIN))
        mine = Assignment.new(owner_id=12, course_id=PRIVATE_COURSE, url='captain_sq', type='blockpy', name='x')
        response = client.post('/blockpy/save_assignment', data={
            'assignment_id': mine.id, 'course_id': PRIVATE_COURSE, 'url': Assignment.by_id(100).url})
        assert response.get_json()['success'] is False
        assert Assignment.by_id(mine.id).url == 'captain_sq'
        # Keeping its own url is fine
        response = client.post('/blockpy/save_assignment', data={
            'assignment_id': mine.id, 'course_id': PRIVATE_COURSE, 'url': 'captain_sq', 'name': 'renamed'})
        assert response.get_json()['success'] is True

    def test_default_suffix_is_reserved_for_the_course(self, client, test_data, act_as):
        course = Course.by_id(PUBLIC_COURSE)
        act_as(test_data.user(CAPTAIN))
        response = client.post('/assignments/new', data={'course_id': PRIVATE_COURSE,
                                                          'url': course.url + '_default', 'name': 'squat'})
        assert response.get_json()['success'] is False
        assert course.get_default_assignment().course_id == PUBLIC_COURSE

    def test_course_instructor_may_name_own_default(self, client, test_data, act_as):
        act_as(test_data.user(ADA))
        own = Course.by_id(12)  # Ada instructs 12
        response = client.post('/assignments/new', data={'course_id': 12, 'url': own.url + '_default', 'name': 'ok'})
        assert response.get_json()['success'] is True

    def test_group_urls_cannot_collide(self, client, test_data, act_as):
        act_as(test_data.user(CAPTAIN))
        first = client.post('/assignment_group/add', data={'course_id': PRIVATE_COURSE, 'name': 'a', 'url': 'grp_dup'})
        assert first.get_json()['success'] is True
        second = client.post('/assignment_group/add', data={'course_id': PRIVATE_COURSE, 'name': 'b', 'url': 'grp_dup'})
        assert second.get_json()['success'] is False
        other = AssignmentGroup.new(owner_id=12, course_id=PRIVATE_COURSE, name='c', url='grp_other')
        edit = client.post('/assignment_group/edit', data={'assignment_group_id': other.id,
                                                            'new_name': 'c', 'new_url': 'grp_dup'})
        assert edit.get_json()['success'] is False


class TestSoftDelete:

    def test_remove_archives_and_keeps_submissions(self, client, test_data, act_as):
        assignment = Assignment.by_id(100)
        Submission.load_or_new(assignment, 12, PRIVATE_COURSE)   # another course reuses it
        act_as(test_data.user(ADA))
        response = client.post('/assignments/remove', data={'assignment_id': 100})
        data = response.get_json()
        assert data['success'] is True and data['archived'] is True and data['deleted'] is False
        assert PRIVATE_COURSE in data['courses_affected']
        assert Assignment.by_id(100).status == AssignmentStatus.ARCHIVED
        assert Submission.get_submission(100, 12, PRIVATE_COURSE) is not None
        assert AssignmentGroupMembership.query.filter_by(assignment_id=100).count() == 0
        assert 100 not in {a.id for a in Assignment.by_course(6)}
        assert 100 not in {a.id for a, _ in Assignment.get_available()}
        assert 100 in {a.id for a in Assignment.by_course(6, include_archived=True)}

    def test_hard_delete_only_on_request(self, client, test_data, act_as):
        Submission.load_or_new(Assignment.by_id(100), 12, PRIVATE_COURSE)
        act_as(test_data.user(ADA))
        response = client.post('/assignments/remove', data={'assignment_id': 100, 'hard_delete': 'true'})
        data = response.get_json()
        assert data['success'] is True and data['deleted'] is True
        assert Assignment.by_id(100) is None
        assert Submission.get_submission(100, 12, PRIVATE_COURSE) is None

    def test_other_instructor_still_blocked(self, client, test_data, act_as):
        act_as(test_data.user(CAPTAIN))
        response = client.post('/assignments/remove', data={'assignment_id': 100, 'hard_delete': 'true'})
        assert response.get_json()['success'] is False
        assert Assignment.by_id(100) is not None


class TestImportForkOrigin:

    def post_bundle(self, client, course_id):
        return client.post('/api/import', data=json.dumps({
            'course_id': course_id,
            'assignments': [{'_schema_version': 2, 'url': 'imported_fork', 'name': 'f', 'forked_id': 100,
                             'forked_version': 3}]}), content_type='application/json')

    def test_instructor_import_drops_fork_origin(self, client, test_data, act_as):
        act_as(test_data.user(CAPTAIN))
        assert self.post_bundle(client, PRIVATE_COURSE).status_code == 200
        imported = Assignment.by_url('imported_fork')
        assert imported.forked_id is None and imported.forked_version is None

    def test_admin_import_keeps_it(self, client, test_data, act_as):
        Role.new(UserRoles.ADMIN, user_id=50, course_id=None)
        act_as(User.by_id(50))
        assert self.post_bundle(client, PRIVATE_COURSE).status_code == 200
        assert Assignment.by_url('imported_fork').forked_id == 100
