from typing import TYPE_CHECKING
from datetime import datetime, timedelta

from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import Column, String, Integer, ForeignKey, Text, func, JSON, Index, and_, Float, DateTime

from models.generics.models import db, ma
from models.generics.base import Base
from common.dates import datetime_to_string, string_to_datetime
from models.user import User
from models.course import Course
from models.assignment import Assignment
from sqlalchemy_utc import UtcDateTime, utcnow

if TYPE_CHECKING:
    from models import *


class GradeHistory(Base):
    __tablename__ = "grade_history"
    # Identification
    submission_id: Mapped[int] = mapped_column(Integer(), ForeignKey('submission.id'))
    grader_id: Mapped[int] = mapped_column(Integer(), ForeignKey('user.id'))
    # This is a "true actual" grade (from .full_score()), not a previously penalized one.
    score: Mapped[float] = mapped_column(Float())
    date_submitted: Mapped[datetime] = mapped_column(DateTime(), default=utcnow())

    submission: Mapped["Submission"] = db.relationship(back_populates="grade_history")
    grader: Mapped["User"] = db.relationship(back_populates="grade_history")

    __table_args__ = (Index('grade_history_submission_id_index', "submission_id", ),)

    def encode_json(self):
        return {
            '_schema_version': 1,
            'id': self.id,
            'date_modified': datetime_to_string(self.date_modified),
            'date_created': datetime_to_string(self.date_created),

            'submission-id': self.submission_id,
            'grader_id': self.grader_id,
            'score': self.score,
            'date_submitted': datetime_to_string(self.date_submitted)
        }

    @staticmethod
    def remember(submission_id, grader_id, score, date_submitted):
        log = GradeHistory(submission_id=submission_id,
                           grader_id=grader_id,
                           score=score,
                           date_submitted=date_submitted)
        db.session.add(log)
        db.session.commit()
        return log

    def __str__(self):
        return f'GradeHistory(submission_id={self.submission_id},grader_id={self.grader_id},score={self.score})'

