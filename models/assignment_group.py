from typing import List, Optional, TYPE_CHECKING

from quart import url_for
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import Column, String, Integer, ForeignKey, func, Enum, UniqueConstraint, Index
from natsort import natsorted
from werkzeug.utils import secure_filename

import models
from common.maybe import maybe_int
from common.text import make_flavored_uuid_generator
from models.enums import AssignmentGroupCategory
from models.generics.models import db, ma
from models.generics.base import EnhancedBase, Base
from common.dates import datetime_to_string
from common.databases import make_copy, get_enum_values

if TYPE_CHECKING:
    from models import *


class AssignmentGroup(EnhancedBase):
    __tablename__ = 'assignment_group'
    name: Mapped[str] = mapped_column(String(255), default="Untitled")
    url: Mapped[Optional[str]] = mapped_column(String(255), default=make_flavored_uuid_generator("group"),
                                               nullable=True)
    forked_id: Mapped[Optional[int]] = mapped_column(Integer(), ForeignKey('assignment_group.id'),
                                                     nullable=True)
    category: Mapped[AssignmentGroupCategory] = mapped_column(Enum(AssignmentGroupCategory, values_callable=get_enum_values), default=AssignmentGroupCategory.NONE)
    forked_version: Mapped[Optional[int]] = mapped_column(Integer(), nullable=True)
    owner_id: Mapped[int] = mapped_column(Integer(), ForeignKey('user.id'))
    course_id: Mapped[int] = mapped_column(Integer(), ForeignKey('course.id'))
    position: Mapped[int] = mapped_column(Integer(), default=0)
    version: Mapped[int] = mapped_column(Integer(), default=0)

    forked: Mapped["AssignmentGroup"] = db.relationship("AssignmentGroup", remote_side="AssignmentGroup.id")
    owner: Mapped["User"] = db.relationship(back_populates="assignment_groups")
    course: Mapped["Course"] = db.relationship(back_populates="assignment_groups")
    memberships: Mapped[list["AssignmentGroupMembership"]] = db.relationship(back_populates="assignment_group")
    submissions: Mapped[list["Submission"]] = db.relationship(back_populates="assignment_group")

    __table_args__ = (Index("assignment_group_url_index", "url"),
                      Index('assignment_group_course_index', "course_id"))

    def __str__(self):
        return '<Group {} in {} ({})>'.format(self.name, self.course_id, self.url)

    def encode_json(self):
        user = models.User.query.get(self.owner_id)
        return {'_schema_version': 2,
                'name': self.name,
                'url': self.url,
                'version': self.version,
                'forked_id': self.forked_id,
                'forked_version': self.forked_version,
                'owner_id': self.owner_id,
                'owner_id__email': user.email if user else '',
                'course_id': self.course_id,
                'position': self.position,
                'id': self.id,
                'date_modified': datetime_to_string(self.date_modified),
                'date_created': datetime_to_string(self.date_created)}

    SCHEMA_V1_IGNORE_COLUMNS = EnhancedBase.SCHEMA_V1_IGNORE_COLUMNS + ('owner_id__email',)
    SCHEMA_V2_IGNORE_COLUMNS = EnhancedBase.SCHEMA_V2_IGNORE_COLUMNS + ('owner_id__email',)

    @staticmethod
    def new(owner_id, course_id, name="Untitled Group", url=None):
        last = (db.session.query(func.max(AssignmentGroup.position).label("last_position"))
                .filter_by(course_id=maybe_int(course_id)).one()).last_position
        assignment_group = AssignmentGroup(owner_id=owner_id, course_id=maybe_int(course_id),
                                           name=name, url=url,
                                           position=last + 1 if last else 1)
        db.session.add(assignment_group)
        db.session.commit()
        return assignment_group

    @staticmethod
    def remove(assignment_group_id):
        # Reorder existing
        group = AssignmentGroup.query.filter_by(id=assignment_group_id).one()
        position = group.position
        all_groups = (AssignmentGroup.query
                      .filter(AssignmentGroup.course_id == group.course_id,
                              AssignmentGroup.position > position)
                      .update({"position": (AssignmentGroup.position - 1)}))
        # Delete target
        AssignmentGroup.query.filter_by(id=assignment_group_id).delete()
        models.AssignmentGroupMembership.query.filter_by(assignment_group_id=assignment_group_id).delete()
        db.session.commit()

    def fork(self, new_owner_id: int, new_course_id: int, with_assignments: bool=True,
             new_url = None, new_name= None):
        group = AssignmentGroup(name=new_name if new_name is not None else self.name,
                                url=new_url if new_url is not None else make_copy(self.url),
                                forked_id=self.id,
                                forked_version=self.version,
                                owner_id=new_owner_id,
                                course_id=maybe_int(new_course_id),
                                position=self.position,
                                version=0)
        # TODO: Copy tags, sample_submissions, submissions
        db.session.add(group)
        db.session.commit()
        assignments = []
        if with_assignments:
            for assignment in self.get_assignments():
                new_assignment = assignment.fork(new_owner_id, maybe_int(new_course_id))
                models.AssignmentGroupMembership.move_assignment(new_assignment.id, group.id)
                assignments.append(new_assignment)
        return group, assignments

    @staticmethod
    def is_in_course(assignment_group_id, course_id):
        return AssignmentGroup.query.get(assignment_group_id).course_id == maybe_int(course_id)

    @staticmethod
    def id_by_url(assignment_group_url):
        if assignment_group_url is None:
            return None
        possible = AssignmentGroup.query.filter_by(url=assignment_group_url).first()
        if possible:
            return possible.id
        return None

    @staticmethod
    def by_url(assignment_group_url):
        if assignment_group_url is None:
            return None
        possible = AssignmentGroup.query.filter_by(url=assignment_group_url).first()
        return possible

    @staticmethod
    def by_course(course_id):
        return (AssignmentGroup.query.filter_by(course_id=maybe_int(course_id))
                .order_by(AssignmentGroup.name)
                .all())

    @staticmethod
    def check_if_url_exists(url: str) -> bool:
        return AssignmentGroup.query.filter_by(url=url).first() is not None

    @staticmethod
    def by_assignment(assignment_id):
        return (AssignmentGroup.query
                .filter(AssignmentGroup.id == models.AssignmentGroupMembership.assignment_group_id,
                        models.AssignmentGroupMembership.assignment_id == assignment_id,
                        models.Assignment.id == assignment_id)
                .order_by(AssignmentGroup.course_id == models.Assignment.course_id)
                .all())

    @staticmethod
    def get_ungrouped_assignments(course_id):
        return (models.Assignment.query
                .filter_by(course_id=maybe_int(course_id))
                .outerjoin(models.AssignmentGroupMembership)
                .filter(models.AssignmentGroupMembership.assignment_id == None)
                .all())

    # TODO
    # SELECT assignment, grp  FROM assignment JOIN assignment_group_membership as members ON members.assignment_id = assignment.id JOIN assignment_group as grp ON grp.id = members.assignment_group_id WHERE assignment.id IN (SELECT DISTINCT submission.assignment_id FROM submission WHERE submission.course_id=11) AND (grp.course_id=11 OR assignment.course_id = grp.course_id)

    def get_assignments(self) -> 'List[models.Assignment]':
        assignments = (models.Assignment.query
                .join(models.AssignmentGroupMembership,
                      models.AssignmentGroupMembership.assignment_id == models.Assignment.id)
                .filter(models.AssignmentGroupMembership.assignment_group_id == self.id)
                .order_by(models.Assignment.name, models.AssignmentGroupMembership.position)
                .all())
        return natsorted(assignments, key=lambda a: a.title())

    def get_memberships(self):
        return (models.AssignmentGroupMembership.query
                       .filter(models.AssignmentGroupMembership.assignment_group_id == self.id)
                       .order_by(models.AssignmentGroupMembership.position,
                                 models.AssignmentGroupMembership.id)
                       .all())

    def get_select_url(self, menu = 'embed'):
        # TODO: Refactor web logic outside of model?
        if self.url:
            return url_for('assignments.load', assignment_group_url=self.url, _external=True, _scheme="https",embed=menu == 'embed')
        return url_for('assignments.load', assignment_group_id=self.id, _external=True, _scheme="https",embed=menu == 'embed')

    def get_filename(self, extension=".json"):
        if self.url:
            return secure_filename(self.url) + extension
        else:
            return secure_filename(self.name) + extension

    def find_all_linked_resources(self) -> dict[str, list[Base]]:
        # Get any assignments that are forked from this one
        forked = AssignmentGroup.query.filter_by(forked_id=self.id).all()
        resources = {
            "AssignmentGroup": forked,
            "Submission": self.submissions,
            "Memberships": self.memberships
        }
        return resources

    def get_existing_forks(self):
        return AssignmentGroup.query.filter_by(forked_id=self.id).all()
