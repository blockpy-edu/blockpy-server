from typing import Optional, TYPE_CHECKING
from datetime import datetime
from flask_security import RoleMixin
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import Column, String, Integer, ForeignKey, DateTime, Enum, UniqueConstraint, Index
from sqlalchemy_utc import UtcDateTime

import models
from common.maybe import maybe_int
from common.text import make_flavored_uuid_generator
from common.databases import get_enum_values
from models.enums import UserRoles, InviteKind, InviteStatus
from models.generics.models import db, ma
from models.generics.base import Base

if TYPE_CHECKING:
    from models import *


class Invite(Base, RoleMixin):
    __tablename__ = "invite"
    url: Mapped[str] = mapped_column(String(80), default=make_flavored_uuid_generator("invite"))
    user_id: Mapped[Optional[int]] = mapped_column(Integer(), ForeignKey('user.id'), default=None, nullable=True)
    course_id: Mapped[int] = mapped_column(Integer(), ForeignKey('course.id'))
    role: Mapped[Optional[UserRoles]] = mapped_column(Enum(UserRoles, values_callable=get_enum_values, native_enum=False), default=UserRoles.LEARNER)
    expires: Mapped[Optional[datetime]] = mapped_column(UtcDateTime)
    kind: Mapped[InviteKind] = mapped_column(Enum(InviteKind, values_callable=get_enum_values, native_enum=False), default=InviteKind.COURSE_INVITE)
    status: Mapped[InviteStatus] = mapped_column(Enum(InviteStatus, values_callable=get_enum_values, native_enum=False), default=InviteStatus.PENDING)
    approver_id: Mapped[Optional[int]] = mapped_column(Integer(), ForeignKey('user.id'), default=None, nullable=True)

    course: Mapped["Course"] = db.relationship(back_populates="invites")
    user: Mapped["User"] = db.relationship(back_populates="invites", foreign_keys=[user_id])
    approver: Mapped["User"] = db.relationship(back_populates="approvals", foreign_keys=[approver_id])

    __table_args__ = (Index('invite_url_index', "url"),
                      Index('invite_course_index', "course_id"),
                      Index('invite_user_index', "user_id"),)

    def __str__(self):
        if self.user_id is not None:
            return f'<Invite {self.role} for {self.user_id} in {self.course_id}>'
        else:
            return f'<Invite {self.role} for {self.course_id}>'


    @staticmethod
    def by_course(course_id):
        return Invite.query.filter_by(course_id=maybe_int(course_id)).all()

