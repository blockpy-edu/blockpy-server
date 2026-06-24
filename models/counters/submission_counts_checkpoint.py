from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import BigInteger, String, UniqueConstraint

from models.generics.models import db
from models.generics.base import Base


class SubmissionCountsCheckpoint(Base):
    """
    Tracks the last SubmissionLog.id that was processed by the background
    submission-counts daemon task, so the task can resume where it left off.

    A single row named 'default' is used in practice.
    """
    __tablename__ = 'submission_counts_checkpoint'

    name: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, default='default')
    last_log_id: Mapped[int] = mapped_column(BigInteger(), nullable=False, default=0)

    __table_args__ = (
        UniqueConstraint('name', name='submission_counts_checkpoint_name_unique'),
    )

    def __repr__(self):
        return f"<SubmissionCountsCheckpoint(name={self.name!r}, last_log_id={self.last_log_id})>"

    @classmethod
    def get_or_create(cls, name: str = 'default') -> 'SubmissionCountsCheckpoint':
        """Return the checkpoint row, creating it (with last_log_id=0) if absent."""
        instance = db.session.query(cls).filter_by(name=name).first()
        if instance is None:
            instance = cls(name=name, last_log_id=0)
            db.session.add(instance)
            db.session.commit()
        return instance

    @classmethod
    def advance(cls, name: str, last_log_id: int) -> None:
        """Update the checkpoint to *last_log_id*."""
        instance = cls.get_or_create(name)
        instance.last_log_id = last_log_id
        db.session.commit()
