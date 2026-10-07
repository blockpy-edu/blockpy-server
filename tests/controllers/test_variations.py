"""
Tests for question variations support in assignment groups.

Covers:
  - AssignmentGroupMembership.variation_group field
  - AssignmentGroup.variation_count field
  - AssignmentGroup.get_assignments(user_id) filtering
  - AssignmentGroup.assign_variation_to_user / assign_random_variation helpers
  - GET  /assignment_group/get_variations
  - POST /assignment_group/assign_variation
  - POST /assignment_group/assign_variations_random
  - GET  /assignment_group/edit_variation_settings
  - POST /assignment_group/edit_variation_settings
"""
import json
import pytest

from models import db
from models.assignment_group import AssignmentGroup
from models.assignment_group_membership import AssignmentGroupMembership
from models.assignment_group_variation import AssignmentGroupVariation
from tests.factory.factories import (
    AssignmentGroupFactory,
    AssignmentFactory,
    CourseFactory,
    UserFactory,
)
from models.role import Role
from models.enums.roles import UserRoles


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _add_membership(group, assignment, position=1, variation_group=None):
    membership = AssignmentGroupMembership(
        assignment_group_id=group.id,
        assignment_id=assignment.id,
        position=position,
        variation_group=variation_group,
    )
    db.session.add(membership)
    db.session.commit()
    return membership


# ---------------------------------------------------------------------------
# Model-level tests
# ---------------------------------------------------------------------------

class TestVariationGroupMembership:
    """AssignmentGroupMembership.variation_group field."""

    def test_default_variation_group_is_none(self, app):
        group = AssignmentGroupFactory.create_assignment_group()
        assignment = AssignmentFactory.create_assignment(course=group.course)
        membership = _add_membership(group, assignment)
        assert membership.variation_group is None

    def test_variation_group_can_be_set(self, app):
        group = AssignmentGroupFactory.create_assignment_group()
        assignment = AssignmentFactory.create_assignment(course=group.course)
        membership = _add_membership(group, assignment, variation_group=1)
        assert membership.variation_group == 1


class TestAssignmentGroupVariationCount:
    """AssignmentGroup.variation_count field."""

    def test_default_variation_count_is_zero(self, app):
        group = AssignmentGroupFactory.create_assignment_group()
        assert group.variation_count == 0

    def test_variation_count_can_be_set(self, app):
        group = AssignmentGroupFactory.create_assignment_group(variation_count=2)
        assert group.variation_count == 2


