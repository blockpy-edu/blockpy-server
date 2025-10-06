"""
Test runner for all BlockPy tests.

This module provides a comprehensive test runner that executes all test suites
in the BlockPy testing infrastructure.
"""
import unittest
import sys
import os

# Add the project root to the path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

def run_all_tests():
    """Run all test suites."""
    # Discover and run all tests
    loader = unittest.TestLoader()
    start_dir = 'tests'
    suite = loader.discover(start_dir, pattern='test_*.py')
    
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    
    return result.wasSuccessful()

def run_model_tests():
    """Run only model tests."""
    loader = unittest.TestLoader()
    suite = loader.discover('tests/models', pattern='test_*.py')
    
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    
    return result.wasSuccessful()

def run_controller_tests():
    """Run only controller tests."""
    loader = unittest.TestLoader()
    suite = loader.discover('tests/controllers', pattern='test_*.py')
    
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    
    return result.wasSuccessful()

def run_workflow_tests():
    """Run only workflow tests."""
    loader = unittest.TestLoader()
    suite = loader.discover('tests/workflows', pattern='test_*.py')
    
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    
    return result.wasSuccessful()

if __name__ == '__main__':
    import argparse
    
    parser = argparse.ArgumentParser(description='BlockPy Test Runner')
    parser.add_argument('--models', action='store_true', 
                       help='Run only model tests')
    parser.add_argument('--controllers', action='store_true',
                       help='Run only controller tests') 
    parser.add_argument('--workflows', action='store_true',
                       help='Run only workflow tests')
    parser.add_argument('--all', action='store_true',
                       help='Run all tests (default)')
    
    args = parser.parse_args()
    
    success = True
    
    if args.models:
        print("=== Running Model Tests ===")
        success = run_model_tests()
    elif args.controllers:
        print("=== Running Controller Tests ===")
        success = run_controller_tests()
    elif args.workflows:
        print("=== Running Workflow Tests ===")
        success = run_workflow_tests()
    else:
        print("=== Running All Tests ===")
        success = run_all_tests()
    
    if success:
        print("\n✅ All tests passed!")
        sys.exit(0)
    else:
        print("\n❌ Some tests failed!")
        sys.exit(1)