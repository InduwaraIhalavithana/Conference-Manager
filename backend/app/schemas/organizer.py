from __future__ import annotations
from pydantic import BaseModel, Field


class ProfileUpdate(BaseModel):
    first_name: str
    last_name: str
    phone: str | None = None


class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8)
