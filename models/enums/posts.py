"""
Enumerations for the Posts system.
"""
from enum import Enum


class PostStatus(str, Enum):
    """Status of a post."""
    OPEN = "open"
    ANSWERED = "answered"
    CLOSED = "closed"
