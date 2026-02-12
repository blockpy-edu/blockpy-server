"""
Tests for Post and Comment models.
"""
import pytest
from datetime import datetime, timezone

from models import db
from models.post import Post, Comment
from models.user import User
from models.course import Course
from models.assignment import Assignment
from models.enums import PostStatus


def test_create_post(app):
    """Test creating a post."""
    with app.app_context():
        # Create test user and course
        user = User.new_from_instructor(
            email="test@example.com",
            first_name="Test",
            last_name="User"
        )
        course = Course.new(
            name="Test Course",
            owner_id=user.id,
            visibility="private",
            term="Fall 2024",
            url="test-course"
        )
        
        # Create post
        post = Post.new(
            title="Test Question",
            content="How do I solve this problem?",
            author_id=user.id,
            course_id=course.id,
            content_format="markdown"
        )
        
        assert post.id is not None
        assert post.title == "Test Question"
        assert post.content == "How do I solve this problem?"
        assert post.author_id == user.id
        assert post.course_id == course.id
        assert post.is_answered is False
        assert post.is_public is False
        assert post.status == PostStatus.OPEN


def test_post_relationships(app):
    """Test post relationships with course and author."""
    with app.app_context():
        user = User.new_from_instructor(
            email="test2@example.com",
            first_name="Test",
            last_name="User"
        )
        course = Course.new(
            name="Test Course 2",
            owner_id=user.id,
            visibility="private",
            term="Fall 2024",
            url="test-course-2"
        )
        
        post = Post.new(
            title="Test Question 2",
            content="Another question",
            author_id=user.id,
            course_id=course.id
        )
        
        # Test relationships
        assert post.author.email == "test2@example.com"
        assert post.course.name == "Test Course 2"
        assert post in course.posts
        assert post in user.posts


def test_create_comment(app):
    """Test creating a comment on a post."""
    with app.app_context():
        user = User.new_from_instructor(
            email="test3@example.com",
            first_name="Test",
            last_name="User"
        )
        course = Course.new(
            name="Test Course 3",
            owner_id=user.id,
            visibility="private",
            term="Fall 2024",
            url="test-course-3"
        )
        
        post = Post.new(
            title="Test Question 3",
            content="Question with comment",
            author_id=user.id,
            course_id=course.id
        )
        
        # Create comment
        comment = Comment.new(
            content="Here's the answer",
            post_id=post.id,
            author_id=user.id,
            content_format="markdown"
        )
        
        assert comment.id is not None
        assert comment.content == "Here's the answer"
        assert comment.post_id == post.id
        assert comment.author_id == user.id


def test_comment_relationships(app):
    """Test comment relationships with post and author."""
    with app.app_context():
        user = User.new_from_instructor(
            email="test4@example.com",
            first_name="Test",
            last_name="User"
        )
        course = Course.new(
            name="Test Course 4",
            owner_id=user.id,
            visibility="private",
            term="Fall 2024",
            url="test-course-4"
        )
        
        post = Post.new(
            title="Test Question 4",
            content="Question with relationships",
            author_id=user.id,
            course_id=course.id
        )
        
        comment = Comment.new(
            content="Comment with relationships",
            post_id=post.id,
            author_id=user.id
        )
        
        # Test relationships
        assert comment.post.title == "Test Question 4"
        assert comment.author.email == "test4@example.com"
        assert comment in post.comments
        assert comment in user.comments


def test_mark_post_public(app):
    """Test marking a post as public."""
    with app.app_context():
        user = User.new_from_instructor(
            email="test5@example.com",
            first_name="Test",
            last_name="User"
        )
        course = Course.new(
            name="Test Course 5",
            owner_id=user.id,
            visibility="private",
            term="Fall 2024",
            url="test-course-5"
        )
        
        post = Post.new(
            title="Test Question 5",
            content="Question to be made public",
            author_id=user.id,
            course_id=course.id
        )
        
        assert post.is_public is False
        
        post.mark_public(True)
        
        assert post.is_public is True


def test_mark_post_answered(app):
    """Test marking a post as answered."""
    with app.app_context():
        user = User.new_from_instructor(
            email="test6@example.com",
            first_name="Test",
            last_name="User"
        )
        course = Course.new(
            name="Test Course 6",
            owner_id=user.id,
            visibility="private",
            term="Fall 2024",
            url="test-course-6"
        )
        
        post = Post.new(
            title="Test Question 6",
            content="Question to be answered",
            author_id=user.id,
            course_id=course.id
        )
        
        assert post.is_answered is False
        
        post.mark_answered(True)
        
        assert post.is_answered is True


def test_post_encode_json(app):
    """Test post JSON encoding."""
    with app.app_context():
        user = User.new_from_instructor(
            email="test7@example.com",
            first_name="Test",
            last_name="User"
        )
        course = Course.new(
            name="Test Course 7",
            owner_id=user.id,
            visibility="private",
            term="Fall 2024",
            url="test-course-7"
        )
        
        post = Post.new(
            title="Test Question 7",
            content="Question for JSON",
            author_id=user.id,
            course_id=course.id
        )
        
        json_data = post.encode_json()
        
        assert json_data['id'] == post.id
        assert json_data['title'] == "Test Question 7"
        assert json_data['content'] == "Question for JSON"
        assert json_data['author_id'] == user.id
        assert json_data['course_id'] == course.id
        assert json_data['is_answered'] is False
        assert json_data['is_public'] is False
        assert json_data['status'] == 'open'
