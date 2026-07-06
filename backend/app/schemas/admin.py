from __future__ import annotations
from pydantic import BaseModel
from datetime import datetime


class AdminStats(BaseModel):
    total_organizers: int
    active_organizers: int
    suspended: int
    total_confs: int
    upcoming_confs: int
    total_attendees: int
    open_feedback: int


class ActivityOut(BaseModel):
    id: int
    organizer_id: int | None
    organizer_name: str | None
    action: str
    target: str | None
    created_at: datetime

    class Config:
        from_attributes = True


class FeedbackReply(BaseModel):
    reply: str
