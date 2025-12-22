'''
Loads the static data files for testing.
'''
import csv
import pytest
from pathlib import Path

from common.text import generate_uuid
from models import db
from models.user import User
from models.course import Course
from models.assignment import Assignment
from models.assignment_group import AssignmentGroup
from models.submission import Submission
from models.role import Role
from models.enums.roles import UserRoles
from models.enums import (
    CourseVisibility, CourseKind, CourseService, AssignmentStatus,
    AssignmentTypes, SubmissionStatuses, GradingStatuses, AssignmentGroupCategory
)

TABLES_AND_DATA = [
    ('users', 'user.csv', User),
    ('courses', 'course.csv', Course),
    ('roles', 'role.csv', Role),
]

@pytest.fixture
def test_data():
    """ Load all static data files for testing. """
    data = {}
    for category, filename, model in TABLES_AND_DATA:
        data[category] = load_static_data_file(filename, model)
    return data

def convert_value(value, type_name):
    """ Convert a string value to the appropriate type based on type_name. """
    if type_name == "string_default_uuid":
        if value == "":
            return generate_uuid()
    if type_name == "string":
        return value
    if value == "":
        return None
    try:
        if type_name == 'int':
            return int(value)
        elif type_name == 'float':
            return float(value)
        elif type_name == 'boolean':
            return value.lower() in ('true', '1', 'yes')
        elif type_name == 'CourseVisibility':
            return CourseVisibility[value]
        elif type_name == 'CourseKind':
            return CourseKind[value]
        elif type_name == 'CourseService':
            return CourseService[value]
        elif type_name == 'AssignmentStatus':
            return AssignmentStatus[value]
        elif type_name == 'AssignmentTypes':
            return AssignmentTypes[value]
        elif type_name == 'SubmissionStatuses':
            return SubmissionStatuses[value]
        elif type_name == 'GradingStatuses':
            return GradingStatuses[value]
        elif type_name == 'AssignmentGroupCategory':
            return AssignmentGroupCategory[value]
        else:
            return value  # Default to string
    except Exception as e:
        raise ValueError(f"Error converting value '{value}' to type '{type_name}': {e}") from e

def load_static_data_file(filename, model):
    """ Load a static data file into the database. """
    data = []
    resources = Path(__file__).parent / 'data'
    with open(resources / filename, encoding='utf-8') as f:
        reader = csv.DictReader(row for row in f if not row.lstrip().startswith("#"))
        types = next(reader)
        for row in reader:
            obj = model()
            for key, value in row.items():
                value = convert_value(value, types[key])
                if hasattr(model, key):
                    setattr(obj, key, value)
            db.session.add(obj)
            data.append(obj)
    db.session.commit()
    return data