"""The public contact form: stored for the admin (Phase 5 adds the admin inbox) and announced as a notification."""

from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.models import ActorRef, ContactMessage
from app.repositories import accounts, messages
from app.services import ratelimit
from app.services.auth import validate

CONTACT = ratelimit.Limit("contact", 5, window_seconds=600)
Topic = Literal["general", "attending", "organizing", "technical", "partnership"]


class ContactInput(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: EmailStr
    topic: Topic = "general"
    message: str = Field(min_length=10, max_length=2000)

    @field_validator("name", "message", mode="before")
    @classmethod
    def strip(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value


async def send(ip: str, **data: object) -> None:
    await ratelimit.enforce(CONTACT, ip)
    body = validate(ContactInput, **data)
    await ContactMessage(
        name=body.name, email=str(body.email).lower(), subject=body.topic, message=body.message
    ).insert()
    admins = [ActorRef(type="admin", id=i) for i in await accounts.all_admin_ids()]
    await messages.notify(admins, "contact_message", {"name": body.name, "topic": body.topic}, "/admin/contacts")
