from pydantic import BaseModel, EmailStr
from datetime import datetime


class AttendeeRegister(BaseModel):
    name: str
    email: EmailStr


class AttendeeOut(BaseModel):
    id: int
    conference_id: int
    name: str
    email: str
    registered_at: datetime

    class Config:
        from_attributes = True
