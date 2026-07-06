from __future__ import annotations
from datetime import datetime
from sqlalchemy import String, Text, ForeignKey, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column
from app.db.database import Base


class Feedback(Base):
    __tablename__ = "feedback"

    id:           Mapped[int]        = mapped_column(primary_key=True)
    organizer_id: Mapped[int]        = mapped_column(ForeignKey("organizers.id", ondelete="CASCADE"), index=True)
    subject:      Mapped[str]        = mapped_column(String(255))
    message:      Mapped[str]        = mapped_column(Text)
    status:       Mapped[str]        = mapped_column(String(20), default="open")
    reply:        Mapped[str | None] = mapped_column(Text)
    created_at:   Mapped[datetime]   = mapped_column(DateTime(timezone=True), server_default=func.now())
