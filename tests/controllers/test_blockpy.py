"""
Tests for BlockPy endpoints.
"""
from tests.factories import (
    UserFactory, CourseFactory, AssignmentFactory,
    SubmissionFactory, SampleDataGenerator
)
from models.enums.roles import UserRoles
import pytest


@pytest.fixture
def sample_data(client):
    sample_data = SampleDataGenerator.create_sample_course_with_data()
    return sample_data

def test_load_assignment_endpoint_unauthorized(client, sample_data):
    """Test load assignment endpoint without authentication."""
    assignment = sample_data['assignments'][0]

    # Try to access without authentication
    response = client.get(f'/blockpy/load_assignment/?assignment_id={assignment.id}')

    # Should require authentication
    assert response.status_code == 200
    assert b'Hello World' in response.data
    assert b'Variables and Types' not in response.data
