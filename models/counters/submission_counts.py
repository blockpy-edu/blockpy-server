from datetime import datetime, timedelta
from typing import Optional, TYPE_CHECKING

from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import Column, String, Integer, ForeignKey, Text, func, JSON, Index, and_, Enum, DateTime, Float, \
    UniqueConstraint, BigInteger
from sqlalchemy import update
import models
from models.generics.models import db, ma
from models.generics.base import Base
from common.dates import datetime_to_string, string_to_datetime
from models.enums import CourseLogEvent
from common.databases import get_enum_values
from sqlalchemy_utc import UtcDateTime, utcnow
import models

if TYPE_CHECKING:
    from models import Submission

class SubmissionCounts(Base):
    __tablename__ = 'submission_counts'

    submission_id: Mapped[int] = mapped_column(Integer, ForeignKey('submission.id'), unique=True)
    submission: Mapped["models.Submission"] = db.relationship(back_populates='counts')

    metric: Mapped[str] = mapped_column(String(255))
    value: Mapped[int] = mapped_column(BigInteger(), default=0)

    __table_args__ = (
        UniqueConstraint('submission_id', 'metric'),
        # Index('ix_submission_counts_metric', 'metric'),
    )
    