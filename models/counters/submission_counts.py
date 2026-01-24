import json
import time
from datetime import datetime, timedelta
from typing import Optional, TYPE_CHECKING

from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import Column, String, Integer, ForeignKey, Text, func, JSON, Index, and_, Enum, DateTime, Float, \
    UniqueConstraint, BigInteger
from sqlalchemy import update
import models
from models.enums.metrics import SubmissionMetrics
from models.generics.models import db, ma
from models.generics.base import Base
from common.dates import datetime_to_string, string_to_datetime
from models.enums import CourseLogEvent, SubmissionLogEvent
from common.databases import get_enum_values
from sqlalchemy_utc import UtcDateTime, utcnow
import models

from sqlalchemy.dialects.postgresql import insert as insert_postgres
from sqlalchemy.dialects.sqlite import insert as insert_sqlite

if TYPE_CHECKING:
    from models import Submission

class SubmissionCounts(Base):
    __tablename__ = 'submission_counts'

    UNIQUE_SUBMISSION_METRIC = "submission_counts_unique_index"

    submission_id: Mapped[int] = mapped_column(Integer, ForeignKey('submission.id'))
    submission: Mapped["models.Submission"] = db.relationship(back_populates='counts')

    metric: Mapped[str] = mapped_column(Enum(SubmissionMetrics, values_callable=get_enum_values))
    value: Mapped[int] = mapped_column(BigInteger(), default=0)

    __table_args__ = (
        UniqueConstraint('submission_id', 'metric', name=UNIQUE_SUBMISSION_METRIC),
        # Index('ix_submission_counts_metric', 'metric'),
    )

    def encode_json(self):
        return {
            'submission_id': self.submission_id,
            'metric': self.metric,
            'value': self.value
        }

    @classmethod
    def parse_message(cls, event_type: str, message: str, extended: bool = False) -> Optional[dict]:
        full_data = {}
        if event_type == "Intervention" and extended:
            full_data = json.loads(message)
            '''
            {
                "message": "",
                "syntaxError": true,
                "runtimeError": true,
                "unitTests": {
                    "tests": 0,
                    "feedbacks": 0,
                    "successes": 0,
                    "feedbackSuccess": 0
                }
            }
            '''
        return full_data

    @classmethod
    def track_event(cls, submission_id, event_type, full_data, when=None):
        if when is None:
            when = time.time()
        if event_type == SubmissionLogEvent.BLOCKPY_PASTE:
            cls.safely_increase_batch(submission_id, [(SubmissionMetrics.editing_pastes, 1)])
        elif event_type == "Intervention":
            cls.safely_increase_batch(submission_id, [
                (SubmissionMetrics.total_interventions, 1),
                (SubmissionMetrics.total_intervention_time, when),
                (SubmissionMetrics.feedback_total, 1),
                (SubmissionMetrics.feedback_syntax_errors, int(bool(full_data.get("syntaxError", False)))),
                (SubmissionMetrics.feedback_runtime_errors, int(bool(full_data.get("runtimeError", False)))),
                (SubmissionMetrics.feedback_assertion_counts, full_data.get("unitTests", {}).get("tests", 0)),
                (SubmissionMetrics.feedback_assertion_successes, full_data.get("unitTests", {}).get("successes", 0)),
                (SubmissionMetrics.feedback_assertion_feedbacks, full_data.get("unitTests", {}).get("feedbacks", 0)),
                (SubmissionMetrics.feedback_assertion_feedback_successes, full_data.get("unitTests", {}).get("feedbackSuccess", 0)),
            ])
        elif event_type in (SubmissionLogEvent.EDIT,SubmissionLogEvent.CREATE,
                            SubmissionLogEvent.BLOCKPY_FILE_EDIT,SubmissionLogEvent.BLOCKPY_FILE_CREATE):
            cls.safely_increase_batch(submission_id, [
                (SubmissionMetrics.total_edit_time, when),
                (SubmissionMetrics.total_edits, 1)
            ])

    @classmethod
    def safely_increase_batch(cls, submission_id, updates: list[tuple[str, int]]):
        """
        Safely update multiple fields with insert/on_conflict_do_update.
        Only commits once.

        :param updates:
        :return:
        """
        insert = insert_sqlite if db.engine.dialect.name == 'insert_sqlite' else insert_postgres

        for metric, value in updates:
            stmt = insert(cls).values({
                "submission_id": submission_id,
                "metric": metric,
                "value": value
            })
            stmt = stmt.on_conflict_do_update(
                index_elements=[cls.submission_id, cls.metric],
                set_={"value": cls.value + value}
            )
            db.session.execute(stmt)
        db.session.commit()

    @classmethod
    def safely_increase_single(cls, submission_id: int, metric: str, value: int, default: int = 1):
        """
        Safely update the given fields for the user counts.

        :param submission_id: The submission ID.
        :param kwargs: The fields to update.
        :return:
        """
        stmt = (
            update(cls).
            where(cls.submission_id == submission_id, cls.metric == metric).
            values({"value": value})
        )
        result = db.session.execute(stmt)
        db.session.commit()
        if result.rowcount == 0:
            instance = cls(submission_id=submission_id, metric=metric, value=default)
            db.session.add(instance)
            db.session.commit()

    @classmethod
    def safely_max(cls, submission_id: int, metric: str, value: int):
        current = db.session.query(cls).filter_by(submission_id=submission_id, metric=metric).first()
        if current is None:
            instance = cls(submission_id=submission_id, metric=metric, value=value)
            db.session.add(instance)
            db.session.commit()
        else:
            if value > current.value:
                current.value = value
                db.session.commit()
