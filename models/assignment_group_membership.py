from typing import Optional
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import (event, Integer, Date, ForeignKey, Column, Table,
                        String, Boolean, DateTime, Text, ForeignKeyConstraint,
                        cast, func, and_, or_, Index, UniqueConstraint)

from common.maybe import maybe_int
from models.assignment import Assignment
from models.assignment_group import AssignmentGroup
from models.generics.models import db, ma
from models.generics.base import EnhancedBase
from common.dates import datetime_to_string, string_to_datetime
import models


class AssignmentGroupMembership(EnhancedBase):
    __tablename__ = 'assignment_group_membership'
    assignment_group_id: Mapped[int] = mapped_column(Integer(), ForeignKey('assignment_group.id'))
    assignment_id: Mapped[int] = mapped_column(Integer(), ForeignKey('assignment.id'))
    position: Mapped[Optional[int]] = mapped_column(Integer())

    #: Logic for grading and visibility
    policy: Mapped[Optional[str]] = mapped_column(String(255), default="{}")
    #: When None, this assignment is required for all students.
    #: When set to a positive integer, this assignment belongs to variation pool N
    #: and is only shown to students who have been assigned that variation.
    variation_group: Mapped[Optional[int]] = mapped_column(Integer(), nullable=True, default=None)

    assignment_group: Mapped[list["AssignmentGroup"]] = db.relationship(back_populates="memberships")
    assignment: Mapped[list["Assignment"]] = db.relationship(back_populates="memberships")

    __table_args__ = (Index("assignment_group_membership_lookup", "assignment_group_id", "assignment_id"),
                      Index('assignment_group_membership_assignment_id', "assignment_id"),
                      Index('assignment_group_membership_assignment_group_id', "assignment_group_id"),)

    SCHEMA_V1_IGNORE_COLUMNS = EnhancedBase.SCHEMA_V1_IGNORE_COLUMNS + ("assignment_group_url",
                                                                "assignment_url", "course_id")
    SCHEMA_V2_IGNORE_COLUMNS = EnhancedBase.SCHEMA_V2_IGNORE_COLUMNS + ("assignment_group_url",
                                                                "assignment_url", "course_id")

    @classmethod
    def get_existing(cls, data):
        return (AssignmentGroupMembership.query
                .filter_by(assignment_group_id=data['assignment_group_id'],
                           assignment_id=data['assignment_id'])
                .first())
        """group_url = data['assignment_group_url']
        assignment_url = data['assignment_url']
        assignment = Assignment.by_url(assignment_url)
        group = AssignmentGroup.by_url(group_url)
        if not assignment or not group:
            return None
        return (AssignmentGroupMembership.query
                .filter_by(assignment_group_id=group.id,
                           assignment_id=assignment.id)
                .first())"""

    def __str__(self):
        return "<Membership {} in {}>".format(self.assignment_id, self.assignment_group_id)

    def encode_json(self):
        group = AssignmentGroup.by_id(self.assignment_group_id)
        group_url = group.url if group else None
        assignment = Assignment.by_id(self.assignment_id)
        assignment_url = assignment.url if assignment else None
        return {'_schema_version': 1,
                'assignment_group_id': self.assignment_group_id,
                'assignment_group_url': group_url,
                'assignment_id': self.assignment_id,
                'assignment_url': assignment_url,
                'position': self.position,
                'id': self.id,
                'date_modified': datetime_to_string(self.date_modified),
                'date_created': datetime_to_string(self.date_created)}

    @staticmethod
    def by_course(course_id):
        groups = [g.id for g in models.AssignmentGroup.by_course(maybe_int(course_id))]
        return (AssignmentGroupMembership
                .query
                .filter(AssignmentGroupMembership.assignment_group_id.in_(groups))
                .order_by(AssignmentGroupMembership.assignment_group_id,
                          AssignmentGroupMembership.assignment_id)
                .all())

    @staticmethod
    def move_assignment(assignment_id, new_group_id, position=0):
        """ -1 for a new_group_id means delete """
        membership = (AssignmentGroupMembership.query
                      .filter_by(assignment_id=assignment_id)
                      .first())
        if membership is None and new_group_id != -1:
            # -1 means delete
            membership = AssignmentGroupMembership(assignment_group_id=new_group_id,
                                                   assignment_id=assignment_id,
                                                   position=position)
            db.session.add(membership)
        elif new_group_id == -1:
            db.session.delete(membership)
        else:
            membership.assignment_group_id = new_group_id
            membership.position = position
        db.session.commit()
        return membership

    def find_all_linked_resources(self) -> dict[str, list[EnhancedBase]]:
        resources = {}
        return resources
