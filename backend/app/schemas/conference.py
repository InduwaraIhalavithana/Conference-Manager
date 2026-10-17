from __future__ import annotations

import datetime as dt
from datetime import time as TimeType
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator, model_validator

from app.models.agenda import SESSION_KINDS
from app.models.conference import CATEGORIES

Status = Literal["published", "draft"]


def _blank_to_none(v):
    if isinstance(v, str):
        v = v.strip()
        return v or None
    return v


class ConferenceCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=5000)
    date: dt.date
    time: Optional[TimeType] = None
    end_time: Optional[TimeType] = None
    location: Optional[str] = Field(None, max_length=255)
    venue_lat: Optional[float] = Field(None, ge=-90, le=90)
    venue_lng: Optional[float] = Field(None, ge=-180, le=180)
    max_attendees: Optional[int] = Field(None, ge=1, le=100000)
    status: Status = "published"
    category: Optional[str] = None

    @field_validator("title", mode="before")
    @classmethod
    def strip_title(cls, v):
        return v.strip() if isinstance(v, str) else v

    @field_validator("description", "location", "category", mode="before")
    @classmethod
    def blanks(cls, v):
        return _blank_to_none(v)

    @field_validator("category")
    @classmethod
    def known_category(cls, v):
        if v is not None and v not in CATEGORIES:
            raise ValueError("unknown category")
        return v

    @model_validator(mode="after")
    def end_after_start(self):
        if self.time and self.end_time and self.end_time <= self.time:
            raise ValueError("end_time must be after time")
        return self


class ConferenceUpdate(ConferenceCreate):
    pass


class ConferencePatch(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=5000)
    # dt.date, not date: a field called `date` would otherwise shadow the type.
    date: Optional[dt.date] = None
    time: Optional[TimeType] = None
    end_time: Optional[TimeType] = None
    location: Optional[str] = Field(None, max_length=255)
    venue_lat: Optional[float] = Field(None, ge=-90, le=90)
    venue_lng: Optional[float] = Field(None, ge=-180, le=180)
    max_attendees: Optional[int] = Field(None, ge=1, le=100000)
    status: Optional[Status] = None
    category: Optional[str] = None

    @field_validator("category")
    @classmethod
    def known_category(cls, v):
        if v is not None and v not in CATEGORIES:
            raise ValueError("unknown category")
        return v


class SpeakerIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=160)
    job_title: Optional[str] = Field(None, max_length=160)
    organization: Optional[str] = Field(None, max_length=160)
    bio: Optional[str] = Field(None, max_length=2000)
    position: int = Field(0, ge=0, le=1000)

    @field_validator("job_title", "organization", "bio", mode="before")
    @classmethod
    def blanks(cls, v):
        return _blank_to_none(v)


class SessionIn(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=2000)
    start_time: TimeType
    end_time: Optional[TimeType] = None
    room: Optional[str] = Field(None, max_length=120)
    kind: str = "talk"
    speaker_id: Optional[int] = None

    @field_validator("description", "room", mode="before")
    @classmethod
    def blanks(cls, v):
        return _blank_to_none(v)

    @field_validator("kind")
    @classmethod
    def known_kind(cls, v):
        if v not in SESSION_KINDS:
            raise ValueError("unknown session kind")
        return v

    @model_validator(mode="after")
    def end_after_start(self):
        if self.end_time and self.end_time <= self.start_time:
            raise ValueError("end_time must be after start_time")
        return self
