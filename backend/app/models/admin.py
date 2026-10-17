from datetime import datetime

from sqlalchemy import DateTime, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base


class Admin(Base):
    __tablename__ = "admins"

    id:            Mapped[int]        = mapped_column(primary_key=True)
    username:      Mapped[str]        = mapped_column(String(100), unique=True, index=True)
    email:         Mapped[str | None] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str]        = mapped_column(Text)
    created_at:    Mapped[datetime]   = mapped_column(DateTime(timezone=True), server_default=func.now())
