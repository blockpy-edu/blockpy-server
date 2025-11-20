import uuid
import re
from typing import Union
from hashlib import sha256

def compare_string_equality(submitted, expected) -> bool:
    if not submitted and bool(expected):
        return False
    submitted = str(submitted).strip()
    if isinstance(expected, str):
        return submitted == expected
    else:
        # Assume list of possible answers
        return submitted in expected

def sha256_hash(contents):
    """
    Generate a SHA-256 hash of the given contents.

    :param contents: The contents to hash, as a string.
    :return: The SHA-256 hash of the contents.
    """
    return sha256(contents.encode('utf-8')).hexdigest()

def generate_unique_hex():
    return uuid.uuid4().hex


def generate_uuid() -> str:
    return str(uuid.uuid4())


def make_flavored_uuid_generator(flavor: str):
    def generate_flavored_uuid() -> str:
        return f"{flavor}-{uuid.uuid4()}"

    return generate_flavored_uuid

CONTROL_CHARS_RE = re.compile(r"[\x00-\x08\x0b-\x0c\x0e-\x1f]")

def sanitize_for_pg_text(input_string: str) -> str:
    """
    Sanitize a string for safe storage in PostgreSQL text fields by removing control characters.

    Args:
        input_string (str): The input string to sanitize.

    Returns:
        str: The sanitized string with control characters removed.
    """
    if input_string is None:
        return None
    return CONTROL_CHARS_RE.sub("", input_string)