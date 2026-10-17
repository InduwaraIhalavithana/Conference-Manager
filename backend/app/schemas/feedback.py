from __future__ import annotations

from pydantic import BaseModel, EmailStr, Field, field_validator


class FeedbackCreate(BaseModel):
    subject: str = Field(..., min_length=1, max_length=255)
    message: str = Field(..., min_length=1, max_length=5000)

    @field_validator("subject", "message", mode="before")
    @classmethod
    def strip(cls, v):
        return v.strip() if isinstance(v, str) else v


class ContactCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=160)
    email: EmailStr
    subject: str = Field(..., min_length=1, max_length=255)
    message: str = Field(..., min_length=5, max_length=5000)

    @field_validator("name", "subject", "message", mode="before")
    @classmethod
    def strip(cls, v):
        return v.strip() if isinstance(v, str) else v
