from __future__ import annotations
from datetime import datetime
from sqlalchemy import String, ForeignKey, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column
from app.db.database import Base


class ActivityLog(Base):
    __tablename__ = "activity_logs"

    id:           Mapped[int]          = mapped_column(primary_key=True)
    organizer_id: Mapped[int | None]   = mapped_column(ForeignKey("organizers.id", ondelete="SET NULL"), nullable=True)
    action:       Mapped[str]          = mapped_column(String(100))
    target:       Mapped[str | None]   = mapped_column(String(255))
    created_at:   Mapped[datetime]     = mapped_column(DateTime(timezone=True), server_default=func.now())
