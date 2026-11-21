"""Outgoing email, behind a small interface (Strategy pattern).

Phase 1 ships two senders: ``LogEmailSender`` (local development: the message, including any code, is only
written to the API log) and ``MemoryEmailSender`` (tests read the outbox). Phase 3 adds a Gmail SMTP sender
that runs in the ARQ worker with retries.
"""

from dataclasses import dataclass, field
from typing import Any, Protocol

from app.core.logging import get_logger
from app.models.common import Lang

log = get_logger("email")


@dataclass(frozen=True)
class EmailMessage:
    to: str
    kind: str  # e.g. "verify_code", "password_reset"; the template is chosen from this in Phase 3
    lang: Lang
    params: dict[str, Any] = field(default_factory=dict)


class EmailSender(Protocol):
    async def send(self, message: EmailMessage) -> None: ...


class LogEmailSender:
    async def send(self, message: EmailMessage) -> None:
        log.warning("email not sent (no mail server configured)", to=message.to, kind=message.kind, **message.params)


class MemoryEmailSender:
    def __init__(self) -> None:
        self.outbox: list[EmailMessage] = []

    async def send(self, message: EmailMessage) -> None:
        self.outbox.append(message)

    def last_to(self, to: str, kind: str | None = None) -> EmailMessage:
        for message in reversed(self.outbox):
            if message.to == to and (kind is None or message.kind == kind):
                return message
        raise LookupError(f"no email to {to}")


_sender: EmailSender = LogEmailSender()


def use_sender(sender: EmailSender) -> None:
    global _sender
    _sender = sender


async def send(message: EmailMessage) -> None:
    await _sender.send(message)
