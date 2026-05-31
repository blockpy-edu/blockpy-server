import tempfile
import time

import jwt
from flask import session

from main import create_app


STATIC_SETTINGS = {
    'TESTING': True,
    'HOST': 'localhost',
    'SERVER_NAME': 'localhost',
    'PORT': 5001,
    'SITE_URL': 'localhost:5001',
    'TASK_QUEUE_STYLE': 'sqlite',
    'WTF_CSRF_ENABLED': False,
    'SECRET_KEY': 'test-secret-key',
    'SESSION_COOKIE_DOMAIN': None,
    'SESSION_COOKIE_SECURE': False,
    'COOKIE_SAMESITE': 'Lax',
    'SESSION_COOKIE_HTTPONLY': False,
    'SESSION_COOKIE_SAMESITE': 'Lax',
}


def create_test_app():
    tempdir = tempfile.TemporaryDirectory()
    db_path = f'{tempdir.name}/test.db'
    task_db_path = f'{tempdir.name}/task.db'
    app = create_app('testing', {
        **STATIC_SETTINGS,
        'SQLALCHEMY_DATABASE_URI': f'sqlite:///{db_path}',
        'SQLALCHEMY_DATABASE_URI_ALEMBIC': f'sqlite:///{db_path}',
        'TASK_DB_URI': task_db_path,
    })
    return tempdir, app


def make_claims(claim_message_type, claim_version, claim_deployment_id, claim_roles,
                claim_context, claim_resource_link, claim_launch_presentation,
                claim_custom, claim_ags_endpoint):
    return {
        'iss': 'https://canvas.example.edu',
        'aud': 'client-123',
        'sub': 'user-42',
        'nonce': 'expected-nonce',
        'exp': int(time.time()) + 600,
        claim_message_type: 'LtiResourceLinkRequest',
        claim_version: 'LTI-1p3',
        claim_deployment_id: 'deployment-9',
        claim_roles: ['http://purl.imsglobal.org/vocab/lis/v2/membership#Learner'],
        claim_context: {
            'id': 'course-5',
            'label': 'CS101',
            'title': 'Intro CS',
        },
        claim_resource_link: {
            'id': 'resource-7',
            'title': 'Assignment 1',
        },
        claim_launch_presentation: {
            'return_url': 'https://canvas.example.edu/return',
            'document_target': 'iframe',
        },
        claim_custom: {
            'canvas_course_id': '1234',
        },
        claim_ags_endpoint: {
            'lineitem': 'https://canvas.example.edu/api/lti/courses/5/line_items/7',
            'lineitems': 'https://canvas.example.edu/api/lti/courses/5/line_items',
            'scope': [
                'https://purl.imsglobal.org/spec/lti-ags/scope/score',
                'https://purl.imsglobal.org/spec/lti-ags/scope/result.readonly',
            ]
        },
        'email': 'student@example.edu',
        'name': 'Student Example',
        'given_name': 'Student',
        'family_name': 'Example',
    }


def test_verify_lti13_launch_normalizes_claims(monkeypatch):
    tempdir, app = create_test_app()
    try:
        from controllers.pylti import lti13

        token = jwt.encode(make_claims(
            lti13.CLAIM_MESSAGE_TYPE,
            lti13.CLAIM_VERSION,
            lti13.CLAIM_DEPLOYMENT_ID,
            lti13.CLAIM_ROLES,
            lti13.CLAIM_CONTEXT,
            lti13.CLAIM_RESOURCE_LINK,
            lti13.CLAIM_LAUNCH_PRESENTATION,
            lti13.CLAIM_CUSTOM,
            lti13.CLAIM_AGS_ENDPOINT,
        ), 'shared-secret', algorithm='HS256', headers={'kid': 'kid-1'})
        with app.test_request_context('/', method='POST'):
            session['lti13_state'] = 'expected-state'
            session['lti13_nonce'] = 'expected-nonce'
            monkeypatch.setattr(lti13, '_load_public_key', lambda *args, **kwargs: 'shared-secret')
            launch_data = lti13.verify_lti13_launch([{
                'issuer': 'https://canvas.example.edu',
                'client_id': 'client-123',
                'jwks_url': 'https://canvas.example.edu/jwks',
                'auth_token_url': 'https://canvas.example.edu/token',
                'service': 'canvas',
            }], {'id_token': token, 'state': 'expected-state'}, session)
            assert launch_data['pylti_user_id'] == 'user-42'
            assert launch_data['context_id'] == 'course-5'
            assert launch_data['custom_canvas_course_id'] == '1234'
            course_endpoint = lti13.parse_lti13_endpoint(launch_data['lis_outcome_service_url'])
            submission_endpoint = lti13.parse_lti13_endpoint(launch_data['lis_result_sourcedid'])
            assert course_endpoint['client_id'] == 'client-123'
            assert submission_endpoint['lineitem'].endswith('/7')
            assert 'lti13_state' not in session
            assert 'lti13_nonce' not in session
    finally:
        tempdir.cleanup()


def test_lti_post_grade_uses_ags(monkeypatch):
    tempdir, app = create_test_app()
    try:
        from controllers.pylti.flask import LTI
        from controllers.pylti import lti13

        with app.test_request_context('/', method='POST'):
            session['lis_outcome_service_url'] = ('{"auth_token_url":"https://canvas.example.edu/token",'
                                                  '"client_id":"client-123","deployment_id":"deployment-9",'
                                                  '"issuer":"https://canvas.example.edu","lineitems":"https://canvas.example.edu/api/lti/courses/5/line_items",'
                                                  '"lti_version":"LTI-1p3","scope":["https://purl.imsglobal.org/spec/lti-ags/scope/score"]}')
            session['lis_result_sourcedid'] = ('{"lineitem":"https://canvas.example.edu/api/lti/courses/5/line_items/7",'
                                               '"lineitems":"https://canvas.example.edu/api/lti/courses/5/line_items",'
                                               '"lti_version":"LTI-1p3","resource_link_id":"resource-7","user_id":"user-42"}')
            captured = {}

            def fake_post_ags_score(platforms, course_endpoint, submission_endpoint, score, comment='',
                                    needs_review=False, when_submitted_at=None):
                captured['platforms'] = platforms
                captured['course_endpoint'] = course_endpoint
                captured['submission_endpoint'] = submission_endpoint
                captured['score'] = score
                captured['comment'] = comment
                captured['needs_review'] = needs_review
                captured['when_submitted_at'] = when_submitted_at
                return True

            monkeypatch.setattr('controllers.pylti.flask.post_ags_score', fake_post_ags_score)
            lti = LTI({}, use_session=session, lti13_platforms=[{
                'issuer': 'https://canvas.example.edu',
                'client_id': 'client-123',
                'auth_token_url': 'https://canvas.example.edu/token',
            }])
            assert lti.post_grade(0.75, 'Great work', needs_review=True,
                                  when_submitted_at='2026-05-31T00:00:00Z') is True
            assert captured['score'] == 0.75
            assert captured['comment'] == 'Great work'
            assert captured['needs_review'] is True
            assert captured['submission_endpoint']['user_id'] == 'user-42'
            assert lti13.parse_lti13_endpoint(session['lis_outcome_service_url'])['issuer'] == 'https://canvas.example.edu'
    finally:
        tempdir.cleanup()
