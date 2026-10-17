"""
Tests for recording unhandled server errors in error_log, with a lazily written
access_log row for the who and where. See docs/specs/audit-logging-review.md, phase 5.
"""
from datetime import datetime, timedelta, timezone

import pytest
from click.testing import CliRunner

from models import db
from models.log_tables import AccessLog, ErrorLog
from models.role import Role
from models.user import User


@pytest.fixture
def boom_app(app):
    """ The test app with routes that fail in the ways the handlers must cope with. """
    from controllers.pylti.common import LTIException
    # TESTING makes Flask re-raise exceptions instead of running the 500 handler
    app.config['PROPAGATE_EXCEPTIONS'] = False

    @app.route('/boom')
    def boom_route():
        raise RuntimeError("boom")

    @app.route('/boom_after_add')
    def boom_after_add_route():
        # An unflushed object in the session when the error hits
        db.session.add(Role(name='learner', user_id=100, course_id=6))
        raise RuntimeError("boom after add")

    @app.route('/boom_lti')
    def boom_lti_route():
        raise LTIException("bad launch")

    return app


class TestErrorLog:

    def test_error_is_recorded_with_access_row(self, boom_app, client, test_data, act_as):
        act_as(test_data.user("lulu@blockpy.com"))
        response = client.get('/boom')
        assert response.status_code == 500
        access = AccessLog.query.one()
        assert (access.subject_id, access.route, access.method) == (100, '/boom', 'GET')
        error = ErrorLog.query.one()
        assert error.access_log_id == access.id
        assert (error.error_type, error.message) == ('RuntimeError', 'boom')
        assert 'boom_route' in error.traceback
        assert 'RuntimeError: boom' in error.traceback

    def test_anonymous_error_uses_anonymous_user(self, boom_app, client, test_data):
        response = client.get('/boom')
        assert response.status_code == 500
        access = AccessLog.query.one()
        assert User.by_id(access.subject_id).anonymous is True
        assert ErrorLog.query.count() == 1

    def test_recording_failure_never_propagates(self, boom_app, client, test_data, act_as, monkeypatch):
        def explode(*args, **kwargs):
            raise RuntimeError("database is gone")
        monkeypatch.setattr(ErrorLog, 'new', explode)
        act_as(test_data.user("lulu@blockpy.com"))
        response = client.get('/boom')
        assert response.status_code == 500
        assert b'<html' in response.data.lower()
        assert ErrorLog.query.count() == 0

    def test_session_is_rolled_back_before_recording(self, boom_app, client, test_data, act_as):
        act_as(test_data.user("lulu@blockpy.com"))
        response = client.get('/boom_after_add')
        assert response.status_code == 500
        assert AccessLog.query.count() == 1
        assert ErrorLog.query.one().message == 'boom after add'
        # The unflushed role was discarded with the failed transaction
        assert Role.query.filter_by(user_id=100, course_id=6).count() == 1

    def test_lti_exception_is_recorded(self, boom_app, client, test_data, act_as):
        act_as(test_data.user("lulu@blockpy.com"))
        response = client.get('/boom_lti')
        assert response.status_code == 500
        assert b'LTI Exception: bad launch' in response.data
        error = ErrorLog.query.one()
        assert (error.error_type, error.message) == ('LTIException', 'bad launch')
        assert error.access_log.route == '/boom_lti'

    def test_json_clients_get_json(self, boom_app, client, test_data, act_as):
        act_as(test_data.user("lulu@blockpy.com"))
        response = client.get('/boom', headers={"Accept": "application/json"})
        assert response.status_code == 500
        assert response.get_json()["success"] is False
        assert ErrorLog.query.count() == 1


class TestPruneErrorLogs:

    def test_prune_removes_old_rows_and_orphans(self, app, test_data):
        from scripts.db_commands import prune_error_logs
        old = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=100)
        stale = AccessLog.new(100, '/old', 'GET', '1.1.1.1', '', '')
        stale_error = ErrorLog.new(stale.id, 'RuntimeError', 'old', 'tb')
        orphan = AccessLog.new(100, '/orphan', 'GET', '1.1.1.1', '', '')
        for row in (stale, stale_error, orphan):
            row.date_created = old
        db.session.commit()
        fresh = AccessLog.new(100, '/fresh', 'GET', '1.1.1.1', '', '')
        ErrorLog.new(fresh.id, 'RuntimeError', 'fresh', 'tb')

        result = CliRunner().invoke(prune_error_logs, ['--days', '90'])
        assert result.exit_code == 0, result.output
        assert "Deleted 1 error_log rows and 2 orphaned access_log rows" in result.output
        assert [access.route for access in AccessLog.query.all()] == ['/fresh']
        assert ErrorLog.query.count() == 1

        result = CliRunner().invoke(prune_error_logs, ['--days', '0'])
        assert result.exit_code == 0, result.output
        assert AccessLog.query.count() == 0 and ErrorLog.query.count() == 0

    def test_anonymous_cleanup_removes_error_records(self, app, test_data):
        from models.generics.base import find_all_linked_resources, mass_delete
        anonymous = User.by_id(1000)
        access = AccessLog.new(anonymous.id, '/boom', 'GET', '1.1.1.1', '', '')
        ErrorLog.new(access.id, 'RuntimeError', 'boom', 'tb')
        graph = find_all_linked_resources([anonymous])
        assert {type(row).__name__ for row in graph['AccessLog']} == {'AccessLog'}
        assert len(graph['ErrorLog']) == 1
        graph.setdefault('User', []).append(anonymous)
        mass_delete(graph)
        assert AccessLog.query.count() == 0 and ErrorLog.query.count() == 0
        assert User.by_id(1000) is None
