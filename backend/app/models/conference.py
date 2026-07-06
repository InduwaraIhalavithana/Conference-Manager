from __future__ import annotations
from typing import Optional
from datetime import date, time as TimeType, datetime
from sqlalchemy import String, Text, Date, Time, ForeignKey, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column
from app.db.database import Base


class Conference(Base):
    __tablename__ = "conferences"

    id:           Mapped[int]          = mapped_column(primary_key=True)
    organizer_id: Mapped[int]          = mapped_column(ForeignKey("organizers.id", ondelete="CASCADE"), index=True)
    title:        Mapped[str]          = mapped_column(String(255))
    description:  Mapped[str | None]   = mapped_column(Text)
    date:         Mapped[date]         = mapped_column(Date)
    time:         Mapped[Optional[TimeType]]  = mapped_column(Time)
    location:     Mapped[str | None]   = mapped_column(String(255))
    created_at:   Mapped[datetime]     = mapped_column(DateTime(timezone=True), server_default=func.now())
