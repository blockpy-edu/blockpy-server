"""
Pytest configuration and fixtures for BlockPy tests.
"""
import os
import tempfile
from contextlib import contextmanager

import pytest
from flask import Flask

from main import create_app
from models import db


@pytest.fixture
def app():
    """Create and configure a new app instance for each test."""
    # Create a temporary file to isolate the database for each test
    db_fd, db_path = tempfile.mkstemp()
    
    app = create_app({
        'TESTING': True,
        'SQLALCHEMY_DATABASE_URI': f'sqlite:///{db_path}',
        'WTF_CSRF_ENABLED': False,
        'SECRET_KEY': 'test-secret-key'
    })
    
    with app.app_context():
        db.create_all()
        yield app
        db.drop_all()
    
    os.close(db_fd)
    os.unlink(db_path)


@pytest.fixture
def client(app):
    """A test client for the app."""
    return app.test_client()


@pytest.fixture
def runner(app):
    """A test runner for the app's Click commands."""
    return app.test_cli_runner()


@contextmanager
def app_context():
    """Create an app context for testing outside of fixtures."""
    app = create_app('testing')
    with app.app_context():
        db.create_all()
        try:
            yield app
        finally:
            db.drop_all()