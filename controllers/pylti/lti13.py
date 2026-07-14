import base64
import json
import logging
import os
import time
import urllib.parse
import urllib.request
import uuid

import jwt

from .common import LTIException, LTIPostMessageException

log = logging.getLogger('pylti.lti13')  # pylint: disable=invalid-name

CLAIM_MESSAGE_TYPE = 'https://purl.imsglobal.org/spec/lti/claim/message_type'
CLAIM_VERSION = 'https://purl.imsglobal.org/spec/lti/claim/version'
CLAIM_DEPLOYMENT_ID = 'https://purl.imsglobal.org/spec/lti/claim/deployment_id'
CLAIM_TARGET_LINK_URI = 'https://purl.imsglobal.org/spec/lti/claim/target_link_uri'
CLAIM_RESOURCE_LINK = 'https://purl.imsglobal.org/spec/lti/claim/resource_link'
CLAIM_CONTEXT = 'https://purl.imsglobal.org/spec/lti/claim/context'
CLAIM_ROLES = 'https://purl.imsglobal.org/spec/lti/claim/roles'
CLAIM_LAUNCH_PRESENTATION = 'https://purl.imsglobal.org/spec/lti/claim/launch_presentation'
CLAIM_CUSTOM = 'https://purl.imsglobal.org/spec/lti/claim/custom'
CLAIM_TOOL_PLATFORM = 'https://purl.imsglobal.org/spec/lti/claim/tool_platform'
CLAIM_AGS_ENDPOINT = 'https://purl.imsglobal.org/spec/lti-ags/claim/endpoint'

LTI13_VERSION = 'LTI-1p3'
RESULT_READ_SCOPE = 'https://purl.imsglobal.org/spec/lti-ags/scope/result.readonly'
SCORE_SCOPE = 'https://purl.imsglobal.org/spec/lti-ags/scope/score'
LINEITEM_SCOPE = 'https://purl.imsglobal.org/spec/lti-ags/scope/lineitem'


def _as_list(value):
    if value is None:
        return []
    if isinstance(value, list):
        return value
    if isinstance(value, tuple):
        return list(value)
    return [value]


def normalize_platforms(platforms):
    if not platforms:
        return []
    if isinstance(platforms, dict):
        if 'issuer' in platforms:
            return [platforms]
        return [dict(config, platform_key=key) for key, config in platforms.items()]
    return list(platforms)


def find_platform(platforms, issuer, client_id=None, deployment_id=None):
    for platform in normalize_platforms(platforms):
        if platform.get('issuer') != issuer:
            continue
        configured_client_id = str(platform.get('client_id', ''))
        if client_id is not None and configured_client_id and configured_client_id != str(client_id):
            continue
        deployment_ids = _as_list(platform.get('deployment_ids') or platform.get('deployment_id'))
        if deployment_id is not None and deployment_ids and deployment_id not in deployment_ids:
            continue
        return platform
    return None


def is_lti13_launch(params):
    return bool(params.get('id_token'))


def is_lti13_login_initiation(params):
    return (not params.get('id_token')
            and bool(params.get('iss'))
            and bool(params.get('login_hint'))
            and bool(params.get('target_link_uri')))


def build_login_redirect_url(platform, params, state, nonce):
    auth_login_url = platform.get('auth_login_url') or platform.get('authorization_endpoint')
    if not auth_login_url:
        raise LTIException('Missing LTI 1.3 authorization endpoint configuration.')
    client_id = platform.get('client_id')
    if not client_id:
        raise LTIException('Missing LTI 1.3 client_id configuration.')
    query = {
        'scope': 'openid',
        'response_type': 'id_token',
        'response_mode': 'form_post',
        'prompt': 'none',
        'client_id': client_id,
        'redirect_uri': params['target_link_uri'],
        'login_hint': params['login_hint'],
        'state': state,
        'nonce': nonce,
    }
    if params.get('lti_message_hint'):
        query['lti_message_hint'] = params['lti_message_hint']
    if params.get('lti_deployment_id'):
        query['lti_deployment_id'] = params['lti_deployment_id']
    return auth_login_url + ('&' if '?' in auth_login_url else '?') + urllib.parse.urlencode(query)


