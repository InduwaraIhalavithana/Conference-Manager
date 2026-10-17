from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator

Lang = Literal["en", "si", "ta"]


def _clean(v: str | None) -> str | None:
    if v is None:
        return None
    v = v.strip()
    return v or None


class RegisterRequest(BaseModel):
    first_name: str = Field(..., min_length=1, max_length=80)
    last_name: str = Field(..., min_length=1, max_length=80)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    phone: str | None = Field(None, max_length=30)
    organization: str | None = Field(None, max_length=160)
    lang: Lang = "en"

    @field_validator("first_name", "last_name", mode="before")
    @classmethod
    def strip_names(cls, v):
        return v.strip() if isinstance(v, str) else v

    @field_validator("phone", "organization", mode="before")
    @classmethod
    def blank_to_none(cls, v):
        return _clean(v)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., max_length=128)


class AdminLoginRequest(BaseModel):
    # An email address; the old "admin" username is still accepted.
    email: str = Field(..., min_length=1, max_length=255)
    password: str = Field(..., max_length=128)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class OrganizerOut(BaseModel):
    id: int
    first_name: str
    last_name: str
    email: str
    phone: str | None
    organization: str | None = None
    bio: str | None = None
    avatar: str | None = None
    lang: str = "en"
    is_suspended: bool
    created_at: datetime | None = None

    class Config:
        from_attributes = True


class AdminOut(BaseModel):
    id: int
    username: str
    email: str | None

    class Config:
        from_attributes = True
