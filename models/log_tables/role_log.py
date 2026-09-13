import logging
from collections import OrderedDict
import time
import json
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import Column, String, Integer, ForeignKey, Text, func, JSON, Index, and_, Enum

import models
from models.generics.models import db, ma
from models.generics.base import Base
from models.enums import RoleLogEvent
from common.dates import datetime_to_string, string_to_datetime
from common.databases import get_enum_values
import models


class RoleLog(Base):
    __tablename__ = "role_log"
    # No database foreign keys on the course/role/assignment columns: audit rows must outlive
    # the rows they describe (see fall26_audit_log_fk.sql). The relationships join explicitly.
    role_id: Mapped[int] = mapped_column(Integer())
    # Identification
    course_id: Mapped[int] = mapped_column(Integer())
    subject_id: Mapped[int] = mapped_column(Integer(), ForeignKey('user.id'))
    # Authorization
    authorizer_id: Mapped[int] = mapped_column(Integer(), ForeignKey('user.id'))
    # Actual event data
    event_type: Mapped[RoleLogEvent] = mapped_column(Enum(RoleLogEvent, values_callable=get_enum_values), nullable=False)
    event_value: Mapped[str] = mapped_column(String(255), nullable=False)

    # When the client initiated this action
    client_timestamp: Mapped[Optional[str]] = mapped_column(String(255), default="", nullable=True)
    client_timezone: Mapped[Optional[str]] = mapped_column(String(255), default="", nullable=True)

    role: Mapped["Role"] = db.relationship(back_populates="role_logs",
                                           primaryjoin="foreign(RoleLog.role_id) == Role.id")
    course: Mapped["Course"] = db.relationship(back_populates="role_logs",
                                               primaryjoin="foreign(RoleLog.course_id) == Course.id")
    subject: Mapped["User"] = db.relationship(back_populates="role_logs", foreign_keys=[subject_id])
    authorizer: Mapped["User"] = db.relationship(back_populates="authorizer_logs", foreign_keys=[authorizer_id])

    __table_args__ = (Index('role_log_role_index', "role_id"),
                      Index('role_log_course_index', "course_id"),
                      Index('role_log_subject_index', "subject_id"),
                      Index('role_log_authorizer_index', "authorizer_id"))

    @staticmethod
    def new(role_id: int, course_id: int, subject_id: int, authorizer_id: int,
            event_type: RoleLogEvent, event_value: str,
            client_timestamp: str = None, client_timezone: str = None):
        # Validate the event
        if not isinstance(event_type, RoleLogEvent):
            raise ValueError(f"Invalid event type: {event_type}")
        # Create the log
        log = RoleLog(role_id=role_id, course_id=course_id, subject_id=subject_id,
                      authorizer_id=authorizer_id, event_type=event_type, event_value=event_value,
                      client_timestamp=client_timestamp, client_timezone=client_timezone)
        db.session.add(log)
        db.session.commit()
        return log

    def __str__(self):
        return f'<RoleLog {self.event_type} event for {self.role_id}>'
