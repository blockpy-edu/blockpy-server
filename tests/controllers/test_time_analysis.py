"""
Tests for the student time analysis page (courses/time_analysis) and the pure analysis
behind it (models/data_formats/time_analysis.py).
"""
import json
from datetime import datetime, timedelta

import pytest

from models.data_formats.time_analysis import (LogEvent, analyze_time, build_minute_rows, classify_event,
                                       describe_grade, format_duration, parse_idle_minutes,
                                       format_client_timezone)
from models import db
from models.log_tables import SubmissionLog
from tests.factory.factories import SubmissionFactory


START = datetime(2026, 2, 25, 23, 0, 0)


def make_event(seconds, assignment_id=1, event_type="File.Edit", category="", label="",
               message="", message_length=None, event_id=None):
    return LogEvent(id=event_id if event_id is not None else int(seconds * 10),
                    when=START + timedelta(seconds=seconds),
                    assignment_id=assignment_id, submission_id=None,
                    event_type=event_type, category=category, label=label, message=message,
                    message_length=message_length if message_length is not None else len(message))


NAMES = {1: "Exam 1.1", 2: "Exam 1.2", 3: "Exam Intro"}


class TestAnalyzeTime:
    def test_no_events(self):
        analysis = analyze_time([], 300, NAMES)
        assert analysis.student_events == 0
        assert analysis.sessions == []
        assert analysis.minutes == []
        assert analysis.first is None

    def test_single_session_without_gaps(self):
        events = [make_event(0), make_event(30), make_event(60), make_event(100)]
        analysis = analyze_time(events, 300, NAMES)
        assert analysis.span_seconds == 100
        assert analysis.active_seconds == 100
        assert analysis.idle_seconds == 0
        assert analysis.gaps == []
        assert len(analysis.sessions) == 1
        assert analysis.sessions[0].events == 4
        assert analysis.sessions[0].seconds == 100

    def test_idle_gap_splits_sessions(self):
        # Two minutes of work, a 20 minute gap, then three more minutes
        events = [make_event(0), make_event(60), make_event(120),
                  make_event(120 + 1200), make_event(120 + 1200 + 180)]
        analysis = analyze_time(events, 300, NAMES)
        assert len(analysis.gaps) == 1
        gap = analysis.gaps[0]
        assert gap.seconds == 1200
        assert gap.start == START + timedelta(seconds=120)
        assert gap.end == START + timedelta(seconds=1320)
        assert analysis.idle_seconds == 1200
        assert analysis.active_seconds == 120 + 180
        assert analysis.span_seconds == analysis.active_seconds + analysis.idle_seconds
        assert [session.seconds for session in analysis.sessions] == [120, 180]
        assert [session.events for session in analysis.sessions] == [3, 2]
        assert analysis.longest_gap is gap

    def test_threshold_controls_what_counts_as_idle(self):
        events = [make_event(0), make_event(240), make_event(480)]
        strict = analyze_time(events, 60, NAMES)
        lenient = analyze_time(events, 300, NAMES)
        assert len(strict.gaps) == 2 and strict.active_seconds == 0
        assert len(lenient.gaps) == 0 and lenient.active_seconds == 480

    def test_active_time_is_credited_to_the_earlier_assignment(self):
        # Working on 1 for 100s, then on 2 for 50s, then a final event back on 1
        events = [make_event(0, 1), make_event(100, 2), make_event(150, 1)]
        analysis = analyze_time(events, 300, NAMES)
        by_id = {summary.assignment_id: summary for summary in analysis.assignments}
        assert by_id[1].active_seconds == 100
        assert by_id[2].active_seconds == 50
        assert by_id[1].events == 2 and by_id[2].events == 1
        assert by_id[1].name == "Exam 1.1"
        assert [summary.assignment_id for summary in analysis.assignments] == [1, 2]

    def test_reading_ping_delay_covers_quiet_stretch(self):
        # The reading page promised its next ping in 10 minutes, so 9 quiet minutes are not idle
        ping = make_event(0, 3, "Resource.View", "reading", "read",
                          json.dumps({"count": 12, "delay": 600000, "progress": 50}))
        events = [ping, make_event(540, 3, "Resource.View", "reading", "read",
                                   json.dumps({"count": 13, "delay": 630000, "progress": 60}))]
        analysis = analyze_time(events, 300, NAMES)
        assert analysis.gaps == []
        assert analysis.active_seconds == 540
        # ...but a stretch beyond the promised delay (plus slack) is still a gap
        events = [ping, make_event(700, 3, "Resource.View", "reading", "read", "{}")]
        analysis = analyze_time(events, 300, NAMES)
        assert len(analysis.gaps) == 1

    def test_grader_and_instructor_events_do_not_count_as_activity(self):
        events = [make_event(0), make_event(60),
                  make_event(3600, event_type="X-View.Submission", message='{"viewer": 1}'),
                  make_event(7200, event_type="extend_time", message="User 1 set time limit")]
        analysis = analyze_time(events, 300, NAMES)
        assert analysis.events == 4
        assert analysis.student_events == 2
        assert analysis.last == START + timedelta(seconds=60)
        assert analysis.gaps == []
        assert analysis.flag_counts["Submission viewed by a grader"] == 1

    def test_timer_events_are_found(self):
        events = [make_event(0, event_type="start_timer"), make_event(10),
                  make_event(3000, event_type="timer_expired")]
        analysis = analyze_time(events, 300, NAMES)
        assert analysis.timer_started == START
        assert analysis.timer_ended == START + timedelta(seconds=3000)
        assert analysis.timer_ended_how == "expired"

    def test_active_time_inside_the_timer_window(self):
        # 60s of work before the timer, 120s during, then a late event well after it expired
        events = [make_event(0), make_event(60, event_type="start_timer"), make_event(120),
                  make_event(180), make_event(200, event_type="timer_expired"),
                  make_event(260), make_event(280)]
        analysis = analyze_time(events, 300, NAMES)
        assert analysis.timer_started == START + timedelta(seconds=60)
        assert analysis.timer_ended == START + timedelta(seconds=200)
        assert analysis.timer_active_seconds == 140
        assert analysis.active_seconds == 280
        assert analysis.events_after_timer == 2

    def test_flags_are_counted_by_family(self):
        events = [make_event(0, event_type="X-Submission.LMS", message="0.5|10.0"),
                  make_event(1, event_type="X-Submission.LMS", message="1.0|10.0"),
                  make_event(2, event_type="X-Editor.Paste")]
        analysis = analyze_time(events, 300, NAMES)
        assert analysis.flag_counts == {"Grade synced": 2, "Pasted text": 1}

    def test_client_timezone_is_the_most_common(self):
        events = [make_event(0), make_event(1), make_event(2)]
        events[0].client_timezone = "300"
        events[1].client_timezone = "300"
        events[2].client_timezone = "240"
        analysis = analyze_time(events, 300, NAMES)
        assert analysis.client_timezone == "UTC-05:00"

    def test_events_are_sorted_before_analysis(self):
        events = [make_event(100, event_id=2), make_event(0, event_id=1)]
        analysis = analyze_time(events, 300, NAMES)
        assert analysis.first == START
        assert analysis.active_seconds == 100


