from __future__ import annotations
from datetime import datetime
from sqlalchemy import String, Boolean, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column
from app.db.database import Base


class Organizer(Base):
    __tablename__ = "organizers"

    id:            Mapped[int]          = mapped_column(primary_key=True)
    first_name:    Mapped[str]          = mapped_column(String(80))
    last_name:     Mapped[str]          = mapped_column(String(80))
    email:         Mapped[str]          = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str]          = mapped_column(String(255))
    phone:         Mapped[str | None]   = mapped_column(String(30))
    is_suspended:  Mapped[bool]         = mapped_column(Boolean, default=False)
    created_at:    Mapped[datetime]     = mapped_column(DateTime(timezone=True), server_default=func.now())
