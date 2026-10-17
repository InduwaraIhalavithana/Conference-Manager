from __future__ import annotations

from pydantic import BaseModel, Field


class AdminStats(BaseModel):
    total_organizers: int
    active_organizers: int
    suspended: int
    total_confs: int
    upcoming_confs: int
    total_attendees: int
    waitlisted: int
    checked_in: int
    open_feedback: int
    open_contacts: int


class FeedbackReply(BaseModel):
    reply: str = Field(..., min_length=1, max_length=5000)
