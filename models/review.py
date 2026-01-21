import os
from typing import Optional, TYPE_CHECKING
import time

import base64

from quart import url_for, current_app
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import Column, Text, Integer, Boolean, ForeignKey, Index, func, String, Enum

from common.databases import get_enum_values
import models
from models.enums import ReviewCommentFormat, ReviewStatus
from models.generics.models import db, ma
from models.generics.base import VersionedBase, Base


if TYPE_CHECKING:
    from models import *


class Review(VersionedBase):
    __tablename__ = "review"
    comment: Mapped[str] = mapped_column(Text(), default="")
    comment_format: Mapped[ReviewCommentFormat] = mapped_column(Enum(ReviewCommentFormat, values_callable=get_enum_values), default=ReviewCommentFormat.MARKDOWN)
    location: Mapped[str] = mapped_column(Text(), default="")
    generic: Mapped[bool] = mapped_column(Boolean(), default=False)
    tag_id: Mapped[Optional[int]] = mapped_column(Integer(), ForeignKey('assignment_tag.id'), nullable=True)
    status: Mapped[ReviewStatus] = mapped_column(Enum(ReviewStatus, values_callable=get_enum_values), default=ReviewStatus.DRAFT)
    extra_data: Mapped[str] = mapped_column(Text(), default="")
    # Should be treated as out of X/100
    score: Mapped[Optional[int]] = mapped_column(Integer(), nullable=True)
    version: Mapped[int] = mapped_column(Integer(), default=0)

    replaces: Mapped[Optional[int]] = mapped_column(Integer(), ForeignKey('review.id'), nullable=True)
    # Tracking
    submission_id: Mapped[Optional[int]] = mapped_column(Integer(), ForeignKey('submission.id'), nullable=True)
    author_id: Mapped[int] = mapped_column(Integer(), ForeignKey('user.id'))
    assignment_version: Mapped[int] = mapped_column(Integer(), default=0)
    submission_version: Mapped[int] = mapped_column(Integer(), default=0)
    tool: Mapped[Optional[str]] = mapped_column(String(255), default="", nullable=True)
    forked_id: Mapped[Optional[int]] = mapped_column(Integer(), ForeignKey('review.id'), nullable=True)
    forked_version: Mapped[Optional[int]] = mapped_column(Integer(), nullable=True)

    tag: Mapped["AssignmentTag"] = db.relationship(back_populates="reviews")
    submission: Mapped["Submission"] = db.relationship(back_populates="reviews")
    author: Mapped["User"] = db.relationship(back_populates="reviews")
    forked: Mapped["Review"] = db.relationship("Review", remote_side="Review.id", foreign_keys=[forked_id])

    __table_args__ = (Index('review_submission_index', "submission_id",),)

    def __str__(self):
        return "<Review {} for {}>".format(self.id, self.submission_id)

    def encode_json(self):
        return {
            '_schema_version': 2,
            'id': self.id,
            'date_modified': self.date_modified,
            'date_created': self.date_created,
            'comment': self.comment,
            'location': self.location,
            'generic': self.generic,
            'tag_id': self.tag_id,
            'score': self.score,
            'submission_id': self.submission_id,
            'author_id': self.author_id,
            'assignment_version': self.assignment_version,
            'submission_version': self.submission_version,
            'version': self.version,
            'forked_id': self.forked_id,
            'forked_version': self.forked_version
        }

    @staticmethod
    def new(data):
        new_review = Review(comment=data['comment'],
                            location=data['location'],
                            generic=data['generic'].lower() == 'true',
                            tag_id=(data['tag_id']),
                            score=data['score'],
                            submission_id=int(data['submission_id']),
                            author_id=int(data['author_id']),
                            assignment_version=data['assignment_version'],
                            submission_version=data['submission_version'],
                            version=0,
                            forked_id=(data['forked_id']),
                            forked_version=0) #TODO: Handle forked_version
        db.session.add(new_review)
        db.session.commit()
        return new_review

    EDITABLE_SETTINGS = ('comment', 'location', 'score', 'generic',
                         'tag_id', 'forked_id', 'forked_version')

    def edit(self, data, update_version=True):
        changes = False
        for key in self.EDITABLE_SETTINGS:
            if key in data:
                old = getattr(self, key)
                new = data[key]
                setattr(self, key, new)
                changes = changes or (old != new)
        if changes:
            if update_version:
                self.version += 1
            self.version += 1
        db.session.commit()
        return self

    def delete(self):
        db.session.delete(self)
        db.session.commit()

    @staticmethod
    def get_for_submission(submission_id):
        return Review.query.filter_by(submission_id=submission_id).all()

    @staticmethod
    def get_generic_reviews():
        return Review.query.filter_by(generic=True).all()

    def get_actual_score(self):
        if self.score is not None:
            if isinstance(self.score, str):
                score = self.score.replace("%", "")
                return float(score)
            else:
                return self.score
        elif self.forked_id is None:
            return 0
        else:
            forked = Review.query.get(self.forked_id)
            if forked is None:
                return 0
            else:
                return forked.get_actual_score()

    def find_all_linked_resources(self) -> dict[str, list[Base]]:
        # Get any assignments that are forked from this one
        forked = Review.query.filter_by(forked_id=self.id).all()
        resources = {
            "Review": forked,
        }
        return resources
