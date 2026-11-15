from datetime import datetime
from typing import Optional, TYPE_CHECKING
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import Column, String, Integer, ForeignKey, Enum, Index
from sqlalchemy_utc import UtcDateTime

from models.enums import AuthenticationType
from models.generics.models import ma
from models.generics.base import Base
from common.databases import get_enum_values

if TYPE_CHECKING:
    from models import *

# TODO: Make the index a part of the code model

class Authentication(Base):
    """
    Table for handling user authentication from various sources
    """
    __tablename__ = "authentication"

    type: Mapped[AuthenticationType] = mapped_column(Enum(AuthenticationType, values_callable=get_enum_values, native_enum=False), default=AuthenticationType.LOCAL)
    value: Mapped[str] = mapped_column(String(255))
    user_id: Mapped[int] = mapped_column(Integer(), ForeignKey('user.id'))
    expires_at: Mapped[Optional[datetime]] = mapped_column(UtcDateTime(), default=None, nullable=True)
    refresh_token: Mapped[Optional[str]] = mapped_column(String(255), default=None, nullable=True)

    user: Mapped["User"] = relationship(back_populates='authentications')

    __table_args__ = (Index('authentication_user_index', "user_id"),)

    def __str__(self):
        return f'<{self.type} is {self.user_id}>'

    def find_all_linked_resources(self) -> dict[str, list[Base]]:
        """
        Find all the resources linked to this authentication. This is used when
        deleting an authentication to ensure that all the resources are also
        deleted.
        :return: A dictionary of resources linked to this authentication
        """
        return {}
