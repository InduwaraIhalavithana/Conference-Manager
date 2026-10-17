from __future__ import annotations

from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, Index, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base


class Notification(Base):
    """In-app notice. The frontend translates `kind` and fills in `params`, so no English is stored."""
    __tablename__ = "notifications"
    __table_args__ = (Index("ix_notifications_recipient", "recipient_type", "recipient_id", "is_read"),)

    id:             Mapped[int]        = mapped_column(primary_key=True)
    recipient_type: Mapped[str]        = mapped_column(String(20))  # organizer or admin
    recipient_id:   Mapped[int]        = mapped_column(Integer)
    kind:           Mapped[str]        = mapped_column(String(50))
    params:         Mapped[dict]       = mapped_column(JSON, default=dict)
    link:           Mapped[str | None] = mapped_column(String(255))
    is_read:        Mapped[bool]       = mapped_column(Boolean, default=False, server_default="false")
    created_at:     Mapped[datetime]   = mapped_column(DateTime(timezone=True), server_default=func.now())
