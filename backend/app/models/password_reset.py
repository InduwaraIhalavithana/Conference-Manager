from __future__ import annotations
from datetime import datetime
from sqlalchemy import String, Integer, ForeignKey, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from app.db.database import Base


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id:           Mapped[int]      = mapped_column(primary_key=True)
    organizer_id: Mapped[int]      = mapped_column(ForeignKey("organizers.id", ondelete="CASCADE"))
    token:        Mapped[str]      = mapped_column(String(128), unique=True)
    expires_at:   Mapped[datetime] = mapped_column(DateTime(timezone=True))
