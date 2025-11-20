import logging
import enum
from collections import OrderedDict
import time
import json
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy.exc import DataError, IntegrityError
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import Column, String, Integer, ForeignKey, Text, func, JSON, Index, and_, Enum
from sqlalchemy_utc import utcnow

import models
from common.text import sanitize_for_pg_text
from models.generics.models import db, ma
from models.generics.base import Base
from models.enums import SubmissionLogEvent
from common.dates import datetime_to_string, string_to_datetime
from common.databases import get_enum_values
from models.user import User
from models.course import Course
from models.assignment import Assignment


class SubmissionLog(Base):
    __tablename__ = "submission_log"
    # Identification
    submission_id: Mapped[int] = mapped_column(Integer(), ForeignKey('submission.id'))
    submission_version: Mapped[int] = mapped_column(Integer())
    # Additional Identification
    assignment_id: Mapped[int] = mapped_column(Integer(), ForeignKey('assignment.id'))
    assignment_version: Mapped[int] = mapped_column(Integer())
    course_id: Mapped[int] = mapped_column(Integer(), ForeignKey('course.id'))
    subject_id: Mapped[int] = mapped_column(Integer(), ForeignKey('user.id'))
    # Actual event data
    event_type: Mapped[str] = mapped_column(String(255), default=SubmissionLogEvent.UNKNOWN.name,)
    file_path: Mapped[Optional[str]] = mapped_column(String(255), default="", nullable=True)
    category: Mapped[str] = mapped_column(String(255), default="")
    label: Mapped[str] = mapped_column(String(255), default="")
    # Message will be JSON encoded data
    message: Mapped[str] = mapped_column(Text(), default="")
    client_timestamp: Mapped[Optional[str]] = mapped_column(String(255), default="")
    client_timezone: Mapped[Optional[str]] = mapped_column(String(255), default="")

    submission: Mapped["Submission"] = db.relationship(back_populates="submission_logs")
    assignment: Mapped["Assignment"] = db.relationship(back_populates="submission_logs")
    subject: Mapped["User"] = db.relationship(back_populates="submission_logs")
    course: Mapped["Course"] = db.relationship(back_populates="submission_logs")

    __table_args__ = (Index('submission_log_submission_index', "submission_id"),
                      Index('submission_log_course_index', "course_id"),
                      Index('submission_log_assignment_index', "assignment_id"),
                      Index('submission_log_subject_index', "subject_id"))

    def encode_json(self):
        return {
            '_schema_version': 2,
            'id': self.id,
            'date_modified': datetime_to_string(self.date_modified),
            'date_created': datetime_to_string(self.date_created),

            'submission_id': self.submission_id,
            'submission_version': self.submission_version,
            'assignment_id': self.assignment_id,
            'assignment_version': self.assignment_version,
            'course_id': self.course_id,
            'subject_id': self.subject_id,
            'event_type': self.event_type,
            'file_path': self.file_path,
            'category': self.category,
            'label': self.label,
            'message': self.message,
            'client_timestamp': self.client_timestamp,
            'client_timezone': self.client_timezone
        }

    @staticmethod
    def new(submission_id: int, submission_version: int,
            assignment_id: int, assignment_version: int,
            course_id: int, subject_id: int,
            event_type: str, file_type: str, category: str, label: str, message: str,
            client_timestamp: str, client_timezone: str):
        # Database logging
        log = SubmissionLog(submission_id=submission_id, submission_version=submission_version,
                            assignment_id=assignment_id, assignment_version=assignment_version,
                            course_id=course_id, subject_id=subject_id,
                            event_type=event_type, file_path=file_type, category=category, label=label,
                            message=sanitize_for_pg_text(message), client_timestamp=client_timestamp, client_timezone=client_timezone)
        db.session.add(log)
        try:
            db.session.commit()
        except (DataError, IntegrityError) as e:
            db.session.rollback()
            logging.getLogger('Database').error(f'Could not create SubmissionLog: {e}')
            return None
        # Single-file logging
        # logging.getLogger('Events').info(log.for_file())
        return log

    def __str__(self):
        return f'<SubmissionLog {self.event_type} for {self.submission_id}>'

    @staticmethod
    def calculate_feedbacks(assignment_id, course_id):
        return (db.session.query(func.count(SubmissionLog.id))
                .filter(SubmissionLog.assignment_id == assignment_id)
                .filter(SubmissionLog.course_id == course_id)
                .filter(SubmissionLog.event_type == 'feedback')
                .filter(SubmissionLog.category != "Success")
                .group_by(SubmissionLog.subject_id)
                .all())

    @staticmethod
    def get_logs_for_user_course(course_id, user_id):
        return (db.session.query(SubmissionLog)
                .filter(SubmissionLog.course_id == course_id)
                .filter(SubmissionLog.subject_id == user_id)
                .all())

    @staticmethod
    def get_logs_for_course(course_id):
        return SubmissionLog.query.filter_by(course_id=course_id).all()

    @staticmethod
    def get_users_for_course(course_id):
        return (db.session.query(User)
                .filter(SubmissionLog.course_id == course_id)
                .filter(SubmissionLog.subject_id == User.id)
                .group_by(SubmissionLog.subject_id, User)
                .all())

    @staticmethod
    def get_assignments_for_course(course_id) -> 'List[models.Assignment]':
        return (db.session.query(Assignment)
                .filter(SubmissionLog.course_id == course_id)
                .filter(SubmissionLog.assignment_id == Assignment.id)
                .group_by(SubmissionLog.assignment_id, Assignment)
                .all())

    @staticmethod
    def remove_by_assignment(assignment_id):
        # Force query planner to use the first column of index
        course_subquery = db.session.query(Course.id).subquery()
        #print(db.session.query(SubmissionLog).filter(SubmissionLog.assignment_id == assignment_id,
        #                              SubmissionLog.course_id.in_(course_subquery)))
        (db.session.query(SubmissionLog).filter(SubmissionLog.assignment_id == assignment_id,
                                      SubmissionLog.course_id.in_(course_subquery))
         .delete(synchronize_session='fetch'))

    @staticmethod
    def get_history(course_id, assignment_id, user_id, page_offset=None, page_limit=None, as_json=True):
        logs = SubmissionLog.query.filter_by(course_id=course_id)
        if assignment_id is not None:
            if isinstance(assignment_id, list):
                logs = logs.filter(SubmissionLog.assignment_id.in_([int(a) for a in assignment_id]))
            elif isinstance(assignment_id, str) and ',' in assignment_id:
                logs = logs.filter(SubmissionLog.assignment_id.in_([int(a) for a in assignment_id.split(",")]))
            else:
                logs = logs.filter_by(assignment_id=assignment_id)
        if user_id is not None:
            if isinstance(user_id, list):
                logs = logs.filter(SubmissionLog.subject_id.in_([int(u) for u in user_id]))
            elif isinstance(user_id, str) and ',' in user_id:
                logs = logs.filter(SubmissionLog.subject_id.in_([int(a) for a in user_id.split(",")]))
            else:
                logs = logs.filter_by(subject_id=user_id)
        logs = logs.order_by(SubmissionLog.date_created.desc())
        if page_offset is not None:
            logs = logs.offset(page_offset)
        if page_limit is not None:
            logs = logs.limit(page_limit)
        logs = logs.all()
        if as_json:
            return [log.encode_json() for log in logs]
        return logs

    @staticmethod
    def get_recent_logs_for_course(course_id, duration_amount, duration_type):
        duration_amount = int(duration_amount)
        start_time = utcnow() - timedelta(**{duration_type: duration_amount})
        recent_submissions = (
            models.Submission.query.with_entities(models.Submission.course_id,
                                                  models.Submission.assignment_id,
                                                  models.Submission.user_id)
                .filter_by(course_id=course_id)
                .filter(models.Submission.date_modified >= start_time)
        ).subquery()
        logs = (SubmissionLog.query.join(recent_submissions,
                               and_(SubmissionLog.course_id == recent_submissions.c.course_id,
                                    SubmissionLog.assignment_id == recent_submissions.c.assignment_id,
                                    SubmissionLog.subject_id == recent_submissions.c.user_id))
                .filter(SubmissionLog.date_modified >= start_time)
                ).all()
        return [log.encode_json() for log in logs]

    def for_file(self):
        return ", ".join((
            datetime_to_string(self.date_created),
            str(self.assignment_id),
            str(self.assignment_version),
            str(self.course_id),
            str(self.subject_id),
            json.dumps(self.file_path),
            json.dumps(self.event_type),
            json.dumps(self.category),
            json.dumps(self.label),
            json.dumps(self.message),
            json.dumps(self.client_timestamp),
            json.dumps(self.client_timezone)
        ))

