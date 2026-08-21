from typing import Optional
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import Column, String, Integer, ForeignKey, func, Text, Table

import models
from common.maybe import maybe_int
from models.assignment_tag_membership import assignment_tag_membership
from models.generics.models import db, ma
from models.generics.base import Base
from common.dates import datetime_to_string, string_to_datetime
from common.databases import optional_encoded_field


class AssignmentTag(Base):
    __tablename__ = 'assignment_tag'
    name: Mapped[str] = mapped_column(String(255), default="Blank Tag")
    owner_id: Mapped[int] = mapped_column(Integer(), ForeignKey('user.id'))
    course_id: Mapped[int] = mapped_column(Integer(), ForeignKey('course.id'))
    KINDS = ['objective', 'topic', 'mistake', 'misconception', 'compliment']
    kind: Mapped[str] = mapped_column(String(255), default="objective")
    description: Mapped[str] = mapped_column(Text(), default="")
    LEVELS = ['familiar', 'exposed', 'mastered', 'learning']
    level: Mapped[str] = mapped_column(String(255), default="familiar")
    version: Mapped[str] = mapped_column(String(255), default='0.0.1')

    assignments: Mapped[list["Assignment"]] = db.relationship(secondary=assignment_tag_membership,
                                                              back_populates='tags')
    owner: Mapped["User"] = db.relationship(back_populates="tags")
    course: Mapped["Course"] = db.relationship(back_populates="tags")
    reviews: Mapped[list["Review"]] = db.relationship(back_populates="tag")

    def __str__(self):
        return '{} Tag {}'.format(self.kind.title(), self.name)

    def encode_json(self, use_owner=True):
        return {
            '_schema_version': 2,
            'name': self.name,
            'owner_id': self.owner_id,
            'owner_id__email': optional_encoded_field(self.owner_id, use_owner, models.User.query.get, 'email'),
            'course_id': self.course_id,
            'kind': self.kind,
            'description': self.description,
            'level': self.level,
            'version': self.version,
            'id': self.id,
            'date_modified': datetime_to_string(self.date_modified),
            'date_created': datetime_to_string(self.date_created)
        }

    @staticmethod
    def decode_json(data, **kwargs):
        if data['_schema_version'] == 1:
            data = dict(data)  # shallow copy
            del data['_schema_version']
            del data['owner_id__email']
            del data['id']
            del data['date_modified']
            data['date_created'] = string_to_datetime(data['date_created'])
            for key, value in kwargs.items():
                data[key] = value
            return AssignmentTag(**data)
        raise Exception("Unknown schema version: {}".format(data.get('_schema_version', "Unknown")))

    @staticmethod
    def new(owner_id, course_id, name, kind, description, level):
        assignment_tag = AssignmentTag(owner_id=owner_id, course_id=maybe_int(course_id),
                                       name=name, kind=kind, description=description,
                                       level=level)
        db.session.add(assignment_tag)
        db.session.commit()
        return assignment_tag

    @staticmethod
    def remove(assignment_tag_id):
        AssignmentTag.query.filter_by(id=assignment_tag_id).delete()
        db.session.commit()

    @staticmethod
    def by_course(course_id):
        return (AssignmentTag.query.filter_by(course_id=course_id)
                .order_by(AssignmentTag.name)
                .all())

    @staticmethod
    def get_all():
        return (AssignmentTag.query
                .order_by(AssignmentTag.course_id,
                          AssignmentTag.kind,
                          AssignmentTag.level,
                          AssignmentTag.name)
                .all())


    def find_all_linked_resources(self) -> dict[str, list[Base]]:
        resources = {
        }
        return resources
