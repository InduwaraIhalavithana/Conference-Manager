from beanie import Document

from app.models.accounts import Admin, Organizer
from app.models.auth import AuthSession, PasswordReset
from app.models.common import ActorRef, LocalizedText
from app.models.conference import Conference
from app.models.feedback import SessionRating
from app.models.messages import ActivityLog, ContactMessage, Feedback, Notification
from app.models.question import Question
from app.models.registration import CheckInEvent, Registration

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
    Registration,
    CheckInEvent,
    SessionRating,
    Question,
]

__all__ = [
    "DOCUMENT_MODELS",
    "ActivityLog",
    "CheckInEvent",
    "ActorRef",
    "Admin",
    "AuthSession",
    "Conference",
    "ContactMessage",
    "Feedback",
    "LocalizedText",
    "Notification",
    "Organizer",
    "Question",
    "SessionRating",
    "PasswordReset",
    "Registration",
]
