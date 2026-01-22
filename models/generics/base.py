"""
The base model that all other models inherit from
"""

import json
from datetime import datetime
from typing import Tuple, Dict, Optional

from sqlalchemy import Integer, Column, DateTime, func
from sqlalchemy.orm import mapped_column, Mapped
from sqlalchemy.ext.declarative import declared_attr
from sqlalchemy_utc import UtcDateTime, utc, utcnow

from common.dates import string_to_datetime, datetime_to_pretty_string
from models.generics.models import db


class Base(db.Model):
    """
    Base Schema of all database models for the site. Everything inherits from
    this schema.
    """

    # No one should instantiate this directly
    __abstract__ = True

    id: Mapped[int] = mapped_column(Integer(), primary_key=True, autoincrement=True)
    date_created: Mapped[datetime] = mapped_column(DateTime(), default=utcnow())
    date_modified: Mapped[datetime] = mapped_column(
        DateTime(), default=utcnow(), onupdate=utcnow()
    )

    SCHEMA_V1_IGNORE_COLUMNS = ("id", "date_modified")
    SCHEMA_V2_IGNORE_COLUMNS = SCHEMA_V1_IGNORE_COLUMNS
    SCHEMA_V1_RENAME_COLUMNS = {}
    SCHEMA_V2_RENAME_COLUMNS = {}

    @classmethod
    def get_schema(cls, schema_version: int) -> tuple[Tuple[str, ...], Dict[str, str]]:
        """
        Given the `schema_version`, provide the appropriate columns to ignore
        and rename. This gives us a simplistic mechanism to handle data versioning.

        It would have been nice to have this as a dictionary, but inheriting dictionaries
        and setting their keys is a tricky thing.

        :param schema_version: Which version of the schema to provide
        :return: The IGNORE and RENAME columns
        """
        if schema_version == 1:
            return cls.SCHEMA_V1_IGNORE_COLUMNS, cls.SCHEMA_V1_RENAME_COLUMNS
        elif schema_version == 2:
            return cls.SCHEMA_V2_IGNORE_COLUMNS, cls.SCHEMA_V2_RENAME_COLUMNS
        raise Exception("Unknown schema version: {}".format(schema_version))

    @declared_attr
    def __tablename__(self) -> str:
        """
        Creates a class-level field named `__tablename__` available that is
        the name of the table in the database. This is actually just the
        lower-case version of the class name.
        :return: The name of the table
        """
        return self.__name__.lower()

    def __repr__(self) -> str:
        """
        Create a string representation of this schema.
        :return: String representation of this model.
        """
        return str(self)

    def pretty_date_modified(self) -> str:
        """
        Get a human-readable version of this object's last modified date.
        :return: A string
        """
        return datetime_to_pretty_string(self.date_modified)

    def pretty_date_created(self) -> str:
        """
        Get a human-readable version of this object's created date.
        :return: A string
        """
        return datetime_to_pretty_string(self.date_created)

    @classmethod
    def by_id(cls, pk_id: Optional[int]) -> 'Optional[Base]':
        """
        Retrieve the object from the database by its `id`. If `None` is passed in, then
        `None` will be returned.
        :param pk_id:
        :return:
        """
        if pk_id is None:
            return None
        return cls.query.get(pk_id)

    def find_all_linked_resources(self) -> dict[str, list["Base"]]:
        return {}

    def remove(self):
        """
        Dangerous method to remove an entity and all of its associated data.
        Should only be used by Admin, after doing proper backups.
        """
        resource_graph = find_all_linked_resources([self])
        return mass_delete(resource_graph)


class VersionedBase(Base):
    __abstract__ = True

    def edit(self, updates: dict, update_version: bool = True) -> bool:
        """
        Modify this instance's fields based on the given keys and values of `updates`.
        Automatically commits the changes. By default, also updates the version number
        by one whenever this is called (but only if actual changes occur).
        :param updates:
        :param update_version:
        :return: Whether the object was modified.
        """
        modified = False
        for key, value in updates.items():
            if getattr(self, key) != value:
                modified = True
                setattr(self, key, value)
        if modified:
            if update_version:
                self.version += 1
            db.session.commit()
        return modified


