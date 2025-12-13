from typing import Optional, TYPE_CHECKING
from flask_security.models.fsqla_v3 import FsRoleMixin as RoleMixin
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import Column, String, Integer, ForeignKey, Enum, Index

from common.maybe import maybe_int
from common.databases import get_enum_values
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
    role_logs: Mapped[list["RoleLog"]] = db.relationship(back_populates="role")

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
        if new_role in [id for id, name in self.CHOICES]:
            old_role = self.name
            self.name = new_role
            db.session.commit()
            # Log the role change
            import models
            # If no authorizer specified, assume the user is changing their own role
            if authorizer_id is None:
                authorizer_id = self.user_id
            models.RoleLog.new(self.id, self.course_id, self.user_id, authorizer_id,
                               RoleLogEvent.CHANGED, f"{old_role} -> {new_role}")
            return new_role
        return None

    def __str__(self):
        return '<User {} is {}>'.format(self.user_id, self.name)

    @staticmethod
    def remove(role_id, authorizer_id=None):
        import models
        role = Role.query.get(role_id)
        if role:
            # If no authorizer specified, assume the user is removing their own role
            if authorizer_id is None:
                authorizer_id = role.user_id
            # Log the role removal
            models.RoleLog.new(role.id, role.course_id, role.user_id, authorizer_id,
                               RoleLogEvent.REMOVED, role.name)
        Role.query.filter_by(id=role_id).delete()
        db.session.commit()

    @staticmethod
    def by_course(course_id):
        return Role.query.filter_by(course_id=maybe_int(course_id)).all()
