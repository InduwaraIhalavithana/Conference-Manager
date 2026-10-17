from __future__ import annotations

from datetime import time as TimeType

from sqlalchemy import ForeignKey, Integer, String, Text, Time
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base

SESSION_KINDS = ("talk", "workshop", "panel", "keynote", "break")


class Speaker(Base):
    __tablename__ = "speakers"

    id:            Mapped[int]        = mapped_column(primary_key=True)
    conference_id: Mapped[int]        = mapped_column(ForeignKey("conferences.id", ondelete="CASCADE"), index=True)
    name:          Mapped[str]        = mapped_column(String(160))
    job_title:     Mapped[str | None] = mapped_column(String(160))
    organization:  Mapped[str | None] = mapped_column(String(160))
    bio:           Mapped[str | None] = mapped_column(Text)
    photo:         Mapped[str | None] = mapped_column(String(255))
    position:      Mapped[int]        = mapped_column(Integer, default=0, server_default="0")


class Session(Base):
    __tablename__ = "sessions"

    id:            Mapped[int]             = mapped_column(primary_key=True)
    conference_id: Mapped[int]             = mapped_column(ForeignKey("conferences.id", ondelete="CASCADE"), index=True)
    speaker_id:    Mapped[int | None]      = mapped_column(ForeignKey("speakers.id", ondelete="SET NULL"))
    title:         Mapped[str]             = mapped_column(String(255))
    description:   Mapped[str | None]      = mapped_column(Text)
    start_time:    Mapped[TimeType]        = mapped_column(Time)
    end_time:      Mapped[TimeType | None] = mapped_column(Time)
    room:          Mapped[str | None]      = mapped_column(String(120))
    kind:          Mapped[str]             = mapped_column(String(20), default="talk", server_default="talk")
