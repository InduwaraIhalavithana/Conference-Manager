from __future__ import annotations
from pydantic import BaseModel


class AdminStats(BaseModel):
    total_organizers: int
    active_organizers: int
    suspended: int
    total_confs: int
    upcoming_confs: int
    total_attendees: int
    open_feedback: int


class FeedbackReply(BaseModel):
    reply: str
