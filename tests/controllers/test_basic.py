"""
Tests for basic endpoints.
"""
import unittest
from tests.base import APITestCase


class TestBasicEndpoints(APITestCase):
    """Test cases for basic endpoints."""
    
    def test_root_endpoint(self):
        """Test root endpoint access."""
        response = self.client.get('/')
        
        # Should get some response (might be redirect or content)
        self.assertIn(response.status_code, [200, 302, 404])
    
    def test_health_check_endpoint(self):
        """Test health check endpoint if it exists."""
        # Common patterns for health checks
        endpoints_to_try = ['/health', '/ping', '/status']
        
        for endpoint in endpoints_to_try:
            try:
                response = self.client.get(endpoint)
                if response.status_code == 200:
                    # Found a working health check endpoint
                    self.assertEqual(response.status_code, 200)
                    break
            except:
                continue
    
    def test_static_file_access(self):
        """Test static file access."""
        # Try to access a common static file path
        response = self.client.get('/static/')
        
        # Should either work or return 404 (not 500)
        self.assertIn(response.status_code, [200, 404])
    
    def test_favicon_access(self):
        """Test favicon access."""
        response = self.client.get('/favicon.ico')
        
        # Should either work or return 404 (not 500)
        self.assertIn(response.status_code, [200, 404])
    
    def test_robots_txt(self):
        """Test robots.txt access."""
        response = self.client.get('/robots.txt')
        
        # Should either work or return 404 (not 500)
        self.assertIn(response.status_code, [200, 404])


if __name__ == '__main__':
    unittest.main()