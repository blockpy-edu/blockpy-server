"""
Pytest configuration and fixtures for BlockPy tests.
"""
import os
import tempfile
from contextlib import contextmanager

import pytest
from flask import Flask
from sqlalchemy import event
from tests.factory.loader import test_data

from main import create_app
from models import db

STATIC_SETTINGS = {
    '_BASE_FILE': 'testing_configuration.py',
    'TESTING': True,
    'HOST': 'localhost',
    'SERVER_NAME': 'localhost',
    'PORT': 5001,
    'SITE_URL': 'localhost:5001',
    'TASK_QUEUE_STYLE': 'sqlite',
    'WTF_CSRF_ENABLED': False,
    'SECRET_KEY': 'test-secret-key',
    "SESSION_COOKIE_DOMAIN": None,
    "SESSION_COOKIE_SECURE": False,
    "COOKIE_SAMESITE": "Lax",
    "SESSION_COOKIE_HTTPONLY": False,
    "SESSION_COOKIE_SAMESITE": "Lax",
}

def run_server():
    with tempfile.TemporaryDirectory() as tmp:
        db_path = os.path.join(tmp, "test.db")
        task_db_path = os.path.join(tmp, "task.db")

        app = create_app('testing', {
            **STATIC_SETTINGS,
            'SQLALCHEMY_DATABASE_URI': f'sqlite:///{db_path}',
            'SQLALCHEMY_DATABASE_URI_ALEMBIC': f'sqlite:///{db_path}',
            'TASK_DB_URI': task_db_path,
        })

        with app.app_context():
            # SQLite ignores foreign keys unless told otherwise, while production Postgres
            # enforces them. Opt in with BLOCKPY_TEST_FOREIGN_KEYS=1. It is off by default
            # because two pre-existing bugs violate constraints unrelated to audit logging:
            # removing an assignment group leaves its memberships behind, and removing a
            # course leaves its roles behind (test_remove_group_instructor_allowed and
            # test_remove_logs_delete fail with it on).
            if os.environ.get('BLOCKPY_TEST_FOREIGN_KEYS', '').lower() in ('1', 'true', 'yes'):
                @event.listens_for(db.engine, 'connect')
                def _enable_sqlite_foreign_keys(dbapi_connection, connection_record):
                    cursor = dbapi_connection.cursor()
                    cursor.execute('PRAGMA foreign_keys=ON')
                    cursor.close()
            db.create_all()
            try:
                yield app
            finally:
                db.session.remove()
                db.drop_all()
                db.engine.dispose()

@pytest.fixture
def app():
    """Create and configure a new app instance for each test."""
    # Create a temporary file to isolate the database for each test
    yield from run_server()


@pytest.fixture
def client(app):
    """A test client for the app."""
    with app.test_client() as client:
        yield client


@pytest.fixture
def runner(app):
    """A test runner for the app's Click commands."""
    with app.test_cli_runner() as runner:
        yield runner


@contextmanager
def app_context():
    """Create an app context for testing outside of fixtures."""
    yield from run_server()


@pytest.fixture
def act_as(client):
    def _act_as(user):
        # user can be a model object, or ID/email lookup
        with client.session_transaction() as sess:
            # Example for Flask-Login:
            sess["_user_id"] = str(user.get_id())
            sess["_fresh"] = True
        #from flask import session
        #print(session["_user_id"])
        return client
    return _act_as