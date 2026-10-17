from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator


def _blank_to_none(v):
    if isinstance(v, str):
        v = v.strip()
        return v or None
    return v


class ProfileUpdate(BaseModel):
    first_name: str = Field(..., min_length=1, max_length=80)
    last_name: str = Field(..., min_length=1, max_length=80)
    phone: str | None = Field(None, max_length=30)
    organization: str | None = Field(None, max_length=160)
    bio: str | None = Field(None, max_length=1000)

    @field_validator("first_name", "last_name", mode="before")
    @classmethod
    def strip_names(cls, v):
        return v.strip() if isinstance(v, str) else v

    @field_validator("phone", "organization", "bio", mode="before")
    @classmethod
    def blanks(cls, v):
        return _blank_to_none(v)


class LanguageUpdate(BaseModel):
    lang: Literal["en", "si", "ta"]


class PasswordChange(BaseModel):
    current_password: str = Field(..., max_length=128)
    new_password: str = Field(..., min_length=8, max_length=128)


class DeleteAccountRequest(BaseModel):
    password: str = Field(..., max_length=128)
