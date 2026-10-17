"""
Regression tests for the non-security bugs found during the third audit:
- SafeRequest.get_course_id no longer raises when g.course is None (logged-in non-LTI users)
- course visibility strings are parsed, so /courses/add and change_course_visibility apply them
- strip_tags works (its parser skipped the HTMLParser constructor), so /assignments/get answers
- the broken, unused blockpy.fork_assignment route is gone (assignments/fork is the real one)
"""
from models.assignment import Assignment
from models.course import Course
from models.enums import CourseVisibility

ADA = "ada@blockpy.com"
LULU = "lulu@blockpy.com"


class TestGetCourseIdWithoutLti:

    def test_load_assignment_without_course_id(self, client, test_data, act_as):
        act_as(test_data.user(LULU))
        response = client.get('/blockpy/load_assignment', query_string={'assignment_id': 100})
        assert response.status_code == 200
        data = response.get_json()
        assert data['success'] is True and data['submission'] is None

    def test_required_course_id_is_a_clean_400(self, client, test_data, act_as):
        act_as(test_data.user(LULU))
        response = client.post('/blockpy/save_file', data={'filename': 'answer.py', 'submission_id': 1, 'code': ''})
        assert response.status_code == 400
        assert response.get_json()['success'] is False


class TestCourseVisibility:

    def test_parse(self):
        assert CourseVisibility.parse('Public') == CourseVisibility.PUBLIC
        assert CourseVisibility.parse(' archived ') == CourseVisibility.ARCHIVED
        assert CourseVisibility.parse('bogus') is None
        assert CourseVisibility.parse(None) is None

    def test_add_course_keeps_requested_visibility(self, client, test_data, act_as):
        act_as(test_data.user(ADA))
        response = client.post('/courses/add', data={'name': 'Open course', 'visibility': 'public',
                                                     'term': 'Fall', 'url': 'open_course_x'})
        assert response.status_code == 302
        assert Course.by_url('open_course_x').visibility == CourseVisibility.PUBLIC

    def test_add_course_unknown_visibility_falls_back_to_private(self, client, test_data):
        course = Course.new(name='x', owner_id=10, visibility='nonsense', term='', url='odd_course_x')
        assert course.visibility == CourseVisibility.PRIVATE

    def test_change_course_visibility_applies(self, client, test_data, act_as):
        act_as(test_data.user(ADA))
        assert Course.by_id(6).visibility == CourseVisibility.PUBLIC
        response = client.post('/courses/change_course_visibility', data={'course_id': 6, 'visibility': 'archived'})
        assert response.status_code == 302
        assert Course.by_id(6).visibility == CourseVisibility.ARCHIVED

    def test_change_course_visibility_rejects_unknown(self, client, test_data, act_as):
        act_as(test_data.user(ADA))
        client.post('/courses/change_course_visibility', data={'course_id': 6, 'visibility': 'bogus'})
        assert Course.by_id(6).visibility == CourseVisibility.PUBLIC


class TestStripTags:

    def test_strip_tags(self):
        from common.highlighters import strip_tags
        assert strip_tags("<p>hi <b>there</b> &amp; bye</p>") == "hi there & bye"
        assert strip_tags("") == ""

    def test_quiz_analysis_shares_the_helper(self):
        from common.highlighters import strip_tags
        from models.data_formats import quiz_analysis
        assert quiz_analysis.strip_tags is strip_tags

    def test_get_assignment_answers(self, client, test_data, act_as):
        Assignment.by_id(100).edit({'instructions': '<p>Write <em>code</em></p>'})
        act_as(test_data.user(ADA))
        response = client.post('/assignments/get', data={'assignment_id': 100})
        assert response.status_code == 200
        assert response.get_json()['instructions'] == 'Write code'


class TestForkAssignmentRouteRemoved:

    def test_route_is_gone(self, client, app):
        assert 'blockpy.fork_assignment' not in app.view_functions
        response = client.post('/blockpy/fork_assignment', data={'assignment_id': 100, 'course_id': 6})
        assert response.status_code == 404

    def test_editor_pages_still_render(self, client, test_data, act_as):
        act_as(test_data.user(LULU))
        response = client.get('/assignments/load', query_string={'assignment_id': 100, 'course_id': 6})
        assert response.status_code == 200
        assert b'forkAssignment' not in response.data
