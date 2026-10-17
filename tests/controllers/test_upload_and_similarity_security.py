"""
Regression tests for two reported vulnerabilities:
- Similarity reports could be launched for any assignment id by a grader of an unrelated course,
  and the background task loaded every course's submissions for that assignment.
- upload_file accepted any file type (including .html/.svg) from anonymous users, and download_file
  served them inline with a script-capable content type on the app origin.
"""
import io
import os

import pytest
from werkzeug.exceptions import HTTPException

from models.assignment import Assignment
from models.submission import Submission
from models.user import User


ADA = "ada@blockpy.com"          # instructor of course 6 (owns assignment 100) and many others
CAPTAIN = "captain@blockpy.com"  # instructor of courses 2, 14, 15, 16 -- not 6
LULU = "lulu@blockpy.com"        # learner in course 6


@pytest.fixture
def uploads_dir(app, tmp_path):
    app.config['UPLOADS_DIR'] = str(tmp_path / "uploads")
    return app.config['UPLOADS_DIR']


def plant_file(uploads_dir, placement, directory, filename, contents):
    folder = os.path.join(uploads_dir, 'files', placement, str(directory))
    os.makedirs(folder, exist_ok=True)
    with open(os.path.join(folder, filename), 'wb') as out:
        out.write(contents)


def require_assignment_grader(*args):
    # controllers.* needs an app context, so import lazily inside the test
    from controllers.helpers import require_assignment_grader as helper
    return helper(*args)


class TestSimilarityAssignmentGate:

    def test_grader_of_other_course_cannot_target_foreign_assignment(self, client, test_data, act_as):
        act_as(test_data.user(CAPTAIN))
        for url in ('/api/check_similarity_simple/100/14', '/api/check_similarity/100/14'):
            data = client.get(url).get_json()
            assert data['success'] is False
            assert 'does not belong to course 14' in data['message']

    def test_non_grader_is_still_rejected_first(self, client, test_data, act_as):
        act_as(test_data.user(LULU))
        data = client.get('/api/check_similarity_simple/100/6').get_json()
        assert data['success'] is False
        assert 'not a grader' in data['message']

    def test_helper_allows_owning_course(self, client, test_data):
        assignment = Assignment.by_id(100)
        assert require_assignment_grader(test_data.user(ADA), assignment, 6) is True

    def test_helper_allows_grader_of_owning_course_from_another_of_their_courses(self, client, test_data):
        assignment = Assignment.by_id(100)
        assert require_assignment_grader(test_data.user(ADA), assignment, 7) is True

    def test_helper_allows_adopting_course_with_submissions(self, client, test_data):
        assignment = Assignment.by_id(100)
        captain = test_data.user(CAPTAIN)
        with pytest.raises(HTTPException):
            require_assignment_grader(captain, assignment, 14)
        # Once course 14 actually uses the assignment, its grader may run the check
        Submission.load_or_new(assignment, captain.id, 14)
        assert require_assignment_grader(captain, assignment, 14) is True

    def test_course_page_rejects_unlisted_assignment(self, client, test_data, act_as):
        act_as(test_data.user(CAPTAIN))
        response = client.post('/courses/check_similar?course_id=14', data={
            "assignment_id": 100}, follow_redirects=True)
        assert response.status_code == 200
        assert b'Not allowed to access assignment: 100' in response.data
        assert b'Started a new similarity check' not in response.data


class TestTaskSubmissionFilter:

    def test_only_gradable_by_drops_other_courses(self, client, test_data):
        assignment = Assignment.by_id(100)
        lulu = test_data.user(LULU)
        captain = test_data.user(CAPTAIN)
        in_six = Submission.load_or_new(assignment, lulu.id, 6)
        in_fourteen = Submission.load_or_new(assignment, lulu.id, 14)
        everything = Submission.all_by_assignment(100)
        assert {s.id for s in everything} >= {in_six.id, in_fourteen.id}
        captain_sees = {s.id for s in Submission.only_gradable_by(everything, captain.id)}
        assert in_fourteen.id in captain_sees
        assert in_six.id not in captain_sees
        ada_sees = {s.id for s in Submission.only_gradable_by(everything, test_data.user(ADA).id)}
        assert in_six.id in ada_sees
        assert in_fourteen.id not in ada_sees

    def test_admin_sees_everything_and_unknown_user_nothing(self, client, test_data):
        assignment = Assignment.by_id(100)
        sub = Submission.load_or_new(assignment, 100, 6)
        everything = Submission.all_by_assignment(100)
        # The fixture data has no site-wide admin (course_id=None), so make one
        from models.role import Role
        from models.enums import UserRoles
        Role.new(UserRoles.ADMIN, user_id=50, course_id=None)
        admin = User.query.get(50)
        assert admin.is_admin()
        assert sub.id in {s.id for s in Submission.only_gradable_by(everything, admin.id)}
        assert Submission.only_gradable_by(everything, 999999) == []


