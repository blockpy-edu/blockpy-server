"""
Grade passback to the LMS: the live post inside the student's request, and the Huey retry task.

- the outcome client is built with the configured socket timeout
- the readResult pre-check is off, so a post is exactly one replaceResult call
- transport errors (timeouts, refused connections) take the normal failure path, not a 500
- the retry task needs only an app context, re-sends the grade and restores the grading status
- the retry gives up after the configured number of attempts
"""
import httplib2
import pytest

# controllers.* can only be imported once an app exists, so those imports live in the fixtures below
from models import db
from models.assignment import Assignment
from models.course import Course
from models.enums import GradingStatuses, ReportStatus
from models.generics.definitions import LogEventType
from models.log_tables import SubmissionLog
from models.report import Report
from models.submission import Submission
from models.user import User

LULU = 100  # student in course 6
OUTCOME_URL = "https://lms.example.edu/api/lti/v1/tools/1/grade_passback"
SOURCEDID = "lulu-sourcedid-1"
SUCCESS_XML = b"<imsx_POXEnvelopeResponse><imsx_codeMajor>success</imsx_codeMajor></imsx_POXEnvelopeResponse>"
FAILURE_XML = b"<imsx_POXEnvelopeResponse><imsx_codeMajor>failure</imsx_codeMajor></imsx_POXEnvelopeResponse>"
ORIGINAL_NORMALIZE = httplib2.Http._normalize_headers


class FakeClient:
    """ Stands in for oauth2.Client: records how it was built and what it was asked to send. """
    calls = []
    kwargs = []
    behaviour = None

    def __init__(self, consumer, token=None, **kwargs):
        FakeClient.kwargs.append(kwargs)

    def add_certificate(self, **kwargs):
        pass

    def request(self, url, method, body=None, headers=None):
        FakeClient.calls.append((url, method, body))
        return FakeClient.behaviour()


def respond_with(content):
    return lambda: ({'status': '200'}, content)


def raise_error(error):
    def behaviour():
        raise error
    return behaviour


@pytest.fixture
def fake_client(app, monkeypatch):
    from controllers.pylti import common as pylti_common
    FakeClient.calls, FakeClient.kwargs = [], []
    FakeClient.behaviour = respond_with(SUCCESS_XML)
    monkeypatch.setattr(pylti_common.oauth2, "Client", FakeClient)
    return FakeClient


@pytest.fixture
def graded_submission(app, test_data):
    """ A submission in an LMS-linked course with a passback id, so grade_submission reaches the LMS. """
    course = Course.by_id(6)
    course.endpoint = OUTCOME_URL
    db.session.commit()
    assignment = Assignment.new(owner_id=10, course_id=6, type='blockpy', name='passback', url='passback_q')
    return Submission.load_or_new(assignment, LULU, 6, new_submission_url=SOURCEDID)


@pytest.fixture
def task_module(app):
    # tasks.tasks binds to current_app at import time, so it can only be imported under an app
    from tasks import tasks
    return tasks


@pytest.fixture
def retry_queue(task_module, monkeypatch):
    """
    Records what grade_submission hands to Huey as (args, delay). The task module binds to the
    first test app's Huey at import time, and that app's SQLite queue file is gone by the next
    test, so the real schedule() cannot be exercised here.
    """
    scheduled = []
    monkeypatch.setattr(task_module.queue_grade_submission, 'schedule',
                        lambda args=None, kwargs=None, delay=None, **rest: scheduled.append((args, delay)))
    return scheduled


def live_post(app, submission, score=1.0, correct=True):
    """ What /blockpy/update_submission does once it has parsed the request. """
    from controllers.pylti.post_grade import grade_submission
    lulu = User.by_id(LULU)
    with app.test_request_context('/blockpy/update_submission'):
        return grade_submission(submission.id, None, lulu, '127.0.0.1', score, correct, None, None, False)


def lms_events(submission_id):
    return [log.event_type for log in SubmissionLog.query.filter_by(submission_id=submission_id).all()
            if 'LMS' in log.event_type]


def tracker():
    return Report.query.filter_by(task='queue_lti_post_grade').one()


