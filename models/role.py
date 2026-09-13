from typing import Optional, TYPE_CHECKING
from flask_security.models.fsqla_v3 import FsRoleMixin as RoleMixin
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import Column, String, Integer, ForeignKey, Enum, Index

from common.maybe import maybe_int
from common.databases import get_enum_values
import models
from models.enums import UserRoles, RoleLogEvent
from models.generics.models import db, ma
from models.generics.base import Base


if TYPE_CHECKING:
    from models import *



class Role(Base):
    __tablename__ = "role"
    name: Mapped[UserRoles] = mapped_column(Enum(UserRoles, values_callable=get_enum_values), default=UserRoles.LEARNER)
    subname: Mapped[str] = mapped_column(String(80), default="")
    user_id: Mapped[int] = mapped_column(ForeignKey('user.id'))
    course_id: Mapped[Optional[int]] = mapped_column(ForeignKey('course.id'), default=None, nullable=True)
    external_id: Mapped[Optional[int]] = mapped_column(Integer(), default=None, nullable=True)

    description: Mapped[Optional[str]] = mapped_column(String(255), default=None, nullable=True)

    user: Mapped["User"] = db.relationship(back_populates='roles')
    course: Mapped["Course"] = db.relationship(back_populates='roles')
    role_logs: Mapped[list["RoleLog"]] = db.relationship(back_populates="role", passive_deletes=True)

    __table_args__ = (Index('role_user_id', "user_id",),
                      Index('role_course_id', "course_id"),)


    def get_permissions(self):
        return set()

    def encode_json(self, use_owner=True):
        return {
            'id': self.id,
            'name': self.name,
            'user_id': self.user_id,
            'course_id': self.course_id
        }

    def update_role(self, new_role, authorizer_id=None):
        """
        Change this role's name. Returns the new name, or None if it was not a valid role.
        The authorizer is the user making the change; None means the subject did it themselves.
        """
        try:
            new_role = UserRoles(new_role)
        except ValueError:
            return None
        self.name = new_role
        db.session.commit()
        self.log_event(RoleLogEvent.CHANGED, str(new_role), authorizer_id)
        return new_role

    def log_event(self, event_type: RoleLogEvent, event_value: str, authorizer_id=None):
        """
        Record a RoleLog row for this role. Global roles (no course) are not logged, since
        role_log.course_id is NOT NULL. A missing authorizer means the subject acted on themselves.
        """
        if self.course_id is None:
            return None
        if authorizer_id is None:
            authorizer_id = self.user_id
        return models.RoleLog.new(self.id, self.course_id, self.user_id, authorizer_id,
                                  event_type, event_value)

    def __str__(self):
        return '<User {} is {}>'.format(self.user_id, self.name)

    @classmethod
    def new(cls, name: UserRoles, user_id: int, course_id: Optional[int] = None, subname: str = "",
            external_id: Optional[int] = None, description: Optional[str] = None,
            authorizer_id: Optional[int] = None) -> "Role":
        instance = cls(name=name, user_id=user_id, course_id=course_id, subname=subname, external_id=external_id, description=description)
        db.session.add(instance)
        db.session.commit()
        instance.log_event(RoleLogEvent.GIVEN, str(instance.name), authorizer_id)
        return instance

    def remove(self, authorizer_id: Optional[int] = None):
        # Log first, while the role row still exists to describe
        self.log_event(RoleLogEvent.REMOVED, str(self.name), authorizer_id)
        Role.query.filter_by(id=self.id).delete()
        db.session.commit()

    @staticmethod
    def by_course(course_id):
        return Role.query.filter_by(course_id=maybe_int(course_id)).all()
