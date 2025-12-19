# Controller Tests

This directory contains tests for the BlockPy server controller endpoints.

## Test Files

### test_basic.py
Basic smoke tests for the main application routes.

### test_blockpy.py
Tests for BlockPy-specific endpoints, including assignment loading functionality.

### test_courses.py
Comprehensive tests for the courses controller endpoints. Includes 30 test cases covering:

- Course index and listing
- Course viewing (public and private)
- Course creation and editing
- User management (adding, viewing, managing users)
- Assignment viewing
- Submissions (grid view, user-specific, filtering)
- Course configuration and settings
- Access control and authentication requirements

## Running Tests

Run all controller tests:
```bash
python -m pytest tests/controllers/ -v
```

Run specific test file:
```bash
python -m pytest tests/controllers/test_courses.py -v
```

Run specific test:
```bash
python -m pytest tests/controllers/test_courses.py::TestCourseIndex::test_course_index_unauthenticated -v
```

## Test Patterns

All tests follow these patterns:
1. Use factories from `tests/factories.py` to create test data
2. Use the `client` fixture provided by pytest-flask
3. Use the `sample_data` fixture for pre-populated test data
4. Test both successful operations and error conditions
5. Verify authentication and authorization requirements

## Known Issues

Some tests may show database isolation issues when running the full suite due to shared database state across tests. Individual tests run successfully. This is a known limitation of the current test setup and can be improved by:
- Using database transactions that roll back after each test
- Implementing proper test database cleanup
- Using more isolated fixtures

## Adding New Tests

When adding new tests:
1. Follow the existing class-based organization
2. Use descriptive test names that explain what is being tested
3. Include both positive and negative test cases
4. Test authentication/authorization requirements
5. Use the factories to create test data rather than manual DB inserts
