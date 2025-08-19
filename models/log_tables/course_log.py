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
from common.dates import datetime_to_string, string_to_datetime
from models.enums import CourseLogEvent
from common.databases import get_enum_values
import models


class CourseLog(Base):
    __tablename__ = "course_log"
    # Identification
    course_id: Mapped[int] = mapped_column(Integer(), ForeignKey('course.id'))
    subject_id: Mapped[int] = mapped_column(Integer(), ForeignKey('user.id'))
    # Actual event data
    event_type: Mapped[CourseLogEvent] = mapped_column(Enum(CourseLogEvent, values_callable=get_enum_values), nullable=False)
    # For EDIT events
    field: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    value: Mapped[Optional[str]] = mapped_column(Text(), nullable=True)
    # When the client initiated this action
    client_timestamp: Mapped[Optional[str]] = mapped_column(String(255), default="", nullable=True)
    client_timezone: Mapped[Optional[str]] = mapped_column(String(255), default="", nullable=True)

    subject: Mapped["User"] = db.relationship(back_populates="course_logs")
    course: Mapped["Course"] = db.relationship(back_populates="course_logs")

    __table_args__ = (Index('course_log_course_index', "course_id"),
                      Index('course_log_subject_index', "subject_id"))

    @staticmethod
    def new(course_id: int, subject_id: int, event_type: CourseLogEvent,
            field: str = None, value: str = None,
            client_timestamp: str = None, client_timezone: str = None):
        # Validate the event
        if not isinstance(event_type, CourseLogEvent):
            raise ValueError(f"Invalid event type: {event_type}")
        if event_type == CourseLogEvent.EDIT and (field is None or value is None):
            raise ValueError("Field and value must be provided for edit events")
        if event_type == CourseLogEvent.EDIT and not hasattr(models.Course, field):
            raise ValueError(f"Unknown field name for Course: {field}")
        # Create the log
        log = CourseLog(course_id=course_id, subject_id=subject_id,
                        event_type=event_type,
                        field=field, value=value,
                        client_timestamp=client_timestamp, client_timezone=client_timezone)
        db.session.add(log)
        db.session.commit()
        return log

    def __str__(self):
        return f'<CourseLog {self.event_type} event in {self.course_id}>'
