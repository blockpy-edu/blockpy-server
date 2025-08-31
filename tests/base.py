"""
Base test classes and utilities for BlockPy tests.
"""
import unittest
from flask import Flask
from flask_testing import TestCase

from main import create_app
from models import db


class BaseTestCase(TestCase):
    """Base test case with database setup and teardown."""
    
    def create_app(self) -> Flask:
        """Create and configure the Flask app for testing."""
        app = create_app('testing')
        app.config.update(
            TESTING=True,
            SQLALCHEMY_DATABASE_URI='sqlite:///:memory:',
            WTF_CSRF_ENABLED=False,
            SECRET_KEY='test-secret-key',
            SECURITY_PASSWORD_SALT='test-salt'
        )
        return app
    
    def setUp(self):
        """Set up test database."""
        db.create_all()
        
    def tearDown(self):
        """Clean up test database."""
        db.session.remove()
        db.drop_all()


class DatabaseTestCase(unittest.TestCase):
    """Test case for database operations without Flask-Testing dependency."""
    
    def setUp(self):
        """Set up test database and app context."""
        self.app = create_app('testing')
        self.app.config.update(
            TESTING=True,
            SQLALCHEMY_DATABASE_URI='sqlite:///:memory:',
            WTF_CSRF_ENABLED=False,
            SECRET_KEY='test-secret-key',
            SECURITY_PASSWORD_SALT='test-salt'
        )
        self.app_context = self.app.app_context()
        self.app_context.push()
        self.client = self.app.test_client()
        db.create_all()
        
    def tearDown(self):
        """Clean up test database and app context."""
        db.session.remove()
        db.drop_all()
        self.app_context.pop()


class APITestCase(DatabaseTestCase):
    """Base test case for API endpoint testing."""
    
    def setUp(self):
        """Set up API test environment."""
        super().setUp()
        # Add any API-specific setup here
        
    def make_request(self, method, url, **kwargs):
        """Make an API request and return the response."""
        method_func = getattr(self.client, method.lower())
        return method_func(url, **kwargs)
    
    def assert_json_response(self, response, expected_status=200):
        """Assert that response is JSON and has expected status."""
        self.assertEqual(response.status_code, expected_status)
        self.assertEqual(response.content_type, 'application/json')
        return response.get_json()