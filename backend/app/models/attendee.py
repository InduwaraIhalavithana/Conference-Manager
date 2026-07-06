from datetime import datetime
from sqlalchemy import String, ForeignKey, DateTime, func, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from app.db.database import Base


class Attendee(Base):
    __tablename__ = "attendees"
    __table_args__ = (UniqueConstraint("conference_id", "email"),)

    id:            Mapped[int]      = mapped_column(primary_key=True)
    conference_id: Mapped[int]      = mapped_column(ForeignKey("conferences.id", ondelete="CASCADE"), index=True)
    name:          Mapped[str]      = mapped_column(String(160))
    email:         Mapped[str]      = mapped_column(String(255))
    registered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
