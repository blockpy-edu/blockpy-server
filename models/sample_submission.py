from typing import Optional
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import Column, String, Integer, ForeignKey, func, Text, Table, Boolean

import models
from common.maybe import maybe_int
from models.generics.models import db, ma
from models.generics.base import VersionedBase, Base
from common.dates import datetime_to_string, string_to_datetime
from common.databases import optional_encoded_field


class SampleSubmission(VersionedBase):
    __tablename__ = 'sample_submission'
    name: Mapped[str] = mapped_column(String(255), default="Blank Submission")
    status: Mapped[str] = mapped_column(String(255), default='unknown')
    STATUSES = ['unknown', 'passed', 'failed', 'error', 'skipped']

    code: Mapped[str] = mapped_column(Text(), default="")
    extra_files: Mapped[str] = mapped_column(Text(), default="")
    score: Mapped[int] = mapped_column(Integer(), default=0)
    correct: Mapped[bool] = mapped_column(Boolean(), default=False)
    output: Mapped[str] = mapped_column(Text(), default="")
    inputs: Mapped[str] = mapped_column(Text(), default="")
    feedback: Mapped[str] = mapped_column(Text(), default="")

    forked_id: Mapped[Optional[int]] = mapped_column(Integer(), ForeignKey('submission.id'))
    forked_version: Mapped[int] = mapped_column(Integer(), default=0)
    owner_id: Mapped[int] = mapped_column(Integer(), ForeignKey('user.id'))
    assignment_id: Mapped[int] = mapped_column(Integer(), ForeignKey('assignment.id'))
    version: Mapped[int] = mapped_column(Integer(), default=0)

    assignment: Mapped["Assignment"] = db.relationship(back_populates='sample_submissions')

    def __str__(self):
        return '{} Tag {}'.format(self.kind.title(), self.name)

    def encode_json(self, use_owner=True):
        return {
            '_schema_version': 2,
            'name': self.name,
            'status': self.status,
            'code': self.code,
            'extra_files': self.extra_files,
            'score': self.score,
            'correct': self.correct,
            'output': self.output,
            'inputs': self.inputs,
            'feedback': self.feedback,

            'forked_id': self.forked_id,
            'forked_version': self.forked_version,
            'owner_id': self.owner_id,
            'owner_id__email': optional_encoded_field(self.owner_id, use_owner, models.User.query.get, 'email'),
            'assignment_id': self.assignment_id,
            'version': self.version,
            'id': self.id,
            'date_modified': datetime_to_string(self.date_modified),
            'date_created': datetime_to_string(self.date_created)
        }

    @staticmethod
    def decode_json(data, **kwargs):
        if data['_schema_version'] == 1:
            data = dict(data)  # shallow copy
            del data['_schema_version']
            del data['owner_id__email']
            del data['id']
            del data['date_modified']
            data['date_created'] = string_to_datetime(data['date_created'])
            for key, value in kwargs.items():
                data[key] = value
            return SampleSubmission(**data)
        raise Exception("Unknown schema version: {}".format(data.get('_schema_version', "Unknown")))

    @staticmethod
    def new(owner_id, course_id, name):
        sample_submission = SampleSubmission(owner_id=owner_id, course_id=maybe_int(course_id), name=name)
        db.session.add(sample_submission)
        db.session.commit()
        return sample_submission

    @staticmethod
    def remove(assignment_tag_id):
        SampleSubmission.query.filter_by(id=assignment_tag_id).delete()
        db.session.commit()

    @staticmethod
    def by_assignment(assignment_id):
        return (SampleSubmission.query.filter_by(assignment_id=assignment_id)
                .order_by(SampleSubmission.name)
                .all())

