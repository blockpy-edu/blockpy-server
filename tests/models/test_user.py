"""
Tests for the User model.
"""
from flask_security.utils import verify_password

from tests.factory.factories import UserFactory
from models.user import User
from models.role import Role
from models.enums.roles import UserRoles


def test_create_user(client):
    user = UserFactory().create_user(
        email="test@example.com",
        first_name="John",
        last_name="Doe"
    )

    assert isinstance(user.id, int)
    assert user.email == "test@example.com"
    assert user.first_name == "John"
    assert user.last_name == "Doe"
    assert user.active is True
    assert user.banned is False
    assert user.anonymous is False


def test_user_password_hashing(client):
    password = "testpassword123"
    user = UserFactory().create_user(password=password)

    assert user.password != password  # Password should be hashed
    assert verify_password(password, user.password)  # Verify hashed password
    assert not verify_password("wrongpassword", user.password)