class EnhancedBase(VersionedBase):
    __abstract__ = True

    @classmethod
    def decode_json(cls, data: dict, **kwargs) -> 'EnhancedBase':
        """
        Default unmarshalling method for transforming the given JSON-formatted data
        into appropriate instance of a class. Additional keys and values can be
        passed in to `kwargs` to add/override the fields in `data`.
        :param data: A valid JSON dictionary with all the fields needed to construct
            an instance of this model.
        :param kwargs: Additional keys+values to add to the constructed model.
        :return: An instance of this model.
        """
        data = dict(data)
        schema_version = data.pop('_schema_version')
        ignored, renamed = cls.get_schema(schema_version)
        # Reformat the creation date to be a datetime object
        if 'date_created' in data:
            data['date_created'] = string_to_datetime(data['date_created'])
        # Rename keys as needed
        for old, new in renamed:
            data[new] = data.pop(old)
        # Copy over keys from the `kwargs`
        for key, value in kwargs.items():
            data[key] = value
        # Delete keys that we wish to ignore
        for ignore in ignored:
            if ignore in data:
                del data[ignore]
        # If the data already exists, we should update it instead of creating
        existing = cls.get_existing(data)
        if existing:
            existing.edit(data, update_version=False)
        else:
            existing = cls(**data)
            db.session.add(existing)
            db.session.commit()
        return existing

    def encode_human(self):
        """ Create a human-friendly version of this data """
        return {f'{self.id}.md': json.dumps(self.encode_human())}

    @classmethod
    def get_existing(cls, data: dict) -> 'Optional[EnhancedBase]':
        """
        Retrieve the existing object from the database (based on its `url` field)
        if it exists (else None).
        :param data: A dictionary representing a database object.
        :return: The object, or None if it does not exist.
        """
        if 'url' in data and data['url']:
            return cls.by_url(data['url'])

    @classmethod
    def by_url(cls, url: str) -> 'Optional[EnhancedBase]':
        """
        Retrieve the object from the database by its `url`. If `None` is passed in, then
        `None` will be returned.
        :param url:
        :return:
        """
        if url is None:
            return None
        return cls.query.filter_by(url=url).first()


def find_all_linked_resources(resources: list[Base]) -> dict[str, list[Base]]:
    """
    Given a list of resources, find all linked resources.
    :param resources: A list of resources
    :return: A dictionary of resources
    """
    unseen_resources = list(resources)
    seen_resources = set(resources)
    resource_graph: dict[str, list[Base]] = {}
    while unseen_resources:
        resource = unseen_resources.pop()
        # Visit this node
        seen_resources.add(resource)
        # Visit all links
        for category, linked_resources in resource.find_all_linked_resources().items():
            for linked_resource in linked_resources:
                if linked_resource not in seen_resources:
                    unseen_resources.append(linked_resource)
                    if category not in resource_graph:
                        resource_graph[category] = []
                    # Put it at the start, to make sure forked assignments are processed first
                    resource_graph[category].insert(0, linked_resource)
    # All done!
    return resource_graph


SAFE_DELETE_ORDER = [
    "GradeHistory",
    "SubmissionLog",
    "AssignmentLog",
    "RoleLog",
    "CourseLog",
    "ErrorLog",
    "AccessLog",
    "Report",
    "AssignmentTagMembership",
    "AssignmentTag",
    "Review",
    "SampleSubmission",
    "Submission",
    "AssignmentGroupMembership",
    "AssignmentGroup",
    "Assignment",
    "Role",
    "Invite",
    "Course",
    "Authentication",
    "User",
]

def mass_delete(resource_graph: dict[str, list[Base]]) -> tuple[int, int]:
    """
    Delete the given resource and all linked resources in a safe order.

    Returns:
        A tuple of the number of resources deleted and the number of forks unforked.
    """
    deleted, unforked = 0, 0
    for fork in resource_graph.get("Forks", []):
        fork.unfork()
        unforked += 1
    for category in SAFE_DELETE_ORDER:
        if category in resource_graph:
            for resource in resource_graph[category]:
                db.session.delete(resource)
                deleted += 1
    db.session.commit()
    return deleted, unforked
