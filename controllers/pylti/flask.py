# -*- coding: utf-8 -*-
"""
    PyLTI decorator implementation for flask framework
"""
from functools import wraps
import logging
import json

from quart import session as flask_session, current_app, Quart as Flask, g
from quart import request as flask_request

from .common import (
    LTI_SESSION_KEY,
    LTI_PROPERTY_LIST,
    LTI_ROLES,
    verify_request_common,
    post_message,
    post_message2,
    generate_request_xml,
    LTIException,
    LTIRoleException,
    LTINotInSessionException,
    LTIPostMessageException, parse_read_result
)


log = logging.getLogger('pylti.flask')  # pylint: disable=invalid-name


class LTI:
    """
    LTI Object represents abstraction of current LTI session. It provides
    callback methods for LTI launch and LTI outcome service.

    You can also use frozen sessions (created with to_json()), or previously
    created requests (taken from an access token).
    """

    def __init__(self, consumer_data, use_session=False, use_request=False):
        self.consumer_data = consumer_data

        self.use_session = bool(use_session)
        self._internal_session = use_session

        self.use_request = bool(use_request)
        self._internal_request = use_request

    @property
    def session(self):
        """
        Retrieves the global Flask session, or a local mock session object.
        """
        return self._internal_session if self.use_session else flask_session

    @property
    def name(self):  # pylint: disable=no-self-use
        """
        Name returns user's name or user's email or user_id
        :return: best guess of name to use to greet user
        """
        if 'lis_person_sourcedid' in self.session:
            return self.session['lis_person_sourcedid']
        elif 'lis_person_contact_email_primary' in self.session:
            return self.session['lis_person_contact_email_primary']
        elif 'pylti_user_id' in self.session:
            return self.session['pylti_user_id']
        else:
            return ''

    @property
    def user_id(self):  # pylint: disable=no-self-use
        """
        Returns user_id as provided by LTI

        :return: user_id
        """
        return self.session['pylti_user_id']

    def _verify_any(self):
        """
        Verify that request is in session or initial request

        :raises: LTIException
        """
        log.debug('verify_any enter')
        try:
            self._verify_session()
        except LTINotInSessionException:
            self.verify_request()

    def _verify_session(self):
        """
        Verify that session was already created

        :raises: LTIException
        """
        if not self.session.get(LTI_SESSION_KEY, False):
            log.debug('verify_session failed')
            raise LTINotInSessionException('Session expired or unavailable')

    def _consumers(self):
        """
        Gets consumer's map from app config
        :return: consumers map
        """
        return self.consumer_data

    @property
    def key(self):  # pylint: disable=no-self-use
        """
        OAuth Consumer Key
        :return: key
        """
        return self.session['oauth_consumer_key']

    @staticmethod
    def message_identifier_id():
        """
        Message identifier to use for XML callback

        :return: non-empty string
        """
        return "edX_fix"

    @property
    def lis_result_sourcedid(self):  # pylint: disable=no-self-use
        """
        lis_result_sourcedid to use for XML callback

        :return: LTI lis_result_sourcedid
        """
        return self.session['lis_result_sourcedid']

    @property
    def role(self):  # pylint: disable=no-self-use
        """
        LTI roles

        :return: roles
        """
        return self.session.get('roles')

    def is_role(self, role):
        """
        Verify if user is in role

        :param: role: role to verify against
        :return: if user is in role
        :exception: LTIException if role is unknown
        """
        log.debug("is_role %s", role)
        roles = self.session['roles'].split(',')
        if role in LTI_ROLES:
            role_list = LTI_ROLES[role]
            # find the intersection of the roles
            roles = set(role_list) & set(roles)
            is_user_role_there = len(roles) >= 1
            log.debug(
                "is_role roles_list=%s role=%s in list=%s", role_list,
                roles, is_user_role_there
            )
            return is_user_role_there
        else:
            raise LTIException("Unknown role {}.".format(role))


    @property
    def response_url(self):
        """
        Returns remapped lis_outcome_service_url
        uses PYLTI_URL_FIX map to support edX dev-stack

        :return: remapped lis_outcome_service_url
        """
        return self.session['lis_outcome_service_url']

    def verify_request(self):
        """
        Verify LTI request. This is called when an initial
        session is launched.

        :raises: LTIException is request validation failed
        """
        if self.use_request:
            url = self._internal_request['url']
            method = self._internal_request['method']
            headers = json.dumps(self._internal_request['headers'])
            params = json.dumps(self._internal_request['params'])
        else:
            url = flask_request.url
            method = flask_request.method
            headers = flask_request.headers
            if flask_request.method == 'POST':
                params = flask_request.form.to_dict()
            else:
                params = flask_request.args.to_dict()
        log.debug(params)

        log.debug('verify_request?')
        #print(self._consumers(), url, method, headers, params)
        try:
            verify_request_common(self._consumers(), url, method, headers, params)
            log.debug('verify_request success')

            # All good to go, store all of the LTI params into a
            # session dict for use in views
            for prop in LTI_PROPERTY_LIST:
                if params.get(prop, None) is not None:
                    log.debug("params %s=%s", prop, params.get(prop, None))
                    self.session[prop] = params[prop]
            if params.get('user_id', None):
                self.session['pylti_user_id'] = params['user_id']
            
            # Set logged in session key
            self.session[LTI_SESSION_KEY] = True
            return True
        except LTIException as e:
            for prop in LTI_PROPERTY_LIST:
                if self.session.get(prop, None):
                    del self.session[prop]
            if self.session.get('pylti_user_id', None):
                del self.session['pylti_user_id']
            
            self.session[LTI_SESSION_KEY] = False
            raise

    def get_grade(self, endpoint=None):
        message_identifier_id = self.message_identifier_id()
        operation = 'readResult'
        if endpoint is None:
            endpoint = self.lis_result_sourcedid
        xml = generate_request_xml(message_identifier_id, operation, endpoint)
        successful, full_result = post_message(self._consumers(), self.key,
                                        self.response_url, xml)

        if not successful:
            log.error("Post Message Failed")
            raise LTIPostMessageException(f"Post Message Failed for get_grade to {self.response_url} with result: {full_result}")
        return parse_read_result(full_result)

    def post_grade(self, grade, message='', endpoint=None, url=False,
                   needs_review=False, when_submitted_at: str = None,
                   overwrite_human_grades=False):
        """
        Post grade to LTI consumer using XML

        :param: grade: 0 <= grade <= 1
        :return: True if post successful and grade valid
        :exception: LTIPostMessageException if call failed
        """
        message_identifier_id = self.message_identifier_id()
        operation = 'replaceResult'
        if endpoint is None:
            lis_result_sourcedid = self.lis_result_sourcedid
        else:
            lis_result_sourcedid = endpoint
        # # edX devbox fix
        score = float(grade) if grade is not None else None
        if score is None or 0 <= score <= 1.0:
            xml = generate_request_xml(
                message_identifier_id, operation, lis_result_sourcedid,
                score, message, url, needs_review, when_submitted_at=when_submitted_at,
                overwrite_human_grades=overwrite_human_grades)
            successful, full_result = post_message(self._consumers(), self.key,
                                            self.response_url, xml)
            if not successful:
                log.error("Post Message Failed")
                raise LTIPostMessageException(f"Post Message Failed for post_grade to {self.response_url} with result:\n{full_result}")
            return True

        return False

    def post_grade2(self, grade, user=None, comment=''):
        """
        (NOT USED BY BLOCKPY)
        Post grade to LTI consumer using REST/JSON
        URL munging will is related to:
        https://openedx.atlassian.net/browse/PLAT-281

        :param: grade: 0 <= grade <= 1
        :return: True if post successful and grade valid
        :exception: LTIPostMessageException if call failed
        """
        content_type = 'application/vnd.ims.lis.v2.result+json'
        if user is None:
            user = self.user_id
        lti2_url = self.response_url.replace(
            "/grade_handler",
            "/lti_2_0_result_rest_handler/user/{}".format(user))
        score = float(grade)
        if 0 <= score <= 1.0:
            body = json.dumps({
                "@context": "http://purl.imsglobal.org/ctx/lis/v2/Result",
                "@type": "Result",
                "resultScore": score,
                "comment": comment
            })
            ret = post_message2(self._consumers(), self.key, lti2_url, body,
                                method='PUT',
                                content_type=content_type)
            if not ret:
                raise LTIPostMessageException("Post Message Failed")
            return True

        return False

    def close_session(self):
        """
        Invalidates session
        """
        for prop in LTI_PROPERTY_LIST:
            if self.session.get(prop, None):
                del self.session[prop]
        if self.session.get('pylti_user_id', None):
            del self.session['pylti_user_id']
        self.session[LTI_SESSION_KEY] = False

    def to_json(self):
        frozen_session = {}
        for prop in LTI_PROPERTY_LIST:
            if self.session.get(prop, None) is not None:
                frozen_session[prop] = self.session[prop]
        if self.session.get('pylti_user_id', None):
            frozen_session['user_id'] = self.session['pylti_user_id']
        return frozen_session
