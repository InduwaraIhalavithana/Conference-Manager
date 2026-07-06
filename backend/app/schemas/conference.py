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


