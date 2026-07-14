"""
Models for the Q&A Posts system.
"""
from typing import Optional, TYPE_CHECKING
from datetime import datetime

from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import (
    Column,
    Text,
    Integer,
    Boolean,
    ForeignKey,
    Index,
    String,
    Enum,
)

from common.databases import get_enum_values
from models.enums import PostStatus
from models.generics.models import db
from models.generics.base import Base

if TYPE_CHECKING:
    from models import *


class Post(Base):
    """
    A question or post from a student or instructor.
    Can be associated with a course (required), assignment, assignment_group, or submission (optional).
    """
    __tablename__ = "post"
    
    title: Mapped[str] = mapped_column(String(255), default="")
    content: Mapped[str] = mapped_column(Text(), default="")
    content_format: Mapped[str] = mapped_column(String(50), default="markdown")
    
    # Status tracking
    is_public: Mapped[bool] = mapped_column(Boolean(), default=False)
    is_answered: Mapped[bool] = mapped_column(Boolean(), default=False)
    status: Mapped[PostStatus] = mapped_column(
        Enum(PostStatus, values_callable=get_enum_values),
        default=PostStatus.OPEN
    )
    
    # Foreign keys - course and author are required
    course_id: Mapped[int] = mapped_column(Integer(), ForeignKey("course.id"))
    author_id: Mapped[int] = mapped_column(Integer(), ForeignKey("user.id"))
    
    # Optional associations
    assignment_id: Mapped[Optional[int]] = mapped_column(
        Integer(), ForeignKey("assignment.id"), nullable=True
    )
    assignment_group_id: Mapped[Optional[int]] = mapped_column(
        Integer(), ForeignKey("assignment_group.id"), nullable=True
    )
    submission_id: Mapped[Optional[int]] = mapped_column(
        Integer(), ForeignKey("submission.id"), nullable=True
    )
    
    # Relationships
    course: Mapped["Course"] = db.relationship(back_populates="posts")
    author: Mapped["User"] = db.relationship(back_populates="posts")
    assignment: Mapped[Optional["Assignment"]] = db.relationship(back_populates="posts")
    assignment_group: Mapped[Optional["AssignmentGroup"]] = db.relationship(back_populates="posts")
    submission: Mapped[Optional["Submission"]] = db.relationship(back_populates="posts")
    comments: Mapped[list["Comment"]] = db.relationship(
        back_populates="post", cascade="all, delete-orphan"
    )
    
    __table_args__ = (
        Index('post_course_index', "course_id"),
        Index('post_author_index', "author_id"),
        Index('post_assignment_index', "assignment_id"),
        Index('post_status_index', "status"),
    )
    
    def __str__(self):
        return f"<Post {self.id}: {self.title}>"
    
    def encode_json(self):
        """Encode post as JSON for API responses."""
        return {
            '_schema_version': 1,
            'id': self.id,
            'title': self.title,
            'content': self.content,
            'content_format': self.content_format,
            'is_public': self.is_public,
            'is_answered': self.is_answered,
            'status': self.status.value if self.status else 'open',
            'course_id': self.course_id,
            'author_id': self.author_id,
            'assignment_id': self.assignment_id,
            'assignment_group_id': self.assignment_group_id,
            'submission_id': self.submission_id,
            'date_created': self.date_created,
            'date_modified': self.date_modified,
            'comment_count': len(self.comments) if self.comments else 0,
        }
    
    @staticmethod
    def new(title: str, content: str, author_id: int, course_id: int,
            assignment_id: Optional[int] = None, assignment_group_id: Optional[int] = None,
            submission_id: Optional[int] = None, content_format: str = "markdown"):
        """Create a new post."""
        new_post = Post(
            title=title,
            content=content,
            content_format=content_format,
            author_id=author_id,
            course_id=course_id,
            assignment_id=assignment_id,
            assignment_group_id=assignment_group_id,
            submission_id=submission_id,
            status=PostStatus.OPEN
        )
        db.session.add(new_post)
        db.session.commit()
        return new_post
    
    def mark_public(self, is_public: bool = True):
        """Mark post as public or private."""
        self.is_public = is_public
        db.session.commit()
    
    def mark_answered(self, is_answered: bool = True):
        """Mark post as answered or unanswered."""
        self.is_answered = is_answered
        db.session.commit()
    
    def promote_to_assignment(self):
        """Promote post from submission-level to assignment-level."""
        if self.submission_id and self.assignment_id:
            # Keep the assignment_id but remove submission_id
            self.submission_id = None
            db.session.commit()
            return True
        return False


class Comment(Base):
    """
    A comment on a post. Can be from any user with access to the post.
    """
    __tablename__ = "comment"
    
    content: Mapped[str] = mapped_column(Text(), default="")
    content_format: Mapped[str] = mapped_column(String(50), default="markdown")
    
    # Foreign keys
    post_id: Mapped[int] = mapped_column(Integer(), ForeignKey("post.id"))
    author_id: Mapped[int] = mapped_column(Integer(), ForeignKey("user.id"))
    
    # Relationships
    post: Mapped["Post"] = db.relationship(back_populates="comments")
    author: Mapped["User"] = db.relationship(back_populates="comments")
    
    __table_args__ = (
        Index('comment_post_index', "post_id"),
        Index('comment_author_index', "author_id"),
    )
    
    def __str__(self):
        return f"<Comment {self.id} on Post {self.post_id}>"
    
    def encode_json(self):
        """Encode comment as JSON for API responses."""
        return {
            '_schema_version': 1,
            'id': self.id,
            'content': self.content,
            'content_format': self.content_format,
            'post_id': self.post_id,
            'author_id': self.author_id,
            'date_created': self.date_created,
            'date_modified': self.date_modified,
        }
    
    @staticmethod
    def new(content: str, post_id: int, author_id: int, content_format: str = "markdown"):
        """Create a new comment."""
        new_comment = Comment(
            content=content,
            post_id=post_id,
            author_id=author_id,
            content_format=content_format
        )
        db.session.add(new_comment)
        db.session.commit()
        return new_comment