class TestMinuteRows:
    def test_minute_rows_bucket_events_and_collapse_gaps(self):
        events = [make_event(5), make_event(20), make_event(70, 2, "Run.Program"),
                  make_event(70 + 1500), make_event(70 + 1500 + 61)]
        analysis = analyze_time(events, 300, NAMES)
        kinds = [(row.kind, row.events) for row in analysis.minutes]
        # minute 0 (2 edits), minute 1 (1 run), the gap, minute 26 (1 edit), minute 27 (1 edit)
        assert kinds == [("minute", 2), ("minute", 1), ("gap", 0), ("minute", 1), ("minute", 1)]
        first = analysis.minutes[0]
        assert first.elapsed_seconds == 0
        assert [part.name for part in first.assignments] == ["Exam 1.1"]
        assert first.assignments[0].counts["edit"] == 2
        assert "2 edits" in first.assignments[0].summary()
        second = analysis.minutes[1]
        assert second.assignments[0].name == "Exam 1.2"
        assert "1 run" in second.assignments[0].summary()
        gap_row = analysis.minutes[2]
        assert gap_row.gap is analysis.gaps[0]
        assert gap_row.seconds == 1500
        assert gap_row.start == START + timedelta(seconds=70)

    def test_quiet_minutes_inside_active_stretch_are_listed(self):
        # Events at 0:00 and 0:03 with a 5 minute threshold: minutes 1 and 2 are quiet, not idle
        events = [make_event(0), make_event(180)]
        analysis = analyze_time(events, 300, NAMES)
        assert [row.kind for row in analysis.minutes] == ["minute", "quiet", "quiet", "minute"]
        assert analysis.minutes[1].elapsed_seconds == 60

    def test_long_quiet_runs_collapse(self):
        events = [make_event(0), make_event(10 * 60)]
        analysis = analyze_time(events, 15 * 60, NAMES)
        kinds = [row.kind for row in analysis.minutes]
        assert kinds == ["minute", "quiet", "minute"]
        assert analysis.minutes[1].seconds == 9 * 60

    def test_flags_and_feedback_and_code_length_in_minute(self):
        events = [make_event(0, message="print(1)"),
                  make_event(5, event_type="Resource.View", category="reading", label="visibility",
                             message="hidden"),
                  make_event(10, event_type="Intervention", category="syntax", label="Syntax Error",
                             message="oops"),
                  make_event(20, event_type="X-Editor.Paste"),
                  make_event(30, message="print(1)\nprint(2)")]
        analysis = analyze_time(events, 300, NAMES)
        row = analysis.minutes[0]
        assert row.flags == ["Tab hidden", "Pasted text"]
        assert row.has_warning
        part = row.assignments[0]
        assert part.last_feedback == "Syntax Error"
        assert part.code_length == len("print(1)\nprint(2)")
        assert "feedback: Syntax Error" in part.summary()
        assert "code: 17 chars" in part.summary()

    def test_summary_labels_pluralize(self):
        events = [make_event(0, event_type="File.Create", message="", message_length=0),
                  make_event(1, event_type="Compile.Error"), make_event(2, event_type="Compile.Error"),
                  make_event(3, event_type="Run.Program")]
        analysis = analyze_time(events, 300, NAMES)
        summary = analysis.minutes[0].assignments[0].summary()
        assert "1 run" in summary and "2 syntax errors" in summary and "1 file created" in summary

    def test_build_minute_rows_ignores_non_student_only_input(self):
        events = [make_event(0, event_type="X-View.Submission")]
        assert build_minute_rows(events, [], START, NAMES.get) == []


