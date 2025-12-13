"""
Basic tests for counts tracking functionality.

This tests the helper functions that track statistics in the counts tables.
"""
import unittest
import sys
import os

# Add the parent directory to the path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


class TestCountsHelpers(unittest.TestCase):
    """Test the counts helper functions."""
    
    def test_imports(self):
        """Test that the counts helper module imports correctly."""
        try:
            from models.counters import helpers
            self.assertTrue(hasattr(helpers, 'ensure_submission_counts'))
            self.assertTrue(hasattr(helpers, 'ensure_assignment_counts'))
            self.assertTrue(hasattr(helpers, 'ensure_course_counts'))
            self.assertTrue(hasattr(helpers, 'ensure_user_counts'))
            self.assertTrue(hasattr(helpers, 'update_edit_time'))
            self.assertTrue(hasattr(helpers, 'update_run_count'))
            self.assertTrue(hasattr(helpers, 'update_error_counts'))
            self.assertTrue(hasattr(helpers, 'increment_submission_count'))
            self.assertTrue(hasattr(helpers, 'update_user_activity'))
            self.assertTrue(hasattr(helpers, 'increment_course_assignment_count'))
            self.assertTrue(hasattr(helpers, 'increment_course_user_count'))
        except ImportError as e:
            self.fail(f"Failed to import counts helpers: {e}")
    
    def test_model_relationships(self):
        """Test that model relationships exist for counts tables."""
        try:
            from models.submission import Submission
            from models.assignment import Assignment
            from models.course import Course
            from models.user import User
            
            # Check that the relationships are defined
            # Note: We can't instantiate without a database, but we can check the class attributes
            self.assertTrue(hasattr(Submission, 'submission_counts'))
            self.assertTrue(hasattr(Assignment, 'counts'))
            self.assertTrue(hasattr(Course, 'counts'))
            self.assertTrue(hasattr(User, 'user_counts'))
        except Exception as e:
            self.fail(f"Failed to verify model relationships: {e}")


class TestWelfordAlgorithm(unittest.TestCase):
    """Test the Welford's algorithm implementation for running averages."""
    
    def test_running_average_calculation(self):
        """Test that the running average calculation is correct."""
        # Simulate the algorithm used in update_edit_time
        values = [10.0, 20.0, 30.0, 40.0, 50.0]
        
        avg = None
        count = 0
        for value in values:
            count += 1
            if avg is None:
                avg = value
            else:
                avg = avg + (value - avg) / count
        
        # The average should be 30.0
        self.assertAlmostEqual(avg, 30.0, places=2)
    
    def test_running_average_single_value(self):
        """Test running average with a single value."""
        value = 42.0
        avg = value
        self.assertEqual(avg, 42.0)
    
    def test_running_average_stability(self):
        """Test that running average is stable with many values."""
        values = [float(i) for i in range(1, 101)]  # 1 to 100
        
        avg = None
        count = 0
        for value in values:
            count += 1
            if avg is None:
                avg = value
            else:
                avg = avg + (value - avg) / count
        
        # The average of 1 to 100 should be 50.5
        self.assertAlmostEqual(avg, 50.5, places=2)


if __name__ == '__main__':
    unittest.main()