def fetch_json(url, headers=None):
    request = urllib.request.Request(url, headers=headers or {})
    with urllib.request.urlopen(request) as response:
        return json.loads(response.read().decode('utf-8'))


def request_json(url, method='GET', data=None, headers=None):
    payload = None
    if data is not None:
        if isinstance(data, (bytes, bytearray)):
            payload = data
        else:
            payload = json.dumps(data).encode('utf-8')
    request_headers = dict(headers or {})
    if payload is not None and 'Content-Type' not in request_headers:
        request_headers['Content-Type'] = 'application/json'
    request = urllib.request.Request(url, data=payload, headers=request_headers, method=method)
    with urllib.request.urlopen(request) as response:
        body = response.read().decode('utf-8')
        if not body:
            return response.status, None
        return response.status, json.loads(body)


def post_form(url, data, headers=None):
    payload = urllib.parse.urlencode(data).encode('utf-8')
    request_headers = {'Content-Type': 'application/x-www-form-urlencoded'}
    request_headers.update(headers or {})
    request = urllib.request.Request(url, data=payload, headers=request_headers, method='POST')
    with urllib.request.urlopen(request) as response:
        body = response.read().decode('utf-8')
        return response.status, json.loads(body)


def _load_public_key(jwks_url, kid=None):
    if not jwks_url:
        raise LTIException('Missing LTI 1.3 JWKS configuration.')
    keyset = fetch_json(jwks_url)
    keys = keyset.get('keys', [])
    if kid is not None:
        keys = [key for key in keys if key.get('kid') == kid]
    if len(keys) != 1:
        raise LTIException('Unable to identify LTI 1.3 signing key.')
    return jwt.algorithms.RSAAlgorithm.from_jwk(json.dumps(keys[0]))


def _decode_unverified_claims(token):
    return jwt.decode(token, options={"verify_signature": False, "verify_aud": False})


def parse_lti13_endpoint(endpoint):
    if not endpoint or not isinstance(endpoint, str):
        return None
    endpoint = endpoint.strip()
    if not endpoint.startswith('{'):
        return None
    try:
        data = json.loads(endpoint)
    except json.JSONDecodeError:
        return None
    if data.get('lti_version') != LTI13_VERSION:
        return None
    return data


def serialize_course_endpoint(platform, claims):
    ags = claims.get(CLAIM_AGS_ENDPOINT, {})
    return json.dumps({
        'lti_version': LTI13_VERSION,
        'issuer': claims.get('iss', ''),
        'client_id': str(platform.get('client_id', '')),
        'deployment_id': claims.get(CLAIM_DEPLOYMENT_ID, ''),
        'auth_token_url': platform.get('auth_token_url') or platform.get('token_url') or '',
        'lineitems': ags.get('lineitems', ''),
        'scope': ags.get('scope', []) or [],
    }, sort_keys=True)


def serialize_submission_endpoint(claims):
    ags = claims.get(CLAIM_AGS_ENDPOINT, {})
    resource_link = claims.get(CLAIM_RESOURCE_LINK, {})
    return json.dumps({
        'lti_version': LTI13_VERSION,
        'lineitem': ags.get('lineitem', ''),
        'lineitems': ags.get('lineitems', ''),
        'resource_link_id': resource_link.get('id', ''),
        'user_id': claims.get('sub', ''),
    }, sort_keys=True)


