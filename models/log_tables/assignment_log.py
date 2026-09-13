import logging
import enum
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
from models.enums import AssignmentLogEvent
from common.dates import datetime_to_string, string_to_datetime
from common.databases import get_enum_values
import models





class AssignmentLog(Base):
    __tablename__ = "assignment_log"
    # Identification
    # No database foreign keys on the course/role/assignment columns: audit rows must outlive
    # the rows they describe (see fall26_audit_log_fk.sql). The relationships join explicitly.
    assignment_id: Mapped[int] = mapped_column(Integer())
    assignment_version: Mapped[int] = mapped_column(Integer())
    course_id: Mapped[int] = mapped_column(Integer())
    subject_id: Mapped[int] = mapped_column(Integer(), ForeignKey('user.id'))
    # Actual event data
    event_type: Mapped[AssignmentLogEvent] = mapped_column(Enum(AssignmentLogEvent, values_callable=get_enum_values))
    # Message will be JSON encoded data
    field: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    value: Mapped[Optional[str]] = mapped_column(Text(), nullable=True)
    client_timestamp: Mapped[Optional[str]] = mapped_column(String(255), default="", nullable=True)
    client_timezone: Mapped[Optional[str]] = mapped_column(String(255), default="", nullable=True)

    assignment: Mapped["Assignment"] = db.relationship(back_populates="assignment_logs",
                                                       primaryjoin="foreign(AssignmentLog.assignment_id) == Assignment.id")
    subject: Mapped["User"] = db.relationship(back_populates="assignment_logs")
    course: Mapped["Course"] = db.relationship(back_populates="assignment_logs",
                                               primaryjoin="foreign(AssignmentLog.course_id) == Course.id")

    __table_args__ = (Index('assignment_log_assignment_index', "assignment_id"),
                      Index('assignment_log_subject_index', "subject_id"))


    @staticmethod
    def new(assignment_id: int, assignment_version: int, course_id: int, subject_id: int,
            event_type: str, field: str, value: str,
            client_timestamp: str, client_timezone: str):
        # Database logging
        log = AssignmentLog(assignment_id=assignment_id, assignment_version=assignment_version,
                            course_id=course_id, subject_id=subject_id,
                            event_type=event_type,
                            field=field, value=value,
                            client_timestamp=client_timestamp, client_timezone=client_timezone)
        db.session.add(log)
        db.session.commit()
        # Single-file logging
        # logging.getLogger('Events').info(log.for_file())
        return log

    def __str__(self):
        return f'<AssignmentLog {self.event_type} for {self.assignment_id}>'