class TestUploadHardening:
    UPLOAD = '/blockpy/upload_file'
    DOWNLOAD = '/blockpy/download_file'
    CSV_BODY = b"a,b" + b"\n" + b"1,2" + b"\n"
    SCRIPT_BODY = b"<script>alert(1)</script>"

    def upload(self, client, directory, filename, body=b"x"):
        return client.post(self.UPLOAD, data={
            "placement": "user", "directory": directory, "filename": filename,
            "contents": (io.BytesIO(body), filename)},
            content_type='multipart/form-data')

    def test_anonymous_cannot_upload(self, client, test_data, uploads_dir):
        # Anonymous visitors get a real user id; they must still not be able to store files.
        client.get('/')
        data = self.upload(client, 1, "x.png").get_json()
        assert data['success'] is False
        assert 'logged in' in data['message']

    def test_html_and_svg_are_rejected(self, client, test_data, act_as, uploads_dir):
        act_as(test_data.user(LULU))
        for filename in ("x.html", "x.svg", "x.HTM", "x.js", "x.xhtml"):
            data = self.upload(client, 100, filename, self.SCRIPT_BODY).get_json()
            assert data['success'] is False, filename
            assert 'cannot be uploaded' in data['message']
        assert not os.path.exists(os.path.join(uploads_dir, 'files', 'user', '100'))

    def test_rename_cannot_produce_html(self, client, test_data, act_as, uploads_dir):
        act_as(test_data.user(LULU))
        plant_file(uploads_dir, 'user', 100, 'ok.txt', b"hello")
        data = client.post('/blockpy/rename_file', data={
            "placement": "user", "directory": 100,
            "old_filename": "ok.txt", "new_filename": "evil.html"}).get_json()
        assert data['success'] is False
        assert os.path.exists(os.path.join(uploads_dir, 'files', 'user', '100', 'ok.txt'))

    def test_allowed_upload_round_trips_as_attachment(self, client, test_data, act_as, uploads_dir):
        act_as(test_data.user(LULU))
        data = self.upload(client, 100, "data.csv", self.CSV_BODY).get_json()
        assert data['success'] is True
        response = client.get(self.DOWNLOAD, query_string={
            "placement": "user", "directory": 100, "filename": "data.csv"})
        assert response.status_code == 200
        assert response.data == self.CSV_BODY
        assert response.headers['Content-Type'] == 'application/octet-stream'
        assert response.headers['Content-Disposition'].startswith('attachment')
        assert response.headers['Content-Security-Policy'] == 'sandbox'

    def test_planted_html_is_never_served_as_a_page(self, client, test_data, uploads_dir):
        # Even a file that reached the disk by other means must not render on the origin.
        plant_file(uploads_dir, 'user', 42, 'x.html', self.SCRIPT_BODY)
        plant_file(uploads_dir, 'user', 42, 'x.svg', b"<svg onload='alert(1)'/>")
        for filename in ("x.html", "x.svg"):
            response = client.get(self.DOWNLOAD, query_string={
                "placement": "user", "directory": 42, "filename": filename})
            assert response.status_code == 200
            assert response.headers['Content-Type'] == 'application/octet-stream'
            assert response.headers['Content-Disposition'].startswith('attachment')
            assert response.headers['Content-Security-Policy'] == 'sandbox'
            assert response.headers['X-Content-Type-Options'] == 'nosniff'

    def test_images_keep_their_type(self, client, test_data, uploads_dir):
        plant_file(uploads_dir, 'user', 42, 'pic.png', bytes([0x89]) + b"PNG")
        response = client.get(self.DOWNLOAD, query_string={
            "placement": "user", "directory": 42, "filename": "pic.png"})
        assert response.headers['Content-Type'] == 'image/png'
        assert response.headers['Content-Security-Policy'] == 'sandbox'

    def test_uploads_are_not_under_the_static_route(self, client, app):
        assert not os.path.abspath(app.config['UPLOADS_DIR']).startswith(
            os.path.abspath(app.static_folder) + os.sep)
        assert not os.path.abspath(app.config['REPORT_DIR']).startswith(
            os.path.abspath(app.static_folder) + os.sep)
