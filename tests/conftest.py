"""
Pytest configuration and fixtures for BlockPy tests.
"""
import os
import tempfile
from contextlib import contextmanager

import pytest
from quart import Flask
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
        #from quart import session
        #print(session["_user_id"])
        return client
    return _act_as