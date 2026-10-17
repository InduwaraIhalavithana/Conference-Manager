from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base


class ContactMessage(Base):
    __tablename__ = "contact_messages"

    id:         Mapped[int]      = mapped_column(primary_key=True)
    name:       Mapped[str]      = mapped_column(String(160))
    email:      Mapped[str]      = mapped_column(String(255))
    subject:    Mapped[str]      = mapped_column(String(255))
    message:    Mapped[str]      = mapped_column(Text)
    status:     Mapped[str]      = mapped_column(String(20), default="open", server_default="open")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
