from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base


class Organizer(Base):
    __tablename__ = "organizers"

    id:            Mapped[int]          = mapped_column(primary_key=True)
    first_name:    Mapped[str]          = mapped_column(String(100))
    last_name:     Mapped[str]          = mapped_column(String(100))
    email:         Mapped[str]          = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str]          = mapped_column(Text)
    phone:         Mapped[str | None]   = mapped_column(String(30))
    organization:  Mapped[str | None]   = mapped_column(String(160))
    bio:           Mapped[str | None]   = mapped_column(Text)
    avatar:        Mapped[str | None]   = mapped_column(String(255))
    lang:          Mapped[str]          = mapped_column(String(5), default="en", server_default="en")
    is_suspended:  Mapped[bool]         = mapped_column(Boolean, default=False)
    # Set when the organizer clicks the link in the sign-up email; sign-in is refused until then.
    email_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    verify_token:      Mapped[str | None]      = mapped_column(String(64), unique=True)  # sha256 of the emailed token
    verify_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at:    Mapped[datetime]     = mapped_column(DateTime(timezone=True), server_default=func.now())
