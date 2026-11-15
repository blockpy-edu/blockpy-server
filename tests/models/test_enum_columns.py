"""
Enum columns must match what the production database really has.

Production stores every enum column as plain VARCHAR; it has no Postgres enum
types. A column declared as a native enum works there for single-row inserts
(the statement never names the type) but fails as soon as several rows are
inserted in one statement, because SQLAlchemy then casts each value to the
enum type: `type "reviewcommentformat" does not exist`. The tests run on
SQLite, where that cast is never made, so this is checked from the column
definitions instead.
"""
from sqlalchemy import Enum
from sqlalchemy.dialects import postgresql

import models  # noqa: F401  (registers every table)
from models import db


def enum_columns():
    return [(table.name, column)
            for table in db.metadata.tables.values()
            for column in table.columns
            if isinstance(column.type, Enum)]


def test_there_are_enum_columns_to_check():
    names = {f"{table}.{column.name}" for table, column in enum_columns()}
    assert {"review.comment_format", "review.status", "submission.grading_status", "role.name"} <= names


def test_enum_columns_are_not_native_database_enums():
    native = sorted(f"{table}.{column.name}" for table, column in enum_columns()
                    if column.type.native_enum)
    assert native == [], (
        "These columns are declared as native database enums, which production does not have. "
        "Declare them with Enum(..., values_callable=get_enum_values, native_enum=False): "
        + ", ".join(native))


def test_enum_columns_are_varchar_on_postgres():
    """ What a multi-row insert casts each value to, and what create_all would build. """
    dialect = postgresql.dialect()
    rendered = {f"{table}.{column.name}": column.type.compile(dialect=dialect)
                for table, column in enum_columns()}
    wrong = {name: sql for name, sql in rendered.items() if not sql.startswith("VARCHAR(")}
    assert wrong == {}


def test_enum_columns_are_long_enough_for_every_value():
    """ The cast in a multi-row insert is to VARCHAR(n); n must fit the longest value. """
    short = sorted(f"{table}.{column.name}" for table, column in enum_columns()
                   if column.type.length < max(len(value) for value in column.type.enums))
    assert short == []
