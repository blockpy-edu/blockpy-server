from typing import Optional, cast

from flask import Flask, Request, abort, jsonify, make_response, request, g

from common.maybe import maybe_int, maybe_float, maybe_bool

class SafeRequest(Request):
    """
    Custom request class that overrides the default Flask request to safely
    retrieve parameters, raising correct kinds of errors or safely returning None
    as appropriate.
    """

    def get_maybe_int(self, name: str, default=None) -> Optional[int]:
        return maybe_int(self.values.get(name, default))

    def get_maybe_int_list(self, name: str) -> Optional[list[int]]:
        value = self.values.get(name)
        if isinstance(value, str):
            parts = value.split(',')
            result = []
            for part in parts:
                if not part.strip():
                    continue
                try:
                    result.append(int(part.strip()))
                except ValueError:
                    self.abort_with_error(f"Invalid integer '{part}' in comma-separated integer list value parameter: {name}")
            return result
        elif value is None:
            return None
        self.abort_with_error(f"Invalid comma-separated integer list value for parameter: {name}")

    def get_maybe_float(self, name: str, default=None) -> Optional[float]:
        return maybe_float(self.values.get(name, default))

    def get_maybe_bool(self, name: str, default=None) -> Optional[bool]:
        return maybe_bool(self.values.get(name, default))

    def get_maybe_str(self, name: str, default=None) -> Optional[str]:
        value = self.values.get(name, default)
        return value if isinstance(value, str) else None

    def get_course_id(self, okay_if_failure=False):
        course_id = request.values.get('course_id')
        if course_id is None:
            if 'course' in g:
                return g.course.id
            if not okay_if_failure:
                self.abort_with_error("No course_id given and not logged into a course.")
        course_id = maybe_int(course_id)
        if course_id is None:
            if not okay_if_failure:
                self.abort_with_error("Course ID was not an integer")
        return course_id

    def get_int(self, name: str) -> int:
        value = self.values.get(name)
        if value is None:
            self.abort_with_error(f"Missing required parameter: {name}")
        try:
            return int(value)
        except ValueError:
            self.abort_with_error(f"Invalid integer value for parameter: {name}")
        return 0  # This line is unreachable but keeps the type consistent

    def get_float(self, name: str) -> float:
        value = self.values.get(name)
        if value is None:
            self.abort_with_error(f"Missing required parameter: {name}")
        try:
            return float(value)
        except ValueError:
            self.abort_with_error(f"Invalid float value for parameter: {name}")
            return 0.0 # This line is unreachable but keeps the type consistent

    def get_bool(self, name: str) -> bool:
        value = self.values.get(name)
        if value is None:
            self.abort_with_error(f"Missing required parameter: {name}")
        if isinstance(value, str):
            value = value.lower()
        if value in ['true', '1', 'yes']:
            return True
        elif value in ['false', '0', 'no']:
            return False
        else:
            self.abort_with_error(f"Invalid boolean value for parameter: {name}")
            return False

    def get_str(self, name: str) -> str:
        value = self.values.get(name)
        if value is None:
            self.abort_with_error(f"Missing required parameter: {name}")
        if not isinstance(value, str):
            self.abort_with_error(f"Invalid string value for parameter: {name}")
        return value

    def abort_with_error(self, message: str, status_code: int = 400):
        return abort(make_response(jsonify(success=False, message=message, ip=self.remote_addr), status_code))

    def get_browser_info(self):
        return {
            'platform': self.user_agent.platform,
            'browser': self.user_agent.browser,
            'version': self.user_agent.version,
            'language': self.user_agent.language,
            'user_agent': self.user_agent.string,
            'ip_address': self.remote_addr
        }


class CustomFlask(Flask):
    request_class = SafeRequest


safe_request = cast(SafeRequest, request)