class TestGetAssignmentsVariations:
    """AssignmentGroup.get_assignments() with user_id filtering."""

    def _setup_group_with_variations(self):
        """Create a group with 1 required + 2 variation pools (each with 1 assignment)."""
        course = CourseFactory.create_course()
        group = AssignmentGroupFactory.create_assignment_group(course=course,
                                                               variation_count=1)
        required_a = AssignmentFactory.create_assignment(course=course, name="Required A")
        pool1_a = AssignmentFactory.create_assignment(course=course, name="Pool1 A")
        pool2_a = AssignmentFactory.create_assignment(course=course, name="Pool2 A")
        _add_membership(group, required_a, position=1, variation_group=None)
        _add_membership(group, pool1_a, position=2, variation_group=1)
        _add_membership(group, pool2_a, position=3, variation_group=2)
        return group, required_a, pool1_a, pool2_a

    def test_get_assignments_no_user_returns_all(self, app):
        group, required_a, pool1_a, pool2_a = self._setup_group_with_variations()
        all_assignments = group.get_assignments()
        ids = {a.id for a in all_assignments}
        assert {required_a.id, pool1_a.id, pool2_a.id} == ids

    def test_get_assignments_with_user_no_variation_assigned(self, app):
        """User with no variation assignment sees only required assignments."""
        group, required_a, pool1_a, pool2_a = self._setup_group_with_variations()
        user = UserFactory.create_student(course=group.course)
        assignments = group.get_assignments(user_id=user.id)
        ids = {a.id for a in assignments}
        assert ids == {required_a.id}

    def test_get_assignments_with_user_variation_assigned(self, app):
        """User with a variation assignment sees required + their variation."""
        group, required_a, pool1_a, pool2_a = self._setup_group_with_variations()
        user = UserFactory.create_student(course=group.course)
        group.assign_variation_to_user(user.id, [pool1_a.id])
        assignments = group.get_assignments(user_id=user.id)
        ids = {a.id for a in assignments}
        assert ids == {required_a.id, pool1_a.id}

    def test_get_assignments_variation_count_zero_ignores_user(self, app):
        """When variation_count == 0, user_id is ignored and all are returned."""
        course = CourseFactory.create_course()
        group = AssignmentGroupFactory.create_assignment_group(course=course,
                                                               variation_count=0)
        a1 = AssignmentFactory.create_assignment(course=course)
        a2 = AssignmentFactory.create_assignment(course=course)
        _add_membership(group, a1, variation_group=1)
        _add_membership(group, a2, variation_group=2)
        user = UserFactory.create_student(course=course)
        assignments = group.get_assignments(user_id=user.id)
        ids = {a.id for a in assignments}
        assert ids == {a1.id, a2.id}

    def test_two_users_get_different_variations(self, app):
        """Two users assigned to different variation groups see different assignments."""
        course = CourseFactory.create_course()
        group = AssignmentGroupFactory.create_assignment_group(course=course,
                                                               variation_count=1)
        required = AssignmentFactory.create_assignment(course=course, name="Required")
        pool1 = AssignmentFactory.create_assignment(course=course, name="Pool1")
        pool2 = AssignmentFactory.create_assignment(course=course, name="Pool2")
        _add_membership(group, required, position=1, variation_group=None)
        _add_membership(group, pool1, position=2, variation_group=1)
        _add_membership(group, pool2, position=3, variation_group=2)

        user1 = UserFactory.create_student(course=course)
        user2 = UserFactory.create_student(course=course)
        group.assign_variation_to_user(user1.id, [pool1.id])
        group.assign_variation_to_user(user2.id, [pool2.id])

        ids1 = {a.id for a in group.get_assignments(user_id=user1.id)}
        ids2 = {a.id for a in group.get_assignments(user_id=user2.id)}
        assert ids1 == {required.id, pool1.id}
        assert ids2 == {required.id, pool2.id}


class TestAssignRandomVariation:
    """AssignmentGroup.assign_random_variation()"""

    def test_assigns_correct_number_of_groups(self, app):
        course = CourseFactory.create_course()
        group = AssignmentGroupFactory.create_assignment_group(course=course,
                                                               variation_count=1)
        a1 = AssignmentFactory.create_assignment(course=course)
        a2 = AssignmentFactory.create_assignment(course=course)
        _add_membership(group, a1, variation_group=1)
        _add_membership(group, a2, variation_group=2)
        user = UserFactory.create_student(course=course)
        assigned_ids = group.assign_random_variation(user.id)
        # variation_count=1 means 1 variation group selected → 1 assignment from pool
        assert len(assigned_ids) == 1
        assert assigned_ids[0] in {a1.id, a2.id}

    def test_get_variation_groups_returns_distinct_values(self, app):
        course = CourseFactory.create_course()
        group = AssignmentGroupFactory.create_assignment_group(course=course)
        a1 = AssignmentFactory.create_assignment(course=course)
        a2 = AssignmentFactory.create_assignment(course=course)
        a3 = AssignmentFactory.create_assignment(course=course)
        _add_membership(group, a1, variation_group=None)
        _add_membership(group, a2, variation_group=1)
        _add_membership(group, a3, variation_group=2)
        assert group.get_variation_groups() == [1, 2]

    def test_clear_and_reassign(self, app):
        course = CourseFactory.create_course()
        group = AssignmentGroupFactory.create_assignment_group(course=course,
                                                               variation_count=1)
        a1 = AssignmentFactory.create_assignment(course=course)
        a2 = AssignmentFactory.create_assignment(course=course)
        _add_membership(group, a1, variation_group=1)
        _add_membership(group, a2, variation_group=2)
        user = UserFactory.create_student(course=course)
        group.assign_variation_to_user(user.id, [a1.id])
        assert AssignmentGroupVariation.get_assignment_ids_for_user(user.id, group.id) == [a1.id]
        # Reassign to different set
        group.assign_variation_to_user(user.id, [a2.id])
        assert AssignmentGroupVariation.get_assignment_ids_for_user(user.id, group.id) == [a2.id]


