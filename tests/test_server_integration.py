"""
Integration tests for BlockPy server that set up a server and test interactions.

These tests create a test server instance and validate various endpoints,
authentication flows, and API interactions.
"""

import sys
import os
import unittest
import json
from flask import g

# Add parent directory to path to import main module
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import create_app
from models import db


# Shared test app and client for all test classes
_test_app = None
_test_client = None
_app_context = None


def setUpModule():
    """Set up the test app once for all test classes in this module."""
    global _test_app, _test_client, _app_context
    _test_app = create_app('testing')
    _test_client = _test_app.test_client()
    _app_context = _test_app.app_context()
    _app_context.push()
    
    # Create all database tables for testing
    with _test_app.app_context():
        db.create_all()


def tearDownModule():
    """Clean up after all tests in this module."""
    global _app_context
    if _app_context:
        _app_context.pop()


class ServerIntegrationTests(unittest.TestCase):
    """
    Integration tests that actually set up a server and test interactions with it.
    """
    
    @classmethod
    def setUpClass(cls):
        """Use the shared test app."""
        cls.app = _test_app
        cls.client = _test_client
    
    @classmethod
    def tearDownClass(cls):
        """Clean up after all tests."""
        pass
    
    def test_app_exists(self):
        """Test that the app is created successfully."""
        self.assertIsNotNone(self.app)
        self.assertTrue(self.app.testing)
    
    def test_index_route(self):
        """Test that the index route is accessible."""
        response = self.client.get('/')
        self.assertEqual(response.status_code, 200)
    
    def test_about_route(self):
        """Test that the about route is accessible."""
        response = self.client.get('/about')
        self.assertEqual(response.status_code, 200)
    
    def test_about_route_alternate(self):
        """Test that the about route with trailing slash is accessible."""
        response = self.client.get('/about/')
        self.assertEqual(response.status_code, 200)
    
    def test_public_route(self):
        """Test that the public route is accessible."""
        response = self.client.get('/public')
        self.assertEqual(response.status_code, 200)
    
    def test_contact_route(self):
        """Test that the contact route is accessible."""
        response = self.client.get('/contact')
        self.assertEqual(response.status_code, 200)
    
    def test_favicon_route(self):
        """Test that the favicon route is accessible."""
        response = self.client.get('/favicon.ico')
        # Should return 200 if file exists, or 404 if not - both are valid
        self.assertIn(response.status_code, [200, 404])
    
    def test_site_map_route(self):
        """Test that the site-map route is accessible."""
        response = self.client.get('/site-map')
        self.assertEqual(response.status_code, 200)
    
    def test_nonexistent_route(self):
        """Test that nonexistent routes return 404."""
        response = self.client.get('/this-route-does-not-exist')
        self.assertEqual(response.status_code, 404)
    
    def test_app_context_available(self):
        """Test that the Flask application context is available."""
        with self.app.app_context():
            self.assertIsNotNone(g)


class APIEndpointTests(unittest.TestCase):
    """
    Test API endpoints with proper request/response handling.
    """
    
    @classmethod
    def setUpClass(cls):
        """Use the shared test app."""
        cls.app = _test_app
        cls.client = _test_client
    
    @classmethod
    def tearDownClass(cls):
        """Clean up after all tests."""
        pass
    
    def test_json_content_type(self):
        """Test sending JSON data to endpoints."""
        # This is a basic test to ensure JSON handling works
        # Specific endpoints may need authentication
        response = self.client.post(
            '/site-map',
            data=json.dumps({'test': 'data'}),
            content_type='application/json'
        )
        # We just check it doesn't crash - actual status depends on endpoint
        self.assertIsNotNone(response.status_code)
    
    def test_get_with_query_parameters(self):
        """Test GET requests with query parameters."""
        response = self.client.get('/site-map?format=html')
        self.assertIsNotNone(response.status_code)


class HTTPMethodTests(unittest.TestCase):
    """
    Test different HTTP methods on server endpoints.
    """
    
    @classmethod
    def setUpClass(cls):
        """Use the shared test app."""
        cls.app = _test_app
        cls.client = _test_client
    
    @classmethod
    def tearDownClass(cls):
        """Clean up after all tests."""
        pass
    
    def test_get_method_index(self):
        """Test GET method on index."""
        response = self.client.get('/')
        self.assertEqual(response.status_code, 200)
    
    def test_post_method_index(self):
        """Test POST method on index."""
        response = self.client.post('/')
        # Should work since the route accepts POST
        self.assertIn(response.status_code, [200, 302, 400, 405])
    
    def test_head_method_index(self):
        """Test HEAD method on index."""
        response = self.client.head('/')
        # Flask automatically handles HEAD for GET routes
        self.assertIn(response.status_code, [200, 405])


class ErrorHandlingTests(unittest.TestCase):
    """
    Test error handling in the server.
    """
    
    @classmethod
    def setUpClass(cls):
        """Use the shared test app."""
        cls.app = _test_app
        cls.client = _test_client
    
    @classmethod
    def tearDownClass(cls):
        """Clean up after all tests."""
        pass
    
    def test_404_error(self):
        """Test that 404 errors are handled properly."""
        response = self.client.get('/definitely-does-not-exist-xyz')
        self.assertEqual(response.status_code, 404)
    
    def test_405_method_not_allowed(self):
        """Test method not allowed errors."""
        # Try a method that's likely not allowed on a specific endpoint
        response = self.client.put('/')
        # PUT is not in the allowed methods for index
        self.assertEqual(response.status_code, 405)


class ConfigurationTests(unittest.TestCase):
    """
    Test server configuration settings.
    """
    
    @classmethod
    def setUpClass(cls):
        """Use the shared test app."""
        cls.app = _test_app
    
    @classmethod
    def tearDownClass(cls):
        """Clean up after all tests."""
        pass
    
    def test_testing_mode_enabled(self):
        """Test that testing mode is enabled."""
        self.assertTrue(self.app.config['TESTING'])
    
    def test_database_configuration(self):
        """Test that database is configured."""
        self.assertIn('SQLALCHEMY_DATABASE_URI', self.app.config)
        # Should be using in-memory SQLite for tests
        self.assertIn('sqlite', self.app.config['SQLALCHEMY_DATABASE_URI'])
    
    def test_secret_key_configured(self):
        """Test that secret key is configured."""
        self.assertIsNotNone(self.app.config.get('SECRET_KEY'))
        self.assertNotEqual(self.app.config.get('SECRET_KEY'), '')


if __name__ == '__main__':
    unittest.main()
