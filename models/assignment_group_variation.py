import random
from typing import Optional, List, TYPE_CHECKING

from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import Integer, ForeignKey, Index, UniqueConstraint

from models.generics.models import db
from models.generics.base import EnhancedBase
import models

if TYPE_CHECKING:
    from models import *


class AssignmentGroupVariation(EnhancedBase):
    """
    Tracks which assignments from a variation pool have been assigned to a specific student
    within an assignment group.

    When an AssignmentGroup has variation_count > 0, some AssignmentGroupMemberships will
    have a non-null variation_group integer indicating they belong to a pool. This model
    records the exact (user, assignment) pairs that result from assigning a student their
    specific variation, so they only see the subset of assignments chosen for them.
    """
    __tablename__ = 'assignment_group_variation'

    user_id: Mapped[int] = mapped_column(Integer(), ForeignKey('user.id'))
    assignment_group_id: Mapped[int] = mapped_column(Integer(), ForeignKey('assignment_group.id'))
    assignment_id: Mapped[int] = mapped_column(Integer(), ForeignKey('assignment.id'))

    user: Mapped["User"] = db.relationship(back_populates="assignment_group_variations")
    assignment_group: Mapped["AssignmentGroup"] = db.relationship(back_populates="variations")
    assignment: Mapped["Assignment"] = db.relationship(back_populates="group_variations")

    __table_args__ = (
        UniqueConstraint('user_id', 'assignment_group_id', 'assignment_id',
                         name='uq_agv_user_group_assignment'),
        Index('agv_user_group_index', 'user_id', 'assignment_group_id'),
        Index('agv_group_index', 'assignment_group_id'),
    )

    def __str__(self):
        return '<AssignmentGroupVariation user={} group={} assignment={}>'.format(
            self.user_id, self.assignment_group_id, self.assignment_id)

    def encode_json(self):
        return {
            '_schema_version': 1,
            'user_id': self.user_id,
            'assignment_group_id': self.assignment_group_id,
            'assignment_id': self.assignment_id,
            'id': self.id,
        }

    @staticmethod
    def get_for_user(user_id: int, assignment_group_id: int) -> 'List[AssignmentGroupVariation]':
        """Get all variation assignments for a user in a specific group."""
        return (AssignmentGroupVariation.query
                .filter_by(user_id=user_id, assignment_group_id=assignment_group_id)
                .all())

    @staticmethod
    def get_assignment_ids_for_user(user_id: int, assignment_group_id: int) -> 'List[int]':
        """Get the assignment IDs that a user has been assigned in a group."""
        rows = (AssignmentGroupVariation.query
                .filter_by(user_id=user_id, assignment_group_id=assignment_group_id)
                .all())
        return [row.assignment_id for row in rows]

    @staticmethod
    def clear_for_user(user_id: int, assignment_group_id: int):
        """Remove all variation assignments for a user in a group."""
        (AssignmentGroupVariation.query
         .filter_by(user_id=user_id, assignment_group_id=assignment_group_id)
         .delete())
        db.session.commit()

    @staticmethod
    def assign_to_user(user_id: int, assignment_group_id: int,
                       assignment_ids: 'List[int]'):
        """
        Assign specific variation assignments to a user.
        Replaces any existing variation assignments for this user/group.
        """
        AssignmentGroupVariation.clear_for_user(user_id, assignment_group_id)
        for assignment_id in assignment_ids:
            variation = AssignmentGroupVariation(
                user_id=user_id,
                assignment_group_id=assignment_group_id,
                assignment_id=assignment_id,
            )
            db.session.add(variation)
        db.session.commit()

    def find_all_linked_resources(self) -> dict:
        return {}
