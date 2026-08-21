"""
Functions for importing/exporting to various formats

* Bundle: custom blockpy json-based format for sharing and updating courses,
          assignments, groups, and group memberships.
* ProgSnap2: Log format for sharing student code snapshots
* PEML: common format for sharing human-readable/editable assignments.
"""
import io
import json
import os
import time
import shutil
import zipfile
from typing import Type, Union

from natsort import natsorted
from werkzeug.utils import secure_filename

import pdfkit

from sqlalchemy.orm import selectinload

from common.maybe import maybe_int
from models.generics.models import db
from models.assignment import Assignment
from models.assignment_group import AssignmentGroup
from models.assignment_group_membership import AssignmentGroupMembership
from models.course import Course
from models.role import Role
from models.user import User
from models.log_tables import SubmissionLog

from models.data_formats.progsnap2 import dump_progsnap, get_course_users
import models.data_formats.progsnap2ite as progsnap2ite

CATEGORY_MODELS = {
    'courses': Course,
    'assignments': Assignment,
    'groups': AssignmentGroup,
    'memberships': AssignmentGroupMembership
}


# TODO: More sophisticated class for using either ID or URL to keep track of elements.
class Identifier:
    def __init__(self, entity):
        self.id = entity.id
        self.url= entity.url

    def __hash__(self):
        return hash((self.id, self.url))

    def __equal__(self, right):
        if not isinstance(right, Identifier):
            return False
        if self.id is not None and right.id is not None:
            return self.id == right.id
        else:
            return self.url == right.url
        # TODO Handle case where we need to look up the other one


def sorter(membership):
    return membership.get('assignment_group_url', ""), membership.get('assignment_url', "")


def import_bundle(bundle, owner_id, course_id=None, update=True, can_force=False):
    if 'settings' in bundle:
        if 'force' in bundle['settings']:
            if 'owner_id' in bundle['settings']['force']:
                owner_id = bundle['settings']['force']['owner_id']
            if 'course_id' in bundle['settings']['force']:
                course_id = bundle['settings']['force']['course_id']

    # TODO: Modify to return the items that were updated!
    if 'course' in bundle:
        course = Course.decode_json(bundle['course'], owner_id=owner_id)
        db.session.add(course)
        db.session.commit()
    else:
        course = Course.by_id(maybe_int(course_id))
    assignment_remap = {}
    assignments = bundle.get('assignments', [])
    for assignment_data in natsorted(assignments, key=lambda a: a['name']):
        assignment = Assignment.decode_json(assignment_data,
                                            course_id=course.id,
                                            owner_id=owner_id)
        assignment_remap[assignment_data['url']] = assignment.id
    group_remap = {}
    groups = bundle.get('groups', [])
    for group_data in natsorted(groups, key=lambda g: g['name']):
        group = AssignmentGroup.decode_json(group_data,
                                            course_id=course.id,
                                            owner_id=owner_id)
        group_remap[group_data['url']] = group.id
    memberships = bundle.get('memberships', [])
    for member_data in sorted(memberships, key=sorter):
        assignment_id = assignment_remap[member_data['assignment_url']]
        group_id = group_remap[member_data['assignment_group_url']]
        member = AssignmentGroupMembership.decode_json(member_data,
                                                       assignment_id=assignment_id,
                                                       assignment_group_id=group_id)
    return True


# noinspection PyTypeHints
def export_bundle(**kwargs):
    """
    Can consume lists of IDs, URLs, or objects to serialize into JSON data. Named parameters
    to the function are the categories.

    if `connected` is True, then tries to export ALL the associated data, not just the specific element.

    :param kwargs:
    :return:
    """
    dumped = {}
    all_instances = []
    for category, values in kwargs.items():
        if category not in CATEGORY_MODELS:
            raise ValueError('Unknown export category: '+repr(category))
        table = CATEGORY_MODELS[category]
        # Batch-fetch by id and by url instead of one query per value
        ids = {value for value in values if isinstance(value, int)}
        urls = {value for value in values if isinstance(value, str)}
        query = table.query
        if table is Assignment:
            query = query.options(selectinload(Assignment.tags),
                                  selectinload(Assignment.sample_submissions))
        by_id = ({instance.id: instance for instance in query.filter(table.id.in_(ids))}
                 if ids else {})
        by_url = ({instance.url: instance for instance in query.filter(table.url.in_(urls))}
                  if urls else {})
        instances = []
        for value in values:
            if isinstance(value, int):
                instance = by_id.get(value)
            elif isinstance(value, str):
                instance = by_url.get(value)
            elif isinstance(value, table):
                instance = value
            else:
                raise TypeError('Unknown export type for {!r}: {!r}'.format(category, type(value)))
            instances.append(instance)
        all_instances.extend(instances)
        dumped[category] = instances
    # Load every owner in one query so the encoders' User.query.get calls
    # resolve from the session's identity map without SQL
    owner_ids = {getattr(instance, 'owner_id', None) for instance in all_instances
                 if instance is not None}
    for instance in all_instances:
        if isinstance(instance, Assignment):
            owner_ids.update(tag.owner_id for tag in instance.tags)
            owner_ids.update(sample.owner_id for sample in instance.sample_submissions)
    owner_ids.discard(None)
    # Hold the loaded owners in a local so the identity map (weak references)
    # keeps them until encoding is done
    _owners = (User.query.filter(User.id.in_(owner_ids)).all()
               if owner_ids else [])
    return {category: [instance.encode_json() for instance in instances]
            for category, instances in dumped.items()}


