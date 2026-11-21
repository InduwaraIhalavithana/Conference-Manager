from beanie import Document

from app.models.accounts import Admin, Organizer
from app.models.auth import AuthSession, PasswordReset
from app.models.common import ActorRef, LocalizedText
from app.models.conference import Conference
from app.models.messages import ActivityLog, ContactMessage, Feedback, Notification

# Registrations arrive in Phase 3, the full conference aggregate in Phase 2.
DOCUMENT_MODELS: list[type[Document]] = [
    Organizer,
    Admin,
    AuthSession,
    PasswordReset,
    Conference,
    Notification,
    ActivityLog,
    Feedback,
    ContactMessage,
]

__all__ = [
    "DOCUMENT_MODELS",
    "ActivityLog",
    "ActorRef",
    "Admin",
    "AuthSession",
    "Conference",
    "ContactMessage",
    "Feedback",
    "LocalizedText",
    "Notification",
    "Organizer",
    "PasswordReset",
]
