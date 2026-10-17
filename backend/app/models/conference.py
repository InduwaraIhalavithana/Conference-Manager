from __future__ import annotations

from datetime import date, datetime
from datetime import time as TimeType
from typing import Optional

from sqlalchemy import Date, DateTime, Float, ForeignKey, Integer, String, Text, Time, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base

CATEGORIES = ("Tech", "Health", "Education", "Business", "Science", "Arts", "Other")


class Conference(Base):
    __tablename__ = "conferences"

    id:                Mapped[int]                = mapped_column(primary_key=True)
    organizer_id:      Mapped[int]                = mapped_column(ForeignKey("organizers.id", ondelete="CASCADE"), index=True)
    title:             Mapped[str]                = mapped_column(String(255))
    description:       Mapped[str | None]         = mapped_column(Text)
    date:              Mapped[date]               = mapped_column(Date, index=True)
    time:              Mapped[Optional[TimeType]] = mapped_column(Time)
    end_time:          Mapped[Optional[TimeType]] = mapped_column(Time)
    location:          Mapped[str | None]         = mapped_column(String(255))
    venue_lat:         Mapped[float | None]       = mapped_column(Float)
    venue_lng:         Mapped[float | None]       = mapped_column(Float)
    max_attendees:     Mapped[int | None]         = mapped_column(Integer)
    status:            Mapped[str]                = mapped_column(String(20), server_default="published")
    category:          Mapped[str | None]         = mapped_column(String(80))
    cover_image:       Mapped[str | None]         = mapped_column(String(255))
    reminders_sent_at: Mapped[datetime | None]    = mapped_column(DateTime(timezone=True))
    created_at:        Mapped[datetime]           = mapped_column(DateTime(timezone=True), server_default=func.now())