def export_progsnap2(output, course_id, assignment_group_ids=None, exclude=None, log=False, format='csv', overwrite=False, partition=None, users=None):
    if log:
        print("Starting off progsnap2 dump")
    if partition is not None:
        users, user_roles = get_course_users(course_id, None)
        users = list(sorted(users.values(), key=lambda user: user.last_name))
        letters = [user.last_name[0].upper() for user in users]
        if log:
            print(len(letters), "users found:", letters)
        letter_breaks = list(sorted(set(letters[::len(letters)//(1+partition)])))[1:]
        if log:
            print(len(letter_breaks), "partitions", letter_breaks)
        user_id_groups = {}
        for letter_break in letter_breaks:
            while users and users[0].last_name[0].upper() <= letter_break:
                user_id_groups.setdefault(letter_break, []).append(users.pop(0).id)
        if users:  # Add remaining users to the last group
            user_id_groups.setdefault("Remaining", []).extend([user.id for user in users])
        if log:
            print({g: len(u) for g, u in user_id_groups.items()})
    elif users is not None:
        user_ids = [maybe_int(u.strip()) for u in users.split(",")]
        user_id_groups = {"": user_ids}
    else:
        user_id_groups = {"": None}
    if format == 'csv':
        output_zip = output+".zip"
        # Start filling it up
        with zipfile.ZipFile(output_zip, "w", zipfile.ZIP_DEFLATED) as zip_file:
            if log:
                print("Starting")
            for filename in dump_progsnap(zip_file, course_id, assignment_group_ids, None):
                if log:
                    print("Completed", filename)
            if log:
                print("Files completed. Writing to disk.")
    else:
        for partition_group, user_ids in user_id_groups.items():
            if log:
                print("Starting", partition_group)
            output_db = f"{output}_{partition_group}.db" if partition_group else f"{output}.db"
            if overwrite:
                if os.path.exists(output_db):
                    if log:
                        print("Removing old file:", output_db)
                    os.remove(output_db)
                    time.sleep(1)
            for progress in progsnap2ite.dump(output_db, course_id, assignment_group_ids, user_ids, exclude):
                if log:
                    print("Completed", progress)
            if log:
                print("Files completed. Writing to disk.")


def export_peml():
    # TODO
    pass


def _prefetch_assignment_encoding(assignments):
    """
    Batch-load the tags, sample submissions, and owners that
    Assignment.encode_json touches, so encoding N assignments does not issue
    3 queries per assignment.

    Returns the loaded owners; the caller must keep the return value referenced
    while encoding, because the session's identity map only holds weak
    references.
    """
    assignment_ids = [a.id for a in assignments if a.id is not None]
    if assignment_ids:
        (Assignment.query
         .options(selectinload(Assignment.tags),
                  selectinload(Assignment.sample_submissions))
         .filter(Assignment.id.in_(assignment_ids))
         .all())
    owner_ids = {a.owner_id for a in assignments}
    for assignment in assignments:
        owner_ids.update(tag.owner_id for tag in assignment.tags)
        owner_ids.update(sample.owner_id for sample in assignment.sample_submissions)
    owner_ids.discard(None)
    if owner_ids:
        return User.query.filter(User.id.in_(owner_ids)).all()
    return []


def _prefetch_submission_related(submissions):
    """
    Load the users, assignments, and courses referenced by the given submissions
    in one query per table, so later lazy relationship accesses (many-to-one
    loads) resolve from the session's identity map without SQL.

    Returns (user_ids, assignment_ids, course_ids, loaded); the caller must
    keep `loaded` referenced while it works, because the session's identity map
    only holds weak references.
    """
    user_ids = {s.user_id for s in submissions if s.user_id is not None}
    assignment_ids = {s.assignment_id for s in submissions if s.assignment_id is not None}
    course_ids = {s.course_id for s in submissions if s.course_id is not None}
    loaded = []
    if user_ids:
        loaded.extend(User.query.filter(User.id.in_(user_ids)).all())
    if assignment_ids:
        loaded.extend(Assignment.query.filter(Assignment.id.in_(assignment_ids)).all())
    if course_ids:
        loaded.extend(Course.query.filter(Course.id.in_(course_ids)).all())
    return user_ids, assignment_ids, course_ids, loaded


def _build_role_lookup(course_ids, user_ids):
    """ One Role query for all (course, user) pairs: {(course_id, user_id): [names]} """
    role_lookup = {}
    if course_ids and user_ids:
        for role in Role.query.filter(Role.course_id.in_(course_ids),
                                      Role.user_id.in_(user_ids)).all():
            role_lookup.setdefault((role.course_id, role.user_id), []).append(role.name)
    return role_lookup


def _build_log_lookup(submissions):
    """ One SubmissionLog query for all submissions: {submission_id: [logs]} """
    log_lookup = {}
    submission_ids = [s.id for s in submissions]
    if submission_ids:
        logs = (SubmissionLog.query
                .filter(SubmissionLog.submission_id.in_(submission_ids))
                .order_by(SubmissionLog.date_created.asc())
                .all())
        for log in logs:
            log_lookup.setdefault(log.submission_id, []).append(log)
    return log_lookup


# noinspection PyTypeHints
def export_zip(assignments=None, submissions=None, users=None, with_history=False):
    dumped = {}
    assignment_paths = {}
    if assignments:
        assignments = list(assignments)
        _owners = _prefetch_assignment_encoding(assignments)
        for assignment in assignments:
            assignment_paths[assignment.id] = assignment.get_filename(extension='')
            dumped[assignment.get_filename(extension='.md')] = json.dumps(assignment.encode_json())
    user_paths = {}
    user_names = []
    if users:
        for user in users:
            user_paths[user.id] = secure_filename(user.name())
            user_names.append(user.name())
    dumped['users.txt'] = "\n".join(sorted(set(user_names)))
    if submissions:
        submissions = list(submissions)
        user_ids, assignment_ids, course_ids, _related = _prefetch_submission_related(submissions)
        role_lookup = _build_role_lookup(course_ids, user_ids)
        log_lookup = _build_log_lookup(submissions) if with_history else None
        for submission in submissions:
            files = submission.encode_human(with_history=with_history,
                                            role_lookup=role_lookup,
                                            log_lookup=log_lookup)
            for filename, contents in files.items():
                path = assignment_paths[submission.assignment_id]+'/'
                path += user_paths[submission.user_id]+'/'
                path += filename
                dumped[path] = contents
    #print(list(dumped.keys()))
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
        for file_name, data in dumped.items():
            zip_file.writestr(file_name, data)
    return zip_buffer.getvalue()


# noinspection PyTypeHints
def export_pdf_zip(assignments=None, submissions=None, users=None, jinja_environment=None):
    dumped = {}
    assignment_paths = {}
    if assignments:
        assignments = list(assignments)
        _owners = _prefetch_assignment_encoding(assignments)
        for assignment in assignments:
            assignment_paths[assignment.id] = assignment.get_filename(extension='')
            dumped[assignment.get_filename(extension='.md')] = json.dumps(assignment.encode_json())
    user_paths = {}
    user_names = []
    if users:
        for user in users:
            user_paths[user.id] = secure_filename(user.name())
            user_names.append(user.name())
    dumped['users.txt'] = "\n".join(sorted(set(user_names)))
    # Start PDF
    pdfs = {}
    # Add submissions to the PDF
    if submissions:
        submissions = list(submissions)
        # Batch-load users/assignments so the per-submission relationship
        # accesses below do not each issue a query
        _user_ids, _assignment_ids, _course_ids, _related = _prefetch_submission_related(submissions)
        template = jinja_environment.from_string("""
                        <strong>Student Name: {{ submission.user.name() }}</strong><br>
                        {{ submission.code|highlight_java_code|safe }}
                        <div style = "display:block; clear:both; page-break-after:always;"></div>""")
        for submission in submissions:
            assignment_filename = submission.assignment.get_filename(".pdf")
            if assignment_filename not in pdfs:
                pdfs[assignment_filename] = []
            pdfs[assignment_filename].append(template.render(submission=submission))
    for pdf_name, pdf in pdfs.items():
        dumped[pdf_name] = pdfkit.from_string("\n".join(pdf))
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
        for file_name, data in dumped.items():
            zip_file.writestr(file_name, data)
    return zip_buffer.getvalue()