class TestLivePost:

    def test_success_is_one_replace_result_with_a_timeout(self, app, graded_submission, fake_client, retry_queue):
        report = live_post(app, graded_submission)
        assert report.submitted is True
        assert not report.retrying
        # No readResult pre-check: a single replaceResult to the course's outcome URL
        assert len(fake_client.calls) == 1
        url, method, body = fake_client.calls[0]
        assert url == OUTCOME_URL
        assert method == 'POST'
        assert b'replaceResultRequest' in body
        assert SOURCEDID.encode() in body
        assert fake_client.kwargs[0]['timeout'] == app.config['LTI_POST_TIMEOUT']
        assert LogEventType.LMS_SUBMISSION in lms_events(graded_submission.id)
        assert Report.query.filter_by(task='queue_lti_post_grade').count() == 0
        assert retry_queue == []

    def test_transport_error_is_a_recorded_failure_not_a_500(self, app, graded_submission, fake_client,
                                                             retry_queue, task_module):
        fake_client.behaviour = raise_error(OSError("timed out"))
        report = live_post(app, graded_submission)
        assert report.retrying is True
        assert report.submitted is False
        assert 'Could not reach the LMS' in report.first_failure_message()
        submission = Submission.by_id(graded_submission.id)
        assert submission.grading_status == GradingStatuses.FAILED
        assert LogEventType.LMS_FAILURE in lms_events(submission.id)
        # One tracking report, one delayed retry carrying that report's id and the request's report
        assert tracker().status == ReportStatus.QUEUED
        assert len(retry_queue) == 1
        args, delay = retry_queue[0]
        assert args[0] == tracker().id
        assert args[1] is report
        assert delay == task_module.GRADE_RETRY_DELAY_SECONDS
        # The class-level header patch was undone even though the request raised
        assert httplib2.Http._normalize_headers is ORIGINAL_NORMALIZE

    def test_rejected_message_is_a_recorded_failure(self, app, graded_submission, fake_client, retry_queue):
        fake_client.behaviour = respond_with(FAILURE_XML)
        report = live_post(app, graded_submission)
        assert report.retrying is True
        assert Submission.by_id(graded_submission.id).grading_status == GradingStatuses.FAILED
        assert tracker().status == ReportStatus.QUEUED
        assert len(retry_queue) == 1


class TestRetryTask:

    def test_retry_runs_without_a_request_and_restores_the_status(self, app, graded_submission, fake_client,
                                                                   task_module, retry_queue, monkeypatch):
        fake_client.behaviour = raise_error(ConnectionRefusedError("refused"))
        report = live_post(app, graded_submission)
        assert Submission.by_id(graded_submission.id).grading_status == GradingStatuses.FAILED
        retry = tracker()
        fake_client.calls.clear()
        fake_client.behaviour = respond_with(SUCCESS_XML)
        # The worker has no request context and no SERVER_NAME to build URLs from
        monkeypatch.setitem(app.config, 'SERVER_NAME', None)
        outcome = task_module.retry_grade_post(retry.id, report, False, False, 1.0, None, attempts_left=2)
        assert outcome is True
        url, method, body = fake_client.calls[0]
        assert url == OUTCOME_URL
        assert b'replaceResultRequest' in body
        assert SOURCEDID.encode() in body
        # The URL built during the request is reused (XML-escaped) rather than rebuilt in the worker
        assert report.view_url.replace('&', '&amp;').encode() in body
        assert Report.by_id(retry.id).status == ReportStatus.FINISHED
        submission = Submission.by_id(graded_submission.id)
        # correct=True had set FullyGraded before the LMS failed; the retry puts it back
        assert submission.grading_status == GradingStatuses.FULLY_GRADED
        assert LogEventType.LMS_SUBMISSION in lms_events(submission.id)

    def test_retry_gives_up_after_the_last_attempt(self, app, graded_submission, fake_client, task_module,
                                                   retry_queue):
        fake_client.behaviour = respond_with(FAILURE_XML)
        report = live_post(app, graded_submission)
        retry = tracker()
        with pytest.raises(task_module.GradeRetryFailed):
            task_module.retry_grade_post(retry.id, report, False, False, 1.0, None, attempts_left=1)
        assert Report.by_id(retry.id).status == ReportStatus.ERROR
        assert task_module.retry_grade_post(retry.id, report, False, False, 1.0, None, attempts_left=0) is False
        assert Report.by_id(retry.id).message.startswith("Too many retries")
        assert Submission.by_id(graded_submission.id).grading_status == GradingStatuses.FAILED

    def test_unexpected_errors_do_not_escape_the_task(self, app, graded_submission, fake_client, task_module,
                                                      retry_queue, monkeypatch):
        fake_client.behaviour = respond_with(FAILURE_XML)
        report = live_post(app, graded_submission)
        retry = tracker()
        monkeypatch.setattr(report, 'create_grade_post', lambda *a, **k: 1 / 0)
        assert task_module.retry_grade_post(retry.id, report, False, False, 1.0, None, attempts_left=0) is False
        assert 'ZeroDivisionError' in Report.by_id(retry.id).message

    def test_task_is_registered_with_huey_retries(self, task_module):
        task_class = task_module.queue_grade_submission.task_class
        assert task_class.default_retries == task_module.GRADE_RETRY_ATTEMPTS - 1
        assert task_class.default_retry_delay == task_module.GRADE_RETRY_DELAY_SECONDS
