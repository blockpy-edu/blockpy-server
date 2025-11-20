import json
import math
import os
import time
from datetime import timedelta, datetime, timezone
import re

import base64
from typing import Union, Optional, TYPE_CHECKING, Any

from flask import url_for, current_app
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import Column, Text, Integer, Boolean, ForeignKey, Index, func, String, or_, DateTime, Enum
from sqlalchemy.orm import relationship
from sqlalchemy_utc import UtcDateTime
from werkzeug.utils import secure_filename


import models
from common.maybe import maybe_int
from common.text import make_flavored_uuid_generator, sanitize_for_pg_text
from common.databases import get_enum_values
from models.generics.definitions import LatePolicy
from models.assignment import Assignment
from models.generics.models import db, ma
from models.generics.base import EnhancedBase, Base
from common.dates import datetime_to_string
from common.databases import optional_encoded_field
from common.filesystem import ensure_dirs
from models.review import Review
from models.data_formats.quizzes import process_quiz_str, QuizResult, try_parse_file
from models.enums import GradingStatuses, SubmissionStatuses
from models.user import User
from models.log_tables import SubmissionLog
from models.data_formats.blockpy_legacy import DEFAULT_FILENAME, DEFAULT_FILENAMES_BY_TYPE, build_extra_starting_files, inject_code_part

if TYPE_CHECKING:
    from models import *


