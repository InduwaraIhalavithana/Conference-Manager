from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator


class AttendeeRegister(BaseModel):
    name: str = Field(..., min_length=1, max_length=160)
    email: EmailStr
    lang: Literal["en", "si", "ta"] = "en"

    @field_validator("name", mode="before")
    @classmethod
    def strip_name(cls, v):
        return v.strip() if isinstance(v, str) else v


class CheckInRequest(BaseModel):
    code: str = Field(..., min_length=4, max_length=300)


class ConfirmRequest(BaseModel):
    code: str = Field(..., min_length=6, max_length=12)


class ConfirmByEmailRequest(ConfirmRequest):
    email: EmailStr


class AttendeeOut(BaseModel):
    id: int
    conference_id: int
    name: str
    email: str
    status: str
    ticket_code: str | None
    checked_in_at: datetime | None
    registered_at: datetime
    confirmed_at: datetime | None = None
    hold_expires_at: datetime | None = None
    waitlist_position: int | None = None

    class Config:
        from_attributes = True
