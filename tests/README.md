# BlockPy Test Suite

This directory contains comprehensive unit tests for the BlockPy education platform backend.

## Test Organization

```
tests/
├── __init__.py              # Test package initialization
├── conftest.py              # Pytest configuration and fixtures  
├── base.py                  # Base test classes and utilities
├── factories.py             # Test data factories for all models
├── models/                  # Model unit tests
│   ├── test_user.py         # User model tests
│   ├── test_course.py       # Course model tests
│   ├── test_assignment.py   # Assignment model tests
│   ├── test_assignment_group.py  # AssignmentGroup model tests
│   └── test_submission.py   # Submission model tests
├── controllers/             # Controller/API endpoint tests
│   ├── test_basic.py        # Basic endpoint tests
│   └── test_blockpy.py      # BlockPy endpoint tests
└── workflows/               # Integration workflow tests
    └── test_user_workflows.py  # End-to-end user scenarios
```

## Running Tests

### All Tests
```bash
python run_tests.py
# or
python run_tests.py --all
```

### Specific Test Categories
```bash
python run_tests.py --models        # Model tests only
python run_tests.py --controllers   # Controller tests only  
python run_tests.py --workflows     # Workflow tests only
```

### Individual Test Files
```bash
python -m unittest tests.models.test_user -v
python -m unittest tests.controllers.test_basic -v
python -m unittest tests.workflows.test_user_workflows -v
```

### Individual Test Cases
```bash
python -m unittest tests.models.test_user.TestUserModel.test_create_user -v
```

## Test Infrastructure

### Base Test Classes

- **`DatabaseTestCase`**: Base class for tests requiring database access
- **`APITestCase`**: Base class for testing API endpoints
- **`BaseTestCase`**: Flask-Testing base class (alternative approach)

### Test Factories

The factories create realistic test data for all models:

```python
from tests.factories import UserFactory, CourseFactory, AssignmentFactory

# Create test users
instructor = UserFactory.create_instructor()
student = UserFactory.create_student()

# Create test course
course = CourseFactory.create_course(owner=instructor)

# Create test assignment  
assignment = AssignmentFactory.create_assignment(course=course)
```

### Sample Data Generator

For complex testing scenarios:

```python
from tests.factories import SampleDataGenerator

# Creates complete course with instructor, students, assignments, submissions
sample_data = SampleDataGenerator.create_sample_course_with_data()
course = sample_data['course']
students = sample_data['students']
assignments = sample_data['assignments']
```

## Test Coverage

### Model Tests (64+ tests)
- **User Model** (9 tests): Creation, authentication, roles, relationships
- **Course Model** (12 tests): Creation, settings, relationships, permissions  
- **Assignment Model** (12 tests): Types, status workflow, relationships
- **AssignmentGroup Model** (13 tests): Categories, positioning, forking
- **Submission Model** (18 tests): Status workflow, grading, relationships

### Controller Tests (20 tests)
- **Basic Endpoints** (5 tests): Root, static files, health checks
- **BlockPy Endpoints** (15 tests): Assignment loading, submission handling, parameter validation

### Workflow Tests (6 tests)
- Instructor course creation and management
- Student enrollment and assignment submission
- Assignment grading workflow
- Multiple students on same assignment
- Assignment status transitions
- Complete course management scenarios

## Configuration

Test configuration is in `instance/configuration.py`:

```python
SECRET_KEY = 'test-secret-key'
SQLALCHEMY_DATABASE_URI = 'sqlite:///:memory:'
WTF_CSRF_ENABLED = False
MAIL_SUPPRESS_SEND = True
```

## Database Isolation

Each test runs with:
- Fresh in-memory SQLite database
- Automatic setup and teardown
- Complete data isolation between tests

## Key Features

- **Comprehensive Model Coverage**: Tests all core models and relationships
- **API Endpoint Validation**: Tests parameter validation and error handling
- **End-to-End Workflows**: Tests complete user journeys from registration to grading
- **Realistic Test Data**: Factory pattern creates realistic, varied test data
- **Proper Isolation**: Each test runs independently with clean database state
- **Multiple Test Runners**: Support for pytest and unittest frameworks
- **Selective Execution**: Run specific test categories or individual tests

## Adding New Tests

### Adding Model Tests

1. Create test file in `tests/models/test_modelname.py`
2. Import required factories and base classes
3. Create test class inheriting from `DatabaseTestCase`
4. Add test methods following naming convention `test_description`

### Adding Controller Tests

1. Create test file in `tests/controllers/test_controller.py` 
2. Import required factories and `APITestCase`
3. Use `self.client` for making HTTP requests
4. Test both success and error cases

### Adding Workflow Tests

1. Create test methods in `tests/workflows/test_user_workflows.py`
2. Use multiple factories to create complex scenarios
3. Test complete user journeys end-to-end
4. Verify state at each step of the workflow

## Dependencies

Test-specific dependencies:
- `flask-testing`: Flask testing utilities
- Built-in `unittest`: Python standard testing framework
- In-memory SQLite: Fast database for testing
- Factory pattern: Consistent test data creation