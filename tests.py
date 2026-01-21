"""
Testing functionality specifically related to LTI login/access.
"""

import unittest

from quart import g

from main import create_app


class BasicTests(unittest.TestCase):
    """
    Confirm that we can even load and access the website
    """
    def setUp(self):
        """ Setup the context """
        self.app = create_app('testing')
        self.client = self.app.test_client()

    def test_access(self):
        """ Check that we can even access the context """
        with self.app.app_context():
            self.assertTrue(g)
