import json
import re
import time
from datetime import datetime, timedelta, timezone
from typing import Optional, TYPE_CHECKING

from emoji import emoji_count

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


def calculate_gap(when, submission_last_updated, min_threshold, max_threshold):
    if isinstance(submission_last_updated, datetime):
        submission_last_updated = submission_last_updated.replace(tzinfo=timezone.utc).timestamp()
    return max(min_threshold, min(max_threshold, abs(when - (submission_last_updated or when))))

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

    PASSED_REGEX = re.compile("passed\s+(\d+)/(\d+)\s+test", re.IGNORECASE)

    @classmethod
    def estimate_tests(cls, message: str):
        total_tests = 0
        total_successes = 0
        match = cls.PASSED_REGEX.search(message)
        if match:
            total_successes = int(match.group(1))
            total_tests = int(match.group(2))
        return {
            "tests": total_tests,
            "successes": total_successes,
        }

    @classmethod
    def parse_message(cls, event_log) -> Optional[dict]:
        event_type = event_log.event_type
        extended = event_log.extended
        category = event_log.category
        message = event_log.message
        full_data = {}
        if event_type == "Intervention":
            if extended:
                full_data = json.loads(message)
            else:
                full_data = {
                    "message": message,
                    "syntaxError": int(category == 'syntax'),
                    "runtimeError": int(category == 'runtime'),
                    "unitTests": cls.estimate_tests(message)
                }
        elif event_log.event_type in (SubmissionLogEvent.EDIT, SubmissionLogEvent.CREATE,
                                      SubmissionLogEvent.BLOCKPY_FILE_EDIT, SubmissionLogEvent.BLOCKPY_FILE_CREATE):
            full_data = {
                "file_path": event_log.file_path,
                "code": message,
            }
        elif event_log.event_type == "Resource.View":
            if category == "reading":
                if event_log.label == "read":
                    full_data = json.loads(message)
                    # NOTE: Need to treat count=2 case without delay, since it was
                    # incorrectly made to be the value that starts on load.
                    # We estimate such cases to be 5 seconds.
                    if full_data.get("count", 1) == 2:
                        full_data["delay"] = 5000  # 5 second
                elif event_log.label == "watch":
                    full_data = json.loads(message)
        return full_data

    KEY_METRIC_MAP_ERRORS = [
        ("syntaxErrors", SubmissionMetrics.feedback_syntax_errors),
        ("runtimeErrors", SubmissionMetrics.feedback_runtime_errors),
    ]
    KEY_METRIC_MAP_UNIT_TEST = [
        ("tests", SubmissionMetrics.feedback_assertion_counts),
        ("successes", SubmissionMetrics.feedback_assertion_successes),
        ("feedbacks", SubmissionMetrics.feedback_assertion_feedbacks),
        ("feedbackSuccess", SubmissionMetrics.feedback_assertion_feedback_successes),
    ]

    @classmethod
    def track_event(cls, submission_id, event_type, full_data, when=None, category=None, label=None,
                    submission_last_updated=None):
        if when is None:
            when = time.time()
        if event_type == SubmissionLogEvent.BLOCKPY_PASTE:
            cls.safely_increase_batch(submission_id, [(SubmissionMetrics.editing_pastes, 1)], submission_last_updated, when)
        elif event_type == "Resource.View":
            # Track whether the user has moved since last event
            if category == "reading":
                if label == "read":
                    cls.safely_increase_batch(submission_id, [
                        (SubmissionMetrics.total_read_time, full_data.get("delay", 0)),
                        (SubmissionMetrics.total_active_read_time, full_data.get("delay", 0) if full_data.get("moved", False) else 0)
                    ], submission_last_updated, when)
                elif label == "visibility":
                    cls.safely_increase_batch(submission_id, [
                        (SubmissionMetrics.window_visibility_changes, 1)
                    ], submission_last_updated, when)
                elif label == "watch":
                    cls.safely_increase_batch(submission_id, [
                        (SubmissionMetrics.total_watch_time, full_data.get("duration", 0))
                    ], submission_last_updated, when)
            # TODO: Track read time
        elif event_type == "Intervention":
            analytics = [
                (SubmissionMetrics.total_interventions, 1),
                (SubmissionMetrics.total_intervention_time, when),
                (SubmissionMetrics.feedback_total, 1),
            ]
            for key, metric in cls.KEY_METRIC_MAP_ERRORS:
                if key in full_data:
                    value = int(bool(full_data[key]))
                    analytics.append((metric, value))

            for key, metric in cls.KEY_METRIC_MAP_UNIT_TEST:
                if key in full_data.get("unitTests", {}):
                    value = full_data["unitTests"][key]
                    analytics.append((metric, value))
            cls.safely_increase_batch(submission_id, analytics, submission_last_updated, when)
        elif event_type in (SubmissionLogEvent.EDIT,SubmissionLogEvent.CREATE,
                            SubmissionLogEvent.BLOCKPY_FILE_EDIT,SubmissionLogEvent.BLOCKPY_FILE_CREATE):
            cls.safely_increase_batch(submission_id, [
                (SubmissionMetrics.total_edit_time, when),
                (SubmissionMetrics.total_edits, 1),
                (SubmissionMetrics.editing_emojis, emoji_count(full_data.get("code", "")))
            ], submission_last_updated, when)
        # Disabling for now due to performance concerns
        #else:
        #    cls.safely_increase_batch(submission_id, [], submission_last_updated, when)

    @classmethod
    def delete_for_submission(cls, submission_id):
        db.session.query(cls).filter(cls.submission_id == submission_id).delete()
        db.session.commit()

    GAP_THRESHOLD = 5  # 5 seconds

    @classmethod
    def safely_increase_batch(cls, submission_id, updates: list[tuple[str, int]], submission_last_updated, when):
        """
        Safely update multiple fields with insert/on_conflict_do_update.
        Only commits once.
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

        stmt = insert(cls).values({
            "submission_id": submission_id,
            "metric": SubmissionMetrics.total_time_spent,
            "value": 0
        })
        gap = calculate_gap(when, submission_last_updated, 0, cls.GAP_THRESHOLD)
        if submission_id == 214:
            print(gap)
        stmt = stmt.on_conflict_do_update(
            index_elements=[cls.submission_id, cls.metric],
            set_={"value": cls.value + gap}
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
