from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base

# Attendee.status values
REGISTERED = "registered"
WAITLISTED = "waitlisted"


class Attendee(Base):
    __tablename__ = "attendees"
    __table_args__ = (UniqueConstraint("conference_id", "email"),)

    id:               Mapped[int]             = mapped_column(primary_key=True)
    conference_id:    Mapped[int]             = mapped_column(ForeignKey("conferences.id", ondelete="CASCADE"), index=True)
    name:             Mapped[str]             = mapped_column(String(200))
    email:            Mapped[str]             = mapped_column(String(255))
    status:           Mapped[str]             = mapped_column(String(20), default=REGISTERED, server_default=REGISTERED, index=True)
    ticket_code:      Mapped[str | None]      = mapped_column(String(16), unique=True, index=True)
    lang:             Mapped[str]             = mapped_column(String(5), default="en", server_default="en")
    checked_in_at:    Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    reminder_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    registered_at:    Mapped[datetime]        = mapped_column(DateTime(timezone=True), server_default=func.now())
    # A registration holds its seat but the ticket only works once the emailed link is clicked.
    confirmed_at:     Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    confirm_token:    Mapped[str | None]      = mapped_column(String(64), unique=True)  # sha256 of the emailed token
