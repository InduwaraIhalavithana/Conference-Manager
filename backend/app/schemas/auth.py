from __future__ import annotations
from pydantic import BaseModel, EmailStr


class RegisterRequest(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    password: str
    phone: str | None = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class AdminLoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class OrganizerOut(BaseModel):
    id: int
    first_name: str
    last_name: str
    email: str
    phone: str | None
    is_suspended: bool

    class Config:
        from_attributes = True