class TestHelpers:
    def test_classify_event(self):
        assert classify_event("File.Edit", "", "", "") == ("edit", None)
        assert classify_event("Session.Start", "", "", "{}") == ("session", "Opened assignment")
        assert classify_event("X-Submission.LMS", "", "", "0.5|10.0") == \
            ("grade", "Grade synced: 50% (5/10)")
        assert classify_event("X-Display.Fullscreen.Exit", "", "", "") == ("fullscreen", "Fullscreen exited")
        assert classify_event("X-View.Change", "", "", "split") == ("view", "Switched editor to split")
        assert classify_event("Something.New", "", "", "") == ("other", None)

    def test_describe_grade_handles_garbage(self):
        assert describe_grade("") == "Grade synced"
        assert describe_grade("not|numbers") == "Grade synced"

    def test_format_duration(self):
        assert format_duration(None) == ""
        assert format_duration(45) == "45s"
        assert format_duration(125) == "2m 5s"
        assert format_duration(3725) == "1h 2m"
        assert format_duration(7200) == "2h 0m"

    def test_parse_idle_minutes(self):
        assert parse_idle_minutes(None) == 5.0
        assert parse_idle_minutes("abc") == 5.0
        assert parse_idle_minutes("2.5") == 2.5
        assert parse_idle_minutes("0") == 0.5
        assert parse_idle_minutes("99999") == 24 * 60

    def test_format_client_timezone(self):
        assert format_client_timezone("240") == "UTC-04:00"
        assert format_client_timezone("-330") == "UTC+05:30"
        assert format_client_timezone("") is None


def add_log(submission, assignment, when, event_type="File.Edit", message="print('hi')",
            category="", label=""):
    log = SubmissionLog.new(submission.id, 0, assignment.id, 0, submission.course_id,
                            submission.user_id, event_type, "answer.py", category, label,
                            message, "", "", extended=False)
    log.date_created = when
    db.session.commit()
    return log


