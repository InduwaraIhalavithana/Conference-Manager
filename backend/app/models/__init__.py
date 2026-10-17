"""Import every model so Base.metadata knows all tables (Alembic and the tests rely on this)."""
from app.models import (  # noqa: F401
    activity,
    admin,
    agenda,
    attendee,
    conference,
    contact,
    feedback,
    notification,
    organizer,
    password_reset,
)
