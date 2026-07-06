from __future__ import annotations
from typing import Optional
from pydantic import BaseModel
from datetime import date, time as TimeType


class ConferenceCreate(BaseModel):
    title: str
    description: Optional[str] = None
    date: date
    time: Optional[TimeType] = None
    location: Optional[str] = None


class ConferenceUpdate(ConferenceCreate):
    pass


class ConferencePatch(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    date: Optional[date] = None
    time: Optional[TimeType] = None
    location: Optional[str] = None