# ---------------------------------------------------------------------------
# Endpoint tests
# ---------------------------------------------------------------------------

class TestGetVariationsEndpoint:
    """GET /assignment_group/get_variations"""

    def test_get_variations_anonymous_blocked(self, client, test_data):
        response = client.get('/assignment_group/get_variations',
                               query_string={'assignment_group_id': 1})
        assert response.json['success'] is False

    def test_get_variations_student_own_view(self, client, test_data, act_as):
        """Students can view their own variation assignments."""
        act_as(test_data.user("lulu@blockpy.com"))
        response = client.get('/assignment_group/get_variations',
                               query_string={'assignment_group_id': 1})
        assert response.status_code == 200
        data = response.get_json()
        assert data['success'] is True
        assert 'variation_count' in data
        assert 'assigned_assignment_ids' in data

    def test_get_variations_student_blocked_other_user(self, client, test_data, act_as):
        """Students cannot view another student's variation assignments."""
        act_as(test_data.user("lulu@blockpy.com"))
        # user_id 10 is Ada – requesting another user's data as a student should be blocked
        response = client.get('/assignment_group/get_variations',
                               query_string={'assignment_group_id': 1, 'user_id': 10})
        assert response.json['success'] is False

    def test_get_variations_instructor_can_view_student(self, client, test_data, act_as):
        """Instructors can view any student's variation assignments."""
        act_as(test_data.user("ada@blockpy.com"))
        response = client.get('/assignment_group/get_variations',
                               query_string={'assignment_group_id': 1, 'user_id': 100})
        assert response.status_code == 200
        data = response.get_json()
        assert data['success'] is True

    def test_get_variations_includes_variation_groups(self, client, test_data, act_as):
        act_as(test_data.user("ada@blockpy.com"))
        response = client.get('/assignment_group/get_variations',
                               query_string={'assignment_group_id': 1})
        data = response.get_json()
        assert 'variation_groups' in data
        assert isinstance(data['variation_groups'], list)


class TestAssignVariationEndpoint:
    """POST /assignment_group/assign_variation"""

    def test_assign_variation_anonymous_blocked(self, client, test_data):
        response = client.post('/assignment_group/assign_variation', data={
            'assignment_group_id': 1,
            'user_id': 100,
            'assignment_ids': json.dumps([100]),
        })
        assert response.json['success'] is False

    def test_assign_variation_student_blocked(self, client, test_data, act_as):
        act_as(test_data.user("lulu@blockpy.com"))
        response = client.post('/assignment_group/assign_variation', data={
            'assignment_group_id': 1,
            'user_id': 100,
            'assignment_ids': json.dumps([100]),
        })
        assert response.json['success'] is False

    def test_assign_variation_instructor_success(self, client, test_data, act_as):
        act_as(test_data.user("ada@blockpy.com"))
        response = client.post('/assignment_group/assign_variation', data={
            'assignment_group_id': 1,
            'user_id': 100,
            'assignment_ids': json.dumps([100, 101]),
        })
        assert response.status_code == 200
        data = response.get_json()
        assert data['success'] is True
        assert sorted(data['assigned_assignment_ids']) == [100, 101]

    def test_assign_variation_invalid_ids(self, client, test_data, act_as):
        """Assignment IDs that don't belong to this group should be rejected."""
        act_as(test_data.user("ada@blockpy.com"))
        response = client.post('/assignment_group/assign_variation', data={
            'assignment_group_id': 1,
            'user_id': 100,
            'assignment_ids': json.dumps([9999]),  # Not in group 1
        })
        assert response.json['success'] is False

    def test_assign_variation_invalid_json(self, client, test_data, act_as):
        act_as(test_data.user("ada@blockpy.com"))
        response = client.post('/assignment_group/assign_variation', data={
            'assignment_group_id': 1,
            'user_id': 100,
            'assignment_ids': 'not-valid-json',
        })
        assert response.json['success'] is False


