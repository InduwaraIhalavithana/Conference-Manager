from __future__ import annotations
from typing import Optional
from pydantic import BaseModel
from datetime import date, time as TimeType, datetime


class ConferenceCreate(BaseModel):
    title: str
    description: Optional[str] = None
    date: date
    time: Optional[TimeType] = None
    location: Optional[str] = None


class ConferenceUpdate(ConferenceCreate):
    pass


class ConferenceOut(BaseModel):
    id: int
    organizer_id: int
    title: str
    description: Optional[str] = None
    date: date
    time: Optional[TimeType] = None
    location: Optional[str] = None
    created_at: datetime
    organizer_name: Optional[str] = None
    attendee_count: int = 0

    class Config:
        from_attributes = True
