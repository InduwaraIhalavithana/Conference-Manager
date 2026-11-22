"""Outgoing email, in two steps (Strategy pattern for both):

1. ``send()`` is what the rest of the app calls. In production it **queues** the message in Redis
   (``QueueEmailSender``) and returns at once, so a slow mail server never slows a request down.
2. The ARQ worker runs the ``send_email`` job, which calls ``deliver()``: the message is rendered in the
   reader's language and sent through Gmail SMTP (``SmtpEmailSender``), with retries.

Without a mail server configured, ``LogEmailSender`` writes the message (including any code) to the log,
which is how local development works. Tests use ``MemoryEmailSender`` and read its outbox.
Addresses in EMAIL_BLOCKED_DOMAINS (demo and example domains) are never emailed.
"""

import dataclasses
from dataclasses import dataclass, field
from datetime import date
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formatdate, make_msgid
from pathlib import Path
from typing import Any, Protocol

import aiosmtplib
from jinja2 import Environment, FileSystemLoader, select_autoescape

from app.core.email_text import format_date, lang_or_default, tr
from app.core.logging import get_logger
from app.core.settings import get_settings
from app.db import queue
from app.models.common import Lang

log = get_logger("email")

_templates = Environment(
    loader=FileSystemLoader(Path(__file__).resolve().parents[1] / "templates"),
    autoescape=select_autoescape(["html"]),  # every value is HTML-escaped
)


@dataclass(frozen=True)
class EmailMessage:
    to: str
    kind: str
    lang: Lang
    params: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class KindSpec:
    subject: str
    heading: str
    intro: str
    button: str | None = None
    shows_code: bool = False
    shows_quote: bool = False


KINDS: dict[str, KindSpec] = {
    "verify_code": KindSpec("verify_subject", "verify_heading", "verify_intro", shows_code=True),
    "password_reset": KindSpec("reset_subject", "reset_heading", "reset_intro", "btn_reset"),
    "confirm_seat": KindSpec("confirm_subject", "confirm_heading", "confirm_intro", "btn_enter_code", shows_code=True),
    "confirm_waitlist": KindSpec(
        "confirm_subject", "confirm_heading", "confirm_wait_intro", "btn_enter_code", shows_code=True
    ),
    "ticket_confirmed": KindSpec("reg_subject", "reg_heading", "reg_intro", "btn_ticket"),
    "ticket_link": KindSpec("link_subject", "link_heading", "link_intro", "btn_ticket"),
    "promoted": KindSpec("promo_subject", "promo_heading", "promo_intro", "btn_ticket"),
    "reminder": KindSpec("remind_subject", "remind_heading", "remind_intro", "btn_ticket"),
    "feedback_request": KindSpec("fbreq_subject", "fbreq_heading", "fbreq_intro", "btn_feedback"),
    "conference_cancelled": KindSpec("cancel_subject", "cancel_heading", "cancel_intro", "btn_ticket"),
    "removed_by_organizer": KindSpec("removed_subject", "removed_heading", "removed_intro"),
    "feedback_reply": KindSpec("fb_subject", "fb_heading", "fb_intro", shows_quote=True),
    "contact_reply": KindSpec(
        "contact_reply_subject", "contact_reply_heading", "contact_reply_intro", shows_quote=True
    ),
}


@dataclass(frozen=True)
class RenderedEmail:
    subject: str
    html: str


def render(message: EmailMessage) -> RenderedEmail:
    spec = KINDS[message.kind]
    lang = lang_or_default(message.lang)
    p = message.params
    rows: list[tuple[str, str]] = []
    if p.get("date"):
        rows.append((tr(lang, "label_date"), format_date(date.fromisoformat(p["date"]), lang)))
    if p.get("venue"):
        rows.append((tr(lang, "label_venue"), p["venue"]))
    if p.get("ticket"):
        rows.append((tr(lang, "label_ticket"), p["ticket"]))
    html = _templates.get_template("message.html").render(
        lang=lang,
        heading=tr(lang, spec.heading, **p),
        greeting=tr(lang, "greeting", name=p.get("name") or ""),
        paragraphs=[tr(lang, spec.intro, **p)],
        rows=rows,
        quote=p.get("quote") if spec.shows_quote else None,
        code=p.get("code") if spec.shows_code else None,
        code_label=tr(lang, "code_label"),
        button_label=tr(lang, spec.button) if spec.button and p.get("link") else None,
        button_url=p.get("link") if spec.button else None,
        team_sign=tr(lang, "team_sign"),
        footer=tr(lang, "footer"),
    )
    return RenderedEmail(subject=tr(lang, spec.subject, **p), html=html)


def is_blocked(address: str) -> bool:
    domain = address.rsplit("@", 1)[-1].lower()
    return any(domain == d or domain.endswith(f".{d}") for d in get_settings().email_blocked_domains)


# ── Senders ──────────────────────────────────────────────────────────────────────────────────────────


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


class QueueEmailSender:
    """Puts the message on the ARQ queue; the worker delivers it."""

    async def send(self, message: EmailMessage) -> None:
        await queue.enqueue("send_email", dataclasses.asdict(message))


class SmtpEmailSender:
    """Sends through Gmail SMTP. Raises on failure, so the worker can retry."""

    def __init__(self, user: str, app_password: str) -> None:
        self.user = user
        self.app_password = app_password.replace(" ", "")  # Google shows it in groups of four

    def build(self, message: EmailMessage) -> MIMEMultipart:
        rendered = render(message)
        mime = MIMEMultipart("alternative")
        mime["Subject"] = rendered.subject
        mime["From"] = f"ConferenceHub <{self.user}>"
        mime["To"] = message.to
        # Without a unique Message-ID, Gmail may treat two emails sent in the same second as one.
        mime["Date"] = formatdate(localtime=True)
        mime["Message-ID"] = make_msgid(domain=self.user.rsplit("@", 1)[-1])
        mime.attach(MIMEText(rendered.html, "html", "utf-8"))
        return mime

    async def send(self, message: EmailMessage) -> None:
        await aiosmtplib.send(
            self.build(message),
            hostname="smtp.gmail.com",
            port=587,
            start_tls=True,
            username=self.user,
            password=self.app_password,
            timeout=20,
        )


def delivery_sender() -> EmailSender:
    settings = get_settings()
    if settings.gmail_user and settings.gmail_app_password:
        return SmtpEmailSender(settings.gmail_user, settings.gmail_app_password.get_secret_value())
    return LogEmailSender()


_sender: EmailSender = LogEmailSender()
_delivery: EmailSender = LogEmailSender()


def use_sender(sender: EmailSender) -> None:
    """How the app hands messages off (queue in production, memory in tests, log without a worker)."""
    global _sender
    _sender = sender


def use_delivery(sender: EmailSender) -> None:
    """How the worker finally delivers them (SMTP, or the log when no mail server is configured)."""
    global _delivery
    _delivery = sender


async def send(message: EmailMessage) -> None:
    await _sender.send(message)


async def deliver(message: EmailMessage) -> bool:
    """Render and deliver one message now. Returns False when it was deliberately not sent."""
    if is_blocked(message.to):
        details = {} if get_settings().is_production else message.params  # codes stay visible in local development
        log.info("email not sent (blocked demo domain)", to=message.to, kind=message.kind, **details)
        return False
    render(message)  # fails early (and visibly) for an unknown kind or a missing parameter
    await _delivery.send(message)
    return True