class TestAssignVariationsRandomEndpoint:
    """POST /assignment_group/assign_variations_random"""

    def test_anonymous_blocked(self, client, test_data):
        response = client.post('/assignment_group/assign_variations_random',
                                data={'assignment_group_id': 1})
        assert response.json['success'] is False

    def test_student_blocked(self, client, test_data, act_as):
        act_as(test_data.user("lulu@blockpy.com"))
        response = client.post('/assignment_group/assign_variations_random',
                                data={'assignment_group_id': 1})
        assert response.json['success'] is False

    def test_variation_count_zero_fails(self, client, test_data, act_as):
        """Groups with variation_count=0 cannot use random assignment."""
        act_as(test_data.user("ada@blockpy.com"))
        # Group 1 has variation_count=0 by default
        response = client.post('/assignment_group/assign_variations_random',
                                data={'assignment_group_id': 1})
        data = response.get_json()
        assert data['success'] is False
        assert 'variation_count' in data['message']

    def test_instructor_can_assign_random(self, client, test_data, act_as):
        """When variation groups are set up, instructor can randomly assign."""
        act_as(test_data.user("ada@blockpy.com"))
        # First configure group 1 to have variation_count=1 and add variation groups
        response = client.post('/assignment_group/edit_variation_settings', data={
            'assignment_group_id': 1,
            'variation_count': 1,
            # membership IDs 1-3 belong to group 1 (assignments 100, 101, 102)
            'variation_group[1]': '1',
            'variation_group[2]': '2',
            'variation_group[3]': '',
        })
        assert response.get_json()['success'] is True

        # Now assign randomly; should work since variation groups exist
        response = client.post('/assignment_group/assign_variations_random', data={
            'assignment_group_id': 1,
            'course_id': 6,
        })
        data = response.get_json()
        assert data['success'] is True
        assert 'assigned_count' in data


class TestEditVariationSettingsEndpoint:
    """GET/POST /assignment_group/edit_variation_settings"""

    def test_get_variation_settings_anonymous_blocked(self, client, test_data):
        response = client.get('/assignment_group/edit_variation_settings',
                               query_string={'assignment_group_id': 1})
        assert response.json['success'] is False

    def test_get_variation_settings_instructor(self, client, test_data, act_as):
        act_as(test_data.user("ada@blockpy.com"))
        response = client.get('/assignment_group/edit_variation_settings',
                               query_string={'assignment_group_id': 1})
        assert response.status_code == 200
        data = response.get_json()
        assert data['success'] is True
        assert 'variation_count' in data
        assert 'memberships' in data

    def test_post_variation_settings_updates_count(self, client, test_data, act_as):
        act_as(test_data.user("ada@blockpy.com"))
        response = client.post('/assignment_group/edit_variation_settings', data={
            'assignment_group_id': 2,
            'variation_count': 2,
        })
        assert response.status_code == 200
        data = response.get_json()
        assert data['success'] is True
        assert data['variation_count'] == 2

    def test_post_variation_settings_invalid_count(self, client, test_data, act_as):
        act_as(test_data.user("ada@blockpy.com"))
        response = client.post('/assignment_group/edit_variation_settings', data={
            'assignment_group_id': 1,
            'variation_count': -1,
        })
        assert response.json['success'] is False

    def test_post_variation_settings_student_blocked(self, client, test_data, act_as):
        act_as(test_data.user("lulu@blockpy.com"))
        response = client.post('/assignment_group/edit_variation_settings', data={
            'assignment_group_id': 1,
            'variation_count': 1,
        })
        assert response.json['success'] is False

    def test_post_updates_membership_variation_group(self, client, test_data, act_as):
        act_as(test_data.user("ada@blockpy.com"))
        # group 1 memberships: 1 (assignment 100), 2 (assignment 101), 3 (assignment 102)
        response = client.post('/assignment_group/edit_variation_settings', data={
            'assignment_group_id': 1,
            'variation_count': 1,
            'variation_group[1]': '1',
            'variation_group[2]': '2',
            'variation_group[3]': '',   # empty → NULL
        })
        data = response.get_json()
        assert data['success'] is True
        # Re-GET to verify persistence
        response2 = client.get('/assignment_group/edit_variation_settings',
                                query_string={'assignment_group_id': 1})
        data2 = response2.get_json()
        assert data2['variation_count'] == 1
        mem_map = {m['id']: m['variation_group'] for m in data2['memberships']}
        assert mem_map[1] == 1
        assert mem_map[2] == 2
        assert mem_map[3] is None
