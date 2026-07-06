from __future__ import annotations
from pydantic import BaseModel


class FeedbackCreate(BaseModel):
    subject: str
    message: str
