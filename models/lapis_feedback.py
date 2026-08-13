"""
Feedback authored in LAPIS (the learning-analytics pilot) and released to
students. Rows arrive via the token-authenticated POST /lapis/feedback
endpoint (see controllers/endpoints/lapis.py) and are shown to the student
in the Student Feedback Menu, which stamps date_first_viewed on first view.
"""

from datetime import datetime
from typing import Optional, TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from models.generics.base import Base
from models.generics.models import db

if TYPE_CHECKING:
    from models import *


class LapisFeedback(Base):
    __tablename__ = "lapis_feedback"

    user_id: Mapped[int] = mapped_column(Integer(), ForeignKey("user.id"))
    course_id: Mapped[Optional[int]] = mapped_column(
        Integer(), ForeignKey("course.id"), nullable=True
    )
    # The menu groups by this (e.g. "Week 5").
    analysis_window: Mapped[str] = mapped_column(String(255), default="")
    # Markdown, instructor-authored in LAPIS.
    body: Mapped[str] = mapped_column(Text(), default="")
    source: Mapped[str] = mapped_column(String(255), default="lapis")
    # Idempotency key: re-releases of the same LAPIS draft update in place.
    lapis_draft_id: Mapped[Optional[int]] = mapped_column(
        Integer(), unique=True, nullable=True
    )
    date_released: Mapped[Optional[datetime]] = mapped_column(
        DateTime(), nullable=True
    )
    # Stamped once, on the student's first view; never overwritten.
    date_first_viewed: Mapped[Optional[datetime]] = mapped_column(
        DateTime(), nullable=True
    )

    user: Mapped["User"] = db.relationship("User")
    course: Mapped["Course"] = db.relationship("Course")

    __table_args__ = (
        Index("lapis_feedback_user_index", "user_id"),
        Index("lapis_feedback_course_index", "course_id"),
    )

    def __str__(self):
        return f"<LapisFeedback {self.id} for user {self.user_id}>"
