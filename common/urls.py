import re
import os
from urllib.parse import quote as url_quote
from urllib.parse import unquote_plus, urlparse, parse_qsl, quote_plus, urlencode


def normalize_url(url):
    url = re.sub(r'http://', r'', url)
    url = re.sub(r'https://', r'', url)
    url = re.sub(r'file://', r'', url)
    parts = urlparse(url, scheme='')
    _query = urlencode(sorted(set(parse_qsl(parts.query))))
    _path = unquote_plus(parts.path)
    parts = parts._replace(query=_query, path=_path, scheme='', fragment='')
    url = "/".join((parts.netloc, _path, _query))
    return quote_plus(url)

def append_parameters(url: str, **parameters) -> str:
    if not parameters:
        return url
    url_parts = list(urlparse(url))
    query = dict(parse_qsl(url_parts[4]))
    query.update(parameters)
    url_parts[4] = urlencode(query)
    return urlparse(url)._replace(query=urlencode(query)).geturl()