@pytest.fixture
def exam_logs(client, test_data):
    """ Rimuru (300, a learner in course 8) worked the Midterm Exam group (6, assignment 112):
        a few minutes of work, a long gap, and a little more work. """
    course = test_data.courses.by(id=8)
    student = test_data.user("rimuru@blockpy.com")
    assignment = test_data.assignments.by(id=112)
    group = test_data.assignment_groups.by(id=6)
    submission = SubmissionFactory.create_submission(assignment=assignment, user=student,
                                                     course=course, assignment_group=group)
    when = datetime(2026, 3, 1, 15, 0, 0)
    add_log(submission, assignment, when, "start_timer", "")
    add_log(submission, assignment, when + timedelta(seconds=5), "Session.Start", "{}")
    add_log(submission, assignment, when + timedelta(seconds=30))
    add_log(submission, assignment, when + timedelta(seconds=90))
    add_log(submission, assignment, when + timedelta(minutes=2), "X-Editor.Paste", "")
    add_log(submission, assignment, when + timedelta(minutes=2, seconds=30))
    add_log(submission, assignment, when + timedelta(minutes=40))
    add_log(submission, assignment, when + timedelta(minutes=41), "X-Submission.LMS", "1.0|10.0")
    return dict(course=course, student=student, assignment=assignment, group=group,
                submission=submission)


class TestTimeAnalysisPage:
    def url(self, exam_logs, **params):
        return f"/courses/time_analysis/{exam_logs['course'].id}/{exam_logs['student'].id}", params

    def test_anonymous_cannot_view(self, client, exam_logs):
        url, params = self.url(exam_logs, assignment_group_id=exam_logs['group'].id)
        response = client.get(url, query_string=params)
        # Anonymous visitors are not graders; the grader check answers with a JSON failure
        assert response.get_json()['success'] is False

    def test_student_cannot_view(self, client, exam_logs, act_as):
        act_as(user_by_email("benimaru@blockpy.com"))
        url, params = self.url(exam_logs, assignment_group_id=exam_logs['group'].id)
        response = client.get(url, query_string=params)
        assert response.status_code == 200
        assert response.get_json()['success'] is False

    def test_student_cannot_view_own_exam(self, client, exam_logs, act_as):
        act_as(exam_logs['student'])
        url, params = self.url(exam_logs, assignment_group_id=exam_logs['group'].id)
        response = client.get(url, query_string=params)
        assert response.get_json()['success'] is False

    def test_needs_a_group_or_assignment(self, client, exam_logs, act_as, test_data):
        act_as(test_data.user("ada@blockpy.com"))
        url, params = self.url(exam_logs)
        response = client.get(url)
        assert response.get_json()['success'] is False

    def test_instructor_sees_group_analysis(self, client, exam_logs, act_as, test_data):
        act_as(test_data.user("ada@blockpy.com"))
        url, params = self.url(exam_logs, assignment_group_id=exam_logs['group'].id)
        response = client.get(url, query_string=params)
        assert response.status_code == 200
        page = response.data.decode("utf8")
        assert "Time Analysis" in page
        assert "Rimuru" in page
        assert "Midterm Exam" in page
        # 2m30s of work, a 37m30s gap, then 1 minute of work
        assert "Idle gap: no events for <strong>37m 30s</strong>" in page
        assert "Timer started" in page
        assert "Pasted text" in page
        assert "Grade synced: 100% (10/10)" in page
        assert "2026-03-01T15:00:00" in page  # UTC timestamps for the client-side formatter

    def test_instructor_sees_assignment_analysis_with_custom_threshold(self, client, exam_logs,
                                                                       act_as, test_data):
        act_as(test_data.user("ada@blockpy.com"))
        url, params = self.url(exam_logs, assignment_id=exam_logs['assignment'].id, idle_minutes=1)
        response = client.get(url, query_string=params)
        assert response.status_code == 200
        page = response.data.decode("utf8")
        assert "History log" in page
        assert 'name="idle_minutes"' in page and 'value="1"' in page
        # With a one minute threshold the 60s and 90s pauses are not gaps, but 37m30s still is
        assert "Idle gap: no events for <strong>37m 30s</strong>" in page

    def test_no_events_shows_message(self, client, exam_logs, act_as, test_data):
        act_as(test_data.user("ada@blockpy.com"))
        other_student = test_data.user("benimaru@blockpy.com")
        response = client.get(f"/courses/time_analysis/{exam_logs['course'].id}/{other_student.id}",
                              query_string={"assignment_group_id": exam_logs['group'].id})
        assert response.status_code == 200
        assert b"nothing to analyze" in response.data

    def test_missing_group(self, client, exam_logs, act_as, test_data):
        act_as(test_data.user("ada@blockpy.com"))
        url, params = self.url(exam_logs, assignment_group_id=999999)
        response = client.get(url, query_string=params)
        assert response.get_json()['success'] is False
        assert "does not exist" in response.get_json()['message']


def user_by_email(email):
    from models.user import User
    return User.query.filter_by(email=email).first()
