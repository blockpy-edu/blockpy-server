"""
Helper functions related to accessing and manipulating data stored in objects.
"""
import re
from typing import Union, Any, Callable
from sqlalchemy import Table, text

def optional_encoded_field(id_value: int, owning_object: Union[bool, Table],
                           query: Callable, attr: str) -> Any:
    """
    Access data for a model, if it is given, using the given database information if
    available.

    'owner_id__email': optional_encoded_field(self.owner_id, use_owner, models.User.query.get, 'email'),

    :param id_value:
    :param owning_object:
    :param query:
    :param attr:
    :return:
    """
    if owning_object is not False:
        if owning_object is True:
            owning_object = query(id_value)
        if owning_object:
            return getattr(owning_object, attr)
    return ""


def make_copy(url: str) -> str:
    """
    Make a copy of a url. If the url is empty, return "_NO_URL_copy1". If the url
    has a copy number, increment it. Otherwise, add "_copy1" to the end of the url.

    :param url:
    :return:
    """
    if not url:
        return "_NO_URL_copy1"
    ending = re.search(r"(.*)_copy(\d+)$", url)
    if not ending:
        return url+"_copy1"
    else:
        original, iteration = ending.group(1), int(ending.group(2))
        return f"{original}_copy{iteration+1}"

def get_enum_values(enum_class):
    """
    Get the values of the enum class as a list.
    """
    return [member.value for member in enum_class]