def normalize_launch_claims(claims, platform):
    context = claims.get(CLAIM_CONTEXT, {})
    resource_link = claims.get(CLAIM_RESOURCE_LINK, {})
    launch_presentation = claims.get(CLAIM_LAUNCH_PRESENTATION, {})
    tool_platform = claims.get(CLAIM_TOOL_PLATFORM, {})
    roles = claims.get(CLAIM_ROLES, []) or []
    custom = claims.get(CLAIM_CUSTOM, {}) or {}
    user_id = claims.get('sub', '')
    launch_data = {
        'oauth_consumer_key': str(platform.get('client_id', '')),
        'user_id': user_id,
        'pylti_user_id': user_id,
        'roles': ','.join(roles),
        'lti_version': claims.get(CLAIM_VERSION, LTI13_VERSION),
        'lti_message_type': claims.get(CLAIM_MESSAGE_TYPE, ''),
        'launch_presentation_return_url': launch_presentation.get('return_url', ''),
        'launch_presentation_document_target': launch_presentation.get('document_target', ''),
        'launch_presentation_width': str(launch_presentation.get('width', '')),
        'launch_presentation_height': str(launch_presentation.get('height', '')),
        'context_id': context.get('id', ''),
        'context_label': context.get('label', ''),
        'context_title': context.get('title', ''),
        'resource_link_id': resource_link.get('id', ''),
        'resource_link_title': resource_link.get('title', ''),
        'lis_person_contact_email_primary': claims.get('email', ''),
        'lis_person_contact_emailprimary': claims.get('email', ''),
        'lis_person_name_full': claims.get('name', ''),
        'lis_person_name_family': claims.get('family_name', ''),
        'lis_person_name_given': claims.get('given_name', ''),
        'lis_person_sourcedid': user_id,
        'lti_issuer': claims.get('iss', ''),
        'lti_client_id': str(platform.get('client_id', '')),
        'lti_deployment_id': claims.get(CLAIM_DEPLOYMENT_ID, ''),
        'lti_target_link_uri': claims.get(CLAIM_TARGET_LINK_URI, ''),
        'lti_tool_platform_guid': tool_platform.get('guid', ''),
        'lti_launch_claims': json.dumps(claims, sort_keys=True),
        'lti_service': platform.get('service', 'canvas'),
    }
    if claims.get(CLAIM_AGS_ENDPOINT):
        launch_data['lis_outcome_service_url'] = serialize_course_endpoint(platform, claims)
        launch_data['lis_result_sourcedid'] = serialize_submission_endpoint(claims)
    for key, value in custom.items():
        custom_key = key if key.startswith('custom_') else f'custom_{key}'
        if isinstance(value, (dict, list)):
            value = json.dumps(value, sort_keys=True)
        launch_data[custom_key] = str(value)
    return launch_data


def verify_lti13_launch(platforms, params, session):
    if 'id_token' not in params:
        raise LTIException('Missing id_token in LTI 1.3 launch.')
    unverified_claims = _decode_unverified_claims(params['id_token'])
    deployment_id = unverified_claims.get(CLAIM_DEPLOYMENT_ID)
    audience = unverified_claims.get('aud')
    audience_options = audience if isinstance(audience, list) else [audience]
    platform = None
    for audience_option in audience_options:
        platform = find_platform(platforms, unverified_claims.get('iss'), audience_option, deployment_id)
        if platform is not None:
            break
    if platform is None and unverified_claims.get('azp'):
        platform = find_platform(platforms, unverified_claims.get('iss'),
                                 unverified_claims.get('azp'), deployment_id)
    if platform is None:
        raise LTIException('Unknown LTI 1.3 platform configuration.')
    expected_state = session.get('lti13_state')
    if expected_state and params.get('state') != expected_state:
        raise LTIException('LTI 1.3 state mismatch.')
    unverified_header = jwt.get_unverified_header(params['id_token'])
    signing_key = _load_public_key(platform.get('jwks_url') or platform.get('key_set_url'),
                                   kid=unverified_header.get('kid'))
    claims = jwt.decode(
        params['id_token'],
        key=signing_key,
        algorithms=[unverified_header.get('alg', 'RS256')],
        audience=str(platform.get('client_id')),
        issuer=platform.get('issuer'),
    )
    expected_nonce = session.get('lti13_nonce')
    if expected_nonce and claims.get('nonce') != expected_nonce:
        raise LTIException('LTI 1.3 nonce mismatch.')
    message_type = claims.get(CLAIM_MESSAGE_TYPE)
    if not message_type:
        raise LTIException('Missing LTI 1.3 message_type claim.')
    session.pop('lti13_nonce', None)
    session.pop('lti13_state', None)
    return normalize_launch_claims(claims, platform)


def _load_private_key(platform):
    if platform.get('private_key'):
        return platform['private_key']
    private_key_file = platform.get('private_key_file')
    if private_key_file:
        with open(os.path.expanduser(private_key_file), 'r', encoding='utf-8') as private_key:
            return private_key.read()
    raise LTIPostMessageException('Missing LTI 1.3 private key configuration.')