class Submission(EnhancedBase):
    __tablename__ = "submission"
    code: Mapped[str] = mapped_column(Text(), default="")
    extra_files: Mapped[str] = mapped_column(Text(), default="")
    url: Mapped[str] = mapped_column(Text(), default=make_flavored_uuid_generator("submission_url"), unique=True)
    endpoint: Mapped[str] = mapped_column(Text(), default="")
    # Should be treated as out of X/100
    score: Mapped[int] = mapped_column(Integer(), default=0)
    correct: Mapped[bool] = mapped_column(Boolean(), default=False)
    submission_status: Mapped[SubmissionStatuses] = mapped_column(Enum(SubmissionStatuses, values_callable=get_enum_values), default=SubmissionStatuses.STARTED)
    grading_status: Mapped[GradingStatuses] = mapped_column(Enum(GradingStatuses, values_callable=get_enum_values), default=GradingStatuses.NOT_READY)
    feedback: Mapped[str] = mapped_column(Text(), default="")
    time_limit: Mapped[Optional[str]] = mapped_column(Text(), default="", nullable=True)
    # Date Tracking
    date_started: Mapped[Optional[datetime]] = mapped_column(UtcDateTime(), default=None, nullable=True)
    date_submitted: Mapped[Optional[datetime]] = mapped_column(UtcDateTime(), default=None, nullable=True)
    date_graded: Mapped[Optional[datetime]] = mapped_column(UtcDateTime(), default=None, nullable=True)
    date_due: Mapped[Optional[datetime]] = mapped_column(UtcDateTime(), default=None, nullable=True)
    date_locked: Mapped[Optional[datetime]] = mapped_column(UtcDateTime(), default=None, nullable=True)
    # Tracking
    assignment_id: Mapped[int] = mapped_column(Integer(), ForeignKey('assignment.id'))
    assignment_group_id: Mapped[int] = mapped_column(Integer(), ForeignKey('assignment_group.id'), nullable=True)
    course_id: Mapped[int] = mapped_column(Integer(), ForeignKey('course.id'))
    user_id: Mapped[int] = mapped_column(Integer(), ForeignKey('user.id'))
    assignment_version: Mapped[int] = mapped_column(Integer(), default=0)
    version: Mapped[int] = mapped_column(Integer(), default=0)

    assignment: Mapped["Assignment"] = db.relationship(back_populates="submissions")
    assignment_group: Mapped["AssignmentGroup"] = db.relationship(back_populates="submissions")
    course: Mapped["Course"] = db.relationship(back_populates="submissions")
    user: Mapped["User"] = db.relationship(back_populates="submissions")
    reviews: Mapped[list["Review"]] = db.relationship(back_populates="submission")
    grade_history: Mapped[list["GradeHistory"]] = db.relationship(back_populates="submission")
    submission_logs: Mapped[list["SubmissionLog"]] = db.relationship(back_populates="submission")

    __table_args__ = (Index('submission_index', "course_id",
                            "assignment_id", "user_id"),
                      Index("submission_assignment_index", "assignment_id"),
                      Index("submission_user_index", "user_id"),
                      Index("submission_url_index", "url"),)

    def encode_json(self, use_owner=True):
        return {
            '_schema_version': 2,
            'code': self.code,
            'extra_files': self.extra_files,
            'url': self.url,
            'endpoint': self.endpoint,
            'score': self.as_float_score(self.score),
            'time_limit': self.time_limit,
            'correct': self.correct,
            'assignment_id': self.assignment_id,
            'course_id': self.course_id,
            'user_id': self.user_id,
            'assignment_version': self.assignment_version,
            'version': self.version,
            'submission_status': self.submission_status,
            'grading_status': self.grading_status,
            'feedback': self.feedback,
            'user_id__email': optional_encoded_field(self.user_id, use_owner, models.User.query.get, 'email'),
            'id': self.id,
            'date_modified': datetime_to_string(self.date_modified),
            'date_created': datetime_to_string(self.date_created),
            'date_submitted': datetime_to_string(self.date_submitted),
            'date_graded': datetime_to_string(self.date_graded),
            'date_due': datetime_to_string(self.date_due),
            'date_locked': datetime_to_string(self.date_locked),
            'date_started': datetime_to_string(self.date_started),
        }

    def encode_human(self, with_history=False):
        if self.extra_files:
            try:
                extra_files = json.loads(self.extra_files)
                if isinstance(extra_files, dict):
                    extra_files = {k: v for k, v in extra_files.items()}
                else:
                    extra_files = {f['filename']: f['contents'] for f in extra_files}
            except json.JSONDecodeError as e:
                extra_files = {
                    'errors.txt': 'Could not parse extra files: ' + str(e)
                }
        else:
            extra_files = {}
        if self.assignment:
            filename = DEFAULT_FILENAMES_BY_TYPE.get(self.assignment.type, DEFAULT_FILENAME)
        else:
            filename = DEFAULT_FILENAME
        _grade_data = {
            'score': self.as_float_score(self.score),
            'correct': self.correct,
            'submission_status': self.submission_status,
            'grading_status': self.grading_status,
            'assignment_id': self.assignment_id,
            'id': self.id,
            'course_id': self.course_id,
            'user_id': self.user_id,
            'assignment_version': self.assignment_version,
            'version': self.version,
            'files': [filename]+[f[0] for f in extra_files],
            'roles': [role.name for role, user in User.get_user_role(self.course_id, self.user_id)],
            'date_created': datetime_to_string(self.date_created),
            'date_modified': datetime_to_string(self.date_modified),
            'date_submitted': datetime_to_string(self.date_submitted),
            'date_graded': datetime_to_string(self.date_graded),
            'date_due': datetime_to_string(self.date_due),
            'date_locked': datetime_to_string(self.date_locked),
            'date_started': datetime_to_string(self.date_started),

        }
        if self.user:
            _grade_data['user'] = {
                'email': self.user.email,
                'name': self.user.name(),
                'id': self.user.id,
                'first_name': self.user.first_name,
                'last_name': self.user.last_name,
            }
        if self.course:
            _grade_data['course'] = {
                'name': self.course.name,
                'id': self.course.id,
                'url': self.course.url,
            }
        if with_history:
            extra_files['history.json'] = json.dumps([history.encode_json() for history in self.get_logs()], indent=2)
        files = {
            filename: self.code,
            '_grade.json': json.dumps(_grade_data),
            **extra_files
        }
        return files

    @staticmethod
    def full_by_id(submission_id):
        result = (db.session.query(Submission, models.User, models.Assignment)
                  .filter(Submission.user_id == models.User.id)
                  .filter(Submission.assignment_id == models.Assignment.id)
                  .filter(Submission.id == submission_id)
                  .first())
        if result is None:
            return None, None, None
        else:
            return result

    @staticmethod
    def by_assignment(assignment_id, course_id):
        return (db.session.query(Submission, models.User, models.Assignment)
                .filter(Submission.user_id == models.User.id)
                .filter(Submission.assignment_id == models.Assignment.id)
                .filter(Submission.assignment_id == assignment_id)
                .filter(Submission.course_id == maybe_int(course_id))
                .all())

    @staticmethod
    def all_by_assignment(assignment_id):
        return (db.session.query(Submission)
                .filter(Submission.assignment_id == assignment_id)
                .all())

    @staticmethod
    def get_latest(assignment_id, course_id):
        return (db.session.query(func.max(Submission.date_modified))
                .filter(Submission.course_id == course_id,
                        Submission.assignment_id == assignment_id)
                .group_by(Submission.user_id)
                .order_by(func.max(Submission.date_modified).desc())
                .count())

    @staticmethod
    def by_student(user_id, course_id):
        return (db.session.query(Submission, models.User, models.Assignment)
                .filter(Submission.user_id == models.User.id)
                .filter(Submission.assignment_id == models.Assignment.id)
                .filter(Submission.user_id == user_id)
                .filter(Submission.course_id == course_id)
                .all())

    @staticmethod
    def all_by_student(user_id):
        return (db.session.query(Submission, models.User, models.Assignment)
                .filter(Submission.user_id == models.User.id)
                .filter(Submission.assignment_id == models.Assignment.id)
                .filter(Submission.user_id == user_id)
                .all())

    @staticmethod
    def by_pending_review(course_id):
        return (db.session.query(Submission, models.User, models.Assignment)
                .filter(or_(Submission.submission_status == SubmissionStatuses.SUBMITTED,
                            Submission.submission_status == SubmissionStatuses.COMPLETED))
                .filter(or_(Submission.grading_status == GradingStatuses.PENDING_MANUAL,
                            Submission.grading_status == GradingStatuses.NOT_READY))
                .filter(Submission.user_id == models.User.id)
                .filter(Submission.assignment_id == models.Assignment.id)
                .filter(models.Assignment.reviewed)
                .filter(Submission.course_id == course_id)
                .order_by(models.Assignment.name.asc(),
                          models.User.last_name.asc(),
                          models.User.first_name.asc())
                .all())


    @staticmethod
    def remove_by_assignment(assignment_id):
        return (db.session.query(Submission)
                .filter(Submission.assignment_id == assignment_id)
                .delete())

    def __str__(self):
        return '<Submission {} for {}>'.format(self.id, self.user_id)

    def full_status(self, allow_hide=True):
        if allow_hide and self.assignment.hidden:
            return "???? (Status Hidden)"
        elif self.correct:
            return "Complete (100%)"
        elif self.assignment.reviewed:
            if self.grading_status == "PendingManual":
                return "Pending review"
            elif self.grading_status == "FullyGraded":
                return f"Graded ({int(round(100*self.full_score()))}%)"
            elif self.submission_status == 'inProgress':
                return "Grade in progress"
            else:
                return self.submission_status
        elif self.score >= 100:
            return f"Full Points ({self.score}%)"
        elif self.score:
            return "Incomplete ({}%)".format(self.score)
        else:
            return "Incomplete"

    def human_submission_status(self):
        if self.assignment.type == 'quiz':
            attempting, attempt = self.get_quiz_status()
            if attempting:
                return f"Quiz in progress (Attempt {1+attempt})"
        if self.submission_status == SubmissionStatuses.COMPLETED:
            return "Submission completed"
        elif self.submission_status == SubmissionStatuses.SUBMITTED:
            return "Submitted"
        elif self.submission_status == SubmissionStatuses.IN_PROGRESS:
            return "Submission in progress"
        elif self.submission_status == SubmissionStatuses.STARTED:
            return "Submission started"
        elif self.submission_status == SubmissionStatuses.INITIALIZED:
            return "Submission initialized but not yet started"
        else:
            return "Unknown submission status"

    def human_grading_status(self):
        if self.assignment.type == 'quiz':
            attempting, attempt = self.get_quiz_status()
            if not attempting and self.grading_status == GradingStatuses.PENDING:
                return f"Quiz graded"
        if self.grading_status == GradingStatuses.FULLY_GRADED:
            return "Fully Graded"
        elif self.grading_status == GradingStatuses.PENDING:
            return "Pending (maybe done)"
        elif self.grading_status == GradingStatuses.PENDING_MANUAL:
            return "Human grading in progress"
        elif self.grading_status == GradingStatuses.FAILED:
            return "Grade failed to transfer to LMS"
        elif self.grading_status == GradingStatuses.NOT_READY:
            return "Not yet graded"
        else:
            return "Unknown grading status"

    def full_score(self):
        possible = self.assignment.get_points()
        reviews = self.get_reviews_db()
        if self.assignment.reviewed or reviews:
            review_score = sum(review.get_actual_score() for review in reviews)
            return (self.as_float_score(self.score + review_score)) * possible
        return (float(self.correct) or self.as_float_score(self.score)) * possible

    def get_reviews_db(self):
        return Review.query.filter_by(submission_id=self.id).all()

    @staticmethod
    def from_assignment(assignment, user_id, course_id, assignment_group_id=None):
        submission = Submission(assignment_id=assignment.id,
                                user_id=user_id,
                                assignment_group_id=assignment_group_id,
                                course_id=course_id,
                                code=assignment.starting_code,
                                extra_files=build_extra_starting_files(assignment.extra_starting_files),
                                assignment_version=assignment.version)
        db.session.add(submission)
        db.session.commit()
        # TODO: Log extra starting files!
        SubmissionLog.new(submission.id, submission.version, assignment.id, assignment.version, course_id, user_id,
                "File.Create", "answer.py", "", "", assignment.starting_code, "", "")
        return submission

    @staticmethod
    def get_submissions(course_id, assignment_id, user_id):
        subs = Submission.query.filter_by(course_id=course_id)
        # Just need to refactor this to allow lists
        if assignment_id is not None:
            if isinstance(assignment_id, list):
                subs = subs.filter(Submission.assignment_id.in_(assignment_id))
            elif ',' in assignment_id:
                subs = subs.filter(Submission.assignment_id.in_([int(a) for a in assignment_id.split(",")]))
            else:
                subs = subs.filter_by(assignment_id=assignment_id)
        if user_id is not None:
            if isinstance(user_id, list):
                subs = subs.filter(Submission.user_id.in_(user_id))
            elif ',' in user_id:
                subs = subs.filter(Submission.user_id.in_([int(a) for a in user_id.split(",")]))
            else:
                subs = subs.filter_by(user_id=user_id)
        subs = subs.all()
        return [sub.encode_json(use_owner=False) for sub in subs]

    @staticmethod
    def get_submission(assignment_id, user_id, course_id):
        return Submission.query.filter_by(assignment_id=assignment_id,
                                          course_id=course_id,
                                          user_id=user_id).first()

    @staticmethod
    def load_or_new(assignment, user_id, course_id, new_submission_url="", assignment_group_id=None,
                    new_due_date='', new_lock_date=''):
        submission = Submission.get_submission(assignment.id, user_id, course_id)
        if not submission:
            submission = Submission.from_assignment(assignment, user_id, course_id, assignment_group_id)

        if new_submission_url:
            submission.endpoint = new_submission_url
            db.session.commit()
        if new_due_date:
            submission.date_due = new_due_date
            db.session.commit()
        if new_lock_date:
            submission.date_locked = new_lock_date
            db.session.commit()
        return submission

    STUDENT_FILENAMES = ("#extra_student_files.blockpy", "answer.py")

    def save_code(self, filename, code, part_id=""):
        if filename == "#extra_student_files.blockpy":
            self.extra_files = code
        elif filename == "answer.py":
            if part_id:
                code = inject_code_part(self.code, code, part_id)
            self.code = sanitize_for_pg_text(code)
        self.version += 1
        self.assignment_version = self.assignment.version
        db.session.commit()
        return code

    def set_submission(self, score, correct):
        self.score = score
        self.correct = correct
        self.grading_status = GradingStatuses.FULLY_GRADED
        db.session.commit()

    @staticmethod
    def as_int_score(score):
        return int(round(100 * score))

    @staticmethod
    def as_float_score(score):
        return score / 100.0

    def get_review_scores_explained(self):
        reviews = self.get_reviews_db()
        scores = []
        for review in reviews:
            score = str(review.get_actual_score())
            scores.append(score if "%" in score else score + "%")
        return ", ".join(scores)

    def update_submission(self, score, correct, by_human=False, date_submitted=None):
        # TODO: Potential unfairness, error grades are considered late!
        new_score = self.as_int_score(score)
        was_changed = (self.score != new_score or self.correct != correct
                       or self.grading_status == GradingStatuses.FAILED)
        self.score = new_score
        self.correct = correct
        assignment = Assignment.by_id(self.assignment_id)
        do_change_submission_date, do_change_grading_date = True, True
        if assignment.reviewed:
            if by_human:
                self.submission_status = SubmissionStatuses.COMPLETED
                self.grading_status = GradingStatuses.FULLY_GRADED
                do_change_submission_date = False
            else:
                self.submission_status = SubmissionStatuses.IN_PROGRESS
                self.grading_status = GradingStatuses.NOT_READY
                do_change_grading_date = False
        elif self.correct:
            self.submission_status = SubmissionStatuses.COMPLETED
            self.grading_status = GradingStatuses.FULLY_GRADED
        else:
            self.submission_status = SubmissionStatuses.SUBMITTED
            self.grading_status = GradingStatuses.PENDING
        if (was_changed and do_change_submission_date) or not self.date_submitted:
            self.date_submitted = date_submitted or datetime.now(timezone.utc)
        if was_changed and do_change_grading_date:
            self.date_graded = date_submitted or datetime.now(timezone.utc)
        db.session.commit()
        return was_changed

    def mark_graded(self):
        self.date_graded = datetime.now(timezone.utc)
        db.session.commit()

    def update_submission_status(self, status):
        if status not in SubmissionStatuses.choices():
            return False
        self.submission_status = status
        db.session.commit()
        return True

    def update_grading_status(self, status):
        if status not in GradingStatuses.choices():
            return False
        self.grading_status = status
        db.session.commit()
        return True

    @staticmethod
    def save_correct(user_id, assignment_id, course_id):
        submission = Submission.query.filter_by(user_id=user_id,
                                                assignment_id=assignment_id,
                                                course_id=course_id).first()
        if not submission:
            submission = Submission(assignment_id=assignment_id,
                                    user_id=user_id,
                                    course_id=course_id,
                                    correct=True)
            db.session.add(submission)
        else:
            submission.correct = True
        db.session.commit()
        return submission

    def set_status(self, new_value):
        was_changed = self.status != new_value
        self.status = new_value
        db.session.commit()
        return was_changed

    def get_report_blockpy(self, image=""):
        if self.correct:
            message = "Success!"
        else:
            message = "Incomplete"

    def get_block_image(self):
        return self.get_image('submission_blocks', 'blockpy.get_submission_image')

    def get_image(self, directory, endpoint='blockpy.get_image'):
        sub_blocks_folder = os.path.join(current_app.config['UPLOADS_DIR'], directory)
        image_path = os.path.join(sub_blocks_folder, str(self.id) + '.png')
        if os.path.exists(image_path):
            return url_for(endpoint, submission_id=self.id, directory=directory, _scheme="https",_external=True)
        return ""

    def save_block_image(self, image=""):
        return self.save_image('submission_blocks', image, 'blockpy.get_submission_image')

    def save_image(self, directory, data, endpoint='blockpy.get_image'):
        directory = secure_filename(directory)
        sub_folder = os.path.join(current_app.config['UPLOADS_DIR'], directory)
        image_path = os.path.join(sub_folder, str(self.id) + '.png')
        if data != "":
            converted_image = base64.b64decode(data[22:])
            with open(image_path, 'wb') as image_file:
                image_file.write(converted_image)
            return url_for(endpoint, submission_id=self.id, _scheme="https",_external=True)
        elif os.path.exists(image_path):
            try:
                os.remove(image_path)
            except Exception as e:
                current_app.logger.info("Could not delete because:" + str(e))
        return None

    def log_code(self, course_id, extension='.py', timestamp=''):
        '''
        DEPRECATED

        Store the code on disk, mapped to the Assignment ID and the Student ID
        '''
        # Multiple-file logging
        log = models.SubmissionLog.new(self.id, self.version,
                                       'code', 'set', self.assignment_id, self.assignment_version,
                             course_id,
                             self.user_id, body=self.code, timestamp=timestamp)

        directory = os.path.join(current_app.config['BLOCKPY_LOG_DIR'],
                                 str(self.assignment_id),
                                 str(self.user_id))

        ensure_dirs(directory)
        name = time.strftime("%Y%m%d-%H%M%S")
        file_name = os.path.join(directory, name + extension)

        with open(file_name, 'w') as blockly_logfile:
            blockly_logfile.write(self.code)

    def get_reviews(self):
        return [review.encode_json() for review in
                Review.query.filter_by(submission_id=self.id).all()]

    @staticmethod
    def get_meta_reviews():
        return [review.encode_json() for review in
                Review.query.filter_by(generic=True).all()]

    def regrade_if_quiz(self) -> Union[QuizResult, bool]:
        if self.assignment.type == "quiz":
            # Try parsing both as JSON - report errors
            quiz_result = process_quiz_str(self.assignment.instructions, self.assignment.on_run, self.code)
            if quiz_result.graded_successfully:
                # If we graded successfully, attach the feedback to the submission body
                quiz_result.submission_body['feedback'] = quiz_result.feedbacks
                quiz_result.submission_body['summary'] = {
                    'points_possible': quiz_result.points_possible,
                    'score': quiz_result.score
                }
                if 'attempt' in quiz_result.submission_body:
                    quiz_result.submission_body['attempt']['attempting'] = False
                self.code = json.dumps(quiz_result.submission_body, indent=2)
                self.version += 1
                db.session.commit()
            # And return the information
            return quiz_result
        return False

    def give_quiz_mulligan(self, amount):
        attempt_count = 0
        if self.assignment.type == "quiz":
            # Try parsing both as JSON - report errors
            student_ready, student = try_parse_file(self.code or "{}", "Student Submission")
            if student_ready:
                attempt = student.get('attempt', {})
                attempt_count = attempt.get('mulligans', 0)+amount
                attempt['mulligans'] = attempt_count
                student['attempt'] = attempt
                self.code = json.dumps(student, indent=2)
                self.version += 1
                db.session.commit()
            # And return the information
        return attempt_count

    def get_quiz_status(self):
        if self.assignment.type == "quiz":
            # Try parsing both as JSON - report errors
            student_ready, student = try_parse_file(self.code or "{}", "Student Submission")
            if student_ready:
                attempt = student.get('attempt', {})
                return attempt.get('attempting', False), attempt.get('count', 0)
        return False, 0

    def get_tags(self):
        if self.assignment.type == 'blockpy':
            if not self.correct:
                tags = self.assignment.get_setting('tags', [])
                return tags
        return []

    def get_logs(self):
        return SubmissionLog.query.filter_by(submission_id=self.id).order_by(
            SubmissionLog.date_created.asc()).all()

    def get_session_start_time(self):
        first_session = SubmissionLog.query.filter_by(course_id=self.course_id, assignment_id=self.assignment_id,
                            subject_id=self.user_id,event_type='Session.Start').order_by(SubmissionLog.date_created.asc()).first()
        if not first_session:
            return None
        time = first_session.date_created
        offset = time.astimezone().utcoffset()
        return int(round(1000*(time + offset).timestamp()))

    def estimate_duration(self, inactivity_threshold=5):
        logs = SubmissionLog.get_history(self.course_id, self.assignment_id, self.user_id, as_json=False)
        if not logs:
            return 0
        current = logs[-1].date_created
        total = 0
        last_progress = None
        for log in reversed(logs[:-1]):
            if log.event_type == 'Resource.View' and log.category == 'reading':
                if log.label == 'read':
                    data = json.loads(log.message)
                    if last_progress == data['progress']:
                        continue
                    delay = data['delay']
                    last_progress = data['progress']
                    current -= timedelta(milliseconds=delay if delay else 0)
                    total += delay/1000 if delay else 0
                    continue
                if log.label == 'watch':
                    data = json.loads(log.message)
                    if isinstance(data, (int, float)):
                        # Older version, ignore these values
                        continue
                    else:
                        delay = round(data.get('time', 0), 1)
                    total += delay
                    current -= timedelta(seconds=delay)
                    continue

            diff = max(0, min((current - log.date_created).seconds, inactivity_threshold))
            total += diff
            current = log.date_created
        return total

    def copy_from(self, old_submission, overwrite_endpoints=False):
        self.code = old_submission.code
        self.extra_files = old_submission.extra_files
        self.url = old_submission.url
        if overwrite_endpoints or not self.endpoint:
            self.endpoint = old_submission.endpoint
        self.score = old_submission.score
        self.correct = old_submission.correct
        self.submission_status = old_submission.submission_status
        self.grading_status = old_submission.grading_status
        self.date_due = old_submission.date_due
        self.date_locked = old_submission.date_locked
        self.version += 1
        db.session.commit()
        return self

    def find_all_linked_resources(self) -> dict[str, list[Base]]:
        # Get any assignments that are forked from this one
        forked = models.SampleSubmission.query.filter_by(forked_id=self.id).all()
        resources = {
            "Submission": forked,
            "Review": self.reviews,
            "GradeHistory": self.grade_history,
        }
        return resources

    def penalized_full_score(self, at_time=None):
        """
        Looks for any "X-Quiz.Grade" events and penalizes the score based on the late policy

        :param late_policy:
        :param at_time:
        :return:
        """
        late_policy: LatePolicy = self.assignment.get_late_policy(self.course_id)
        if at_time is None:
            if self.date_submitted:
                at_time = self.date_submitted
            else:
                at_time = datetime.now(timezone.utc)
        # First, compute the current "actual score"
        actual_score = self.full_score()
        # If we are not late, then just use the regular score
        if not self.date_due or at_time < self.date_due:
            return actual_score, ["Submission was not late"]
        # No late policy, no penalty
        if late_policy is None or late_policy.disabled:
            return actual_score, ["No late policy, no penalty"]
        # If we are late and the late policy forbids this, we get a zero
        if not late_policy.allowed:
            return 0, ["Late policy forbids submission"]
        # Create the list of grading events
        grade_changes = []
        for event in sorted(self.grade_history, key= lambda x: x.date_submitted):
            date_submitted = event.date_submitted
            offset = date_submitted.astimezone().utcoffset()
            grade_changes.append((date_submitted, offset, event.score))
        grade_changes.append((at_time, at_time.astimezone().utcoffset(), actual_score))
        # Otherwise, we must do some math
        max_best_actual_score = 0
        latest_score = 0
        explanations = [f"Late submission: -{math.ceil(late_policy.amount*100)}% per {late_policy.interval}"]
        #print("Grade changes:")
        for (date_submitted, offset, score) in grade_changes:
            # TODO: Verify time logic is correct
            lateness = late_policy._get_gap(date_submitted, self.date_due)
            lateness_ratio = 1 - late_policy.get_lateness_penalty(date_submitted, self.date_due)
            points_earned = (score - max_best_actual_score)
            taxed_points = points_earned * lateness_ratio
            taxed_score = latest_score + taxed_points
            #print("    ", lateness, lateness_ratio, points_earned, taxed_points, taxed_score)
            #print("        ", date_submitted, self.date_due)
            if lateness_ratio == 1:
                latest_score = taxed_score
                explanations.append(f"Changed to {math.floor(100*taxed_score)}% (no late penalty)")
            elif points_earned <= 0:
                pass
                #explanations.append(f"No points earned")
            elif taxed_score <= latest_score:
                pass
                #explanations.append(f"No points earned (less than previous)")
            if points_earned > 0 and taxed_score > latest_score:
                explanations.append(f"Had {math.floor(100*latest_score)}%, earned {math.floor(100*points_earned)}%, "
                                    f"but reduced to {math.floor(100*taxed_score)}% "
                                    f"because of {math.ceil((1-lateness_ratio)*100)}% penalty ("
                                    f"{math.ceil(lateness)} {late_policy.interval})")
                latest_score = taxed_score
            max_best_actual_score = max(max_best_actual_score, score)
        if max_best_actual_score >= 1:
            explanations.append(f"Earned maximum possible points.")
        if max_best_actual_score == 0 and len(explanations) == 1:
            explanations.clear()
            explanations.append(f"Never earned any points.")
        # TODO: Remember to store the penalized score after this separately!
        return latest_score, explanations


