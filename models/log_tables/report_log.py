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
from models.enums import ReportLogEvent
from common.databases import get_enum_values
import models


class ReportLog(Base):
    __tablename__ = "report_log"
    # Identification
    report_id: Mapped[int] = mapped_column(Integer(), ForeignKey('report.id'))
    subject_id: Mapped[int] = mapped_column(Integer(), ForeignKey('user.id'))
    # Optional context - may be derived from report
    course_id: Mapped[Optional[int]] = mapped_column(Integer(), ForeignKey('course.id'), nullable=True)
    assignment_id: Mapped[Optional[int]] = mapped_column(Integer(), ForeignKey('assignment.id'), nullable=True)
    # Actual event data
    event_type: Mapped[ReportLogEvent] = mapped_column(Enum(ReportLogEvent, values_callable=get_enum_values), nullable=False)
    # For events that need additional data
    field: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    value: Mapped[Optional[str]] = mapped_column(Text(), nullable=True)
    # When the client initiated this action
    client_timestamp: Mapped[Optional[str]] = mapped_column(String(255), default="", nullable=True)
    client_timezone: Mapped[Optional[str]] = mapped_column(String(255), default="", nullable=True)

    report: Mapped["Report"] = db.relationship(back_populates="report_logs")
    subject: Mapped["User"] = db.relationship(back_populates="report_logs")
    course: Mapped[Optional["Course"]] = db.relationship(back_populates="report_logs")
    assignment: Mapped[Optional["Assignment"]] = db.relationship(back_populates="report_logs")

    __table_args__ = (Index('report_log_report_index', "report_id"),
                      Index('report_log_subject_index', "subject_id"))

    @staticmethod
    def new(report_id: int, subject_id: int, event_type: ReportLogEvent,
            course_id: int = None, assignment_id: int = None,
            field: str = None, value: str = None,
            client_timestamp: str = None, client_timezone: str = None):
        # Validate the event
        if not isinstance(event_type, ReportLogEvent):
            raise ValueError(f"Invalid event type: {event_type}")
        if event_type == ReportLogEvent.EDIT and (field is None or value is None):
            raise ValueError("Field and value must be provided for edit events")
        if event_type == ReportLogEvent.EDIT and not hasattr(models.Report, field):
            raise ValueError(f"Unknown field name for Report: {field}")
        # Create the log
        log = ReportLog(report_id=report_id, subject_id=subject_id,
                        course_id=course_id, assignment_id=assignment_id,
                        event_type=event_type,
                        field=field, value=value,
                        client_timestamp=client_timestamp, client_timezone=client_timezone)
        db.session.add(log)
        db.session.commit()
        return log

    def __str__(self):
        return f'<ReportLog {self.event_type} event for {self.report_id}>'