"""
Common utility functions for managing dates and times.
"""

from datetime import datetime, timezone
from dateutil.parser import parse as parse_date


def datetime_to_string(a_datetime: datetime) -> str:
    """
    Convert the given datetime to a string representation
    :param a_datetime: A datetime object
    :return: The string representation
    """
    if a_datetime is None:
        return ""
    return a_datetime.isoformat() # + 'Z'


def string_to_datetime(a_string: str) -> datetime:
    """
    Convert the given string to a datetime. Initially tries the string with a decimal
    place, then tries it without. Strings should be roughly of the format:

    > '%Y-%m-%dT%H:%M:%S.%fZ'

    :param a_string: A string representation of a datetime.
    :return: The datetime version of that string
    """
    try:
        return datetime.strptime(a_string, '%Y-%m-%dT%H:%M:%S.%f%z')
    except ValueError:
        return datetime.strptime(a_string, '%Y-%m-%dT%H:%M:%S%z')

def iso_to_datetime(a_string: str) -> datetime:
    """
    Convert the given ISO 8601 string to a datetime object.
    :param a_string: A string representation of a datetime in ISO 8601 format.
    :return: The datetime version of that string
    """
    return datetime.fromisoformat(a_string.replace('Z', '+00:00')).astimezone(timezone.utc)


def datetime_to_pretty_string(a_datetime: datetime) -> str:
    """
    Creates a string representation of the datetime that is easier to read for humans.
    :param a_datetime: Datetime object.
    :return: String representation of the datetime.
    """
    return a_datetime.strftime("%I:%M%p on %a %d, %b %Y").replace(" 0", " ")


def from_canvas_isotime(a_datetime: str) -> datetime:
    if a_datetime and a_datetime[0] != '$':
        parsed = parse_date(a_datetime)
        return parsed # (parsed - parsed.astimezone().utcoffset())
    return None


def datetime_to_epoch(a_datetime: datetime):
    """
    Convert a datetime to epoch time (seconds since Jan 1, 1970)
    :param a_datetime: A datetime object
    :return: The epoch time as an integer
    """
    if a_datetime is None:
        return 0
    return int(a_datetime.timestamp())

def epoch_to_datetime(epoch_time: int) -> datetime:
    """
    Convert epoch time (seconds since Jan 1, 1970) to a datetime object
    :param epoch_time: The epoch time as an integer
    :return: A datetime object
    """
    if epoch_time is None:
        return None
    if epoch_time == 0:
        return None
    return datetime.fromtimestamp(epoch_time, tz=timezone.utc)