def _get_access_token(platforms, course_endpoint):
    platform = find_platform(
        platforms,
        course_endpoint.get('issuer'),
        course_endpoint.get('client_id'),
        course_endpoint.get('deployment_id')
    )
    if platform is None:
        raise LTIPostMessageException('Unknown LTI 1.3 platform for AGS request.')
    token_url = course_endpoint.get('auth_token_url') or platform.get('auth_token_url') or platform.get('token_url')
    if not token_url:
        raise LTIPostMessageException('Missing LTI 1.3 token URL configuration.')
    scopes = course_endpoint.get('scope', []) or []
    scope_string = ' '.join(scopes)
    if platform.get('client_secret'):
        credentials = f"{platform['client_id']}:{platform['client_secret']}".encode('utf-8')
        headers = {
            'Authorization': 'Basic ' + base64.b64encode(credentials).decode('ascii')
        }
        _, body = post_form(token_url, {
            'grant_type': 'client_credentials',
            'scope': scope_string,
        }, headers=headers)
    else:
        now = int(time.time())
        assertion = jwt.encode({
            'iss': str(platform['client_id']),
            'sub': str(platform['client_id']),
            'aud': token_url,
            'iat': now,
            'exp': now + 300,
            'jti': str(uuid.uuid4()),
        }, _load_private_key(platform), algorithm=platform.get('algorithm', 'RS256'),
            headers={'kid': platform.get('kid')} if platform.get('kid') else None)
        _, body = post_form(token_url, {
            'grant_type': 'client_credentials',
            'scope': scope_string,
            'client_assertion_type': 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer',
            'client_assertion': assertion,
        })
    access_token = body.get('access_token')
    if not access_token:
        raise LTIPostMessageException('Failed to obtain LTI 1.3 AGS access token.')
    return access_token, scopes


def read_ags_result(platforms, course_endpoint, submission_endpoint):
    if RESULT_READ_SCOPE not in (course_endpoint.get('scope', []) or []):
        return None
    lineitem_url = submission_endpoint.get('lineitem')
    if not lineitem_url:
        return None
    access_token, _ = _get_access_token(platforms, course_endpoint)
    status, body = request_json(
        f"{lineitem_url.rstrip('/')}/results?{urllib.parse.urlencode({'user_id': submission_endpoint.get('user_id', '')})}",
        headers={'Authorization': 'Bearer ' + access_token}
    )
    if status != 200 or not body:
        return None
    first_result = body[0] if isinstance(body, list) and body else None
    if first_result is None:
        return None
    return first_result.get('resultScore')


def post_ags_score(platforms, course_endpoint, submission_endpoint, score, comment='', needs_review=False,
                   when_submitted_at=None):
    lineitem_url = submission_endpoint.get('lineitem')
    if not lineitem_url:
        raise LTIPostMessageException('Missing LTI 1.3 AGS lineitem URL for grade passback.')
    access_token, scopes = _get_access_token(platforms, course_endpoint)
    if SCORE_SCOPE not in scopes:
        raise LTIPostMessageException('LTI 1.3 AGS score scope is not available for this launch.')
    body = {
        'timestamp': when_submitted_at or time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
        'scoreGiven': score,
        'scoreMaximum': 1,
        'activityProgress': 'Completed',
        'gradingProgress': 'PendingManual' if needs_review else 'FullyGraded',
        'userId': submission_endpoint.get('user_id', ''),
    }
    if comment:
        body['comment'] = comment
    status, response_body = request_json(
        f"{lineitem_url.rstrip('/')}/scores",
        method='POST',
        data=body,
        headers={
            'Authorization': 'Bearer ' + access_token,
            'Accept': 'application/vnd.ims.lis.v1.score+json',
            'Content-Type': 'application/vnd.ims.lis.v1.score+json',
        }
    )
    log.debug("AGS post score response %s %s", status, response_body)
    if status not in (200, 201, 202):
        raise LTIPostMessageException('LTI 1.3 AGS score post failed.')
    return True
