"""
Tests for BlockPy endpoints.
"""
from tests.factory.factories import (
    UserFactory, CourseFactory, AssignmentFactory,
    SubmissionFactory, SampleDataGenerator
)
from models.enums.roles import UserRoles
import pytest
import os


@pytest.fixture
def sample_data(client):
    sample_data = SampleDataGenerator.create_sample_course_with_data()
    return sample_data

def test_load_public_assignment_endpoint_unauthorized(client, sample_data):
    """Test load assignment endpoint without authentication."""
    assignment = sample_data['assignments'][0]

    # Try to access without authentication
    response = client.get(f'/blockpy/load_assignment/?assignment_id={assignment.id}')

    # Should require authentication
    assert response.status_code == 200
    assert b'Hello World' in response.data
    assert b'Variables and Types' not in response.data

def test_load_default_course(client, test_data):
    response = client.get("/courses/1")
    assert response.status_code == 200
    assert b"Default Course" in response.data

def test_load_public_course(client, test_data):
    response = client.get("/courses/2")
    assert response.status_code == 200
    assert b"Introduction to CS1" in response.data

def test_load_private_course_unauthorized(client, test_data):
    response = client.get("/courses/8")
    assert response.status_code == 302  # Redirect to login or unauthorized

def test_load_public_course_users_not_in_course(client, test_data):
    my_identity = client.get('/whoami').get_json()
    response = client.get('/courses/users/', query_string={"user_ids": my_identity['id'], "course_id": 2})
    assert response.status_code == 200
    users = response.get_json()
    # Can only get ourselves
    assert len(users['users']) == 1
    assert users['users'][0]['id'] == my_identity['id']
    # And we are not in the course
    assert users['users'][0]['roles'] == []

def test_load_public_course_users_cannot_get_everyone(client, test_data):
    for course_id in [1, 2, 3, 4, 5, 6, 7, 8]:
        response = client.get('/courses/users/', query_string={"course_id": course_id})
        assert response.status_code == 403

def test_load_private_assignment_endpoint_unauthorized(client, test_data):
    pass