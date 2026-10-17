"""Outgoing email through Gmail SMTP. Without credentials, emails are written to the log instead."""
from __future__ import annotations

import logging
import os
from dataclasses import dataclass, field
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import aiosmtplib
from fastapi import BackgroundTasks
from jinja2 import Environment, FileSystemLoader, select_autoescape

import app.core.config  # noqa: F401  (loads backend/.env)
from app.core.config import FRONTEND_URL, TESTING
from app.core.email_text import format_date, lang_or_default, tr

log = logging.getLogger("conference.email")

GMAIL_USER = os.getenv("GMAIL_USER", "")
GMAIL_APP_PASSWORD = os.getenv("GMAIL_APP_PASSWORD", "")

_env = Environment(
    loader=FileSystemLoader(os.path.join(os.path.dirname(__file__), "..", "templates")),
    autoescape=select_autoescape(["html"]),
)

# Tests read this to check what would have been sent.
OUTBOX: list[dict] = []


def email_enabled() -> bool:
    return bool(GMAIL_USER and GMAIL_APP_PASSWORD) and not TESTING


@dataclass
class Message:
    to: str
    lang: str
    subject: str
    heading: str
    name: str
    paragraphs: list[str] = field(default_factory=list)
    rows: list[tuple[str, str]] = field(default_factory=list)
    quote: str | None = None
    button_label: str | None = None
    button_url: str | None = None


def render(msg: Message) -> str:
    lang = lang_or_default(msg.lang)
    return _env.get_template("message.html").render(
        lang=lang,
        heading=msg.heading,
        greeting=tr(lang, "greeting", name=msg.name),
        paragraphs=msg.paragraphs,
        rows=msg.rows,
        quote=msg.quote,
        button_label=msg.button_label,
        button_url=msg.button_url,
        team_sign=tr(lang, "team_sign"),
        footer=tr(lang, "footer"),
    )


async def send_message(msg: Message) -> bool:
    """Send one email. Returns True when it actually went out through SMTP."""
    OUTBOX.append({"to": msg.to, "subject": msg.subject, "lang": msg.lang, "link": msg.button_url})
    if not email_enabled():
        log.info("Email not sent (Gmail not configured): to=%s subject=%s link=%s", msg.to, msg.subject, msg.button_url)
        return False
    mime = MIMEMultipart("alternative")
    mime["Subject"] = msg.subject
    mime["From"] = f"ConferenceHub <{GMAIL_USER}>"
    mime["To"] = msg.to
    mime.attach(MIMEText(render(msg), "html", "utf-8"))
    try:
        await aiosmtplib.send(mime, hostname="smtp.gmail.com", port=587, start_tls=True,
                              username=GMAIL_USER, password=GMAIL_APP_PASSWORD, timeout=20)
        return True
    except Exception:  # an email failure must never break the request that triggered it
        log.exception("Email to %s failed", msg.to)
        return False


def queue(background: BackgroundTasks, msg: Message) -> None:
    background.add_task(send_message, msg)


# ── Message builders ────────────────────────────────────────────────────────

def _conf_rows(conf, lang: str, ticket_code: str | None = None) -> list[tuple[str, str]]:
    rows = [(tr(lang, "label_date"), format_date(conf.date, lang))]
    if conf.time:
        end = f" - {conf.end_time.strftime('%H:%M')}" if conf.end_time else ""
        rows.append((tr(lang, "label_time"), conf.time.strftime("%H:%M") + end))
    if conf.location:
        rows.append((tr(lang, "label_venue"), conf.location))
    if ticket_code:
        rows.append((tr(lang, "label_ticket"), ticket_code))
    return rows


def ticket_url(code: str) -> str:
    return f"{FRONTEND_URL}/tickets/{code}"


def registration_message(attendee, conf, waitlist_position: int | None = None) -> Message:
    lang = lang_or_default(attendee.lang)
    if waitlist_position:
        return Message(
            to=attendee.email, lang=lang, name=attendee.name,
            subject=tr(lang, "wait_subject", title=conf.title), heading=tr(lang, "wait_heading"),
            paragraphs=[tr(lang, "wait_intro", title=conf.title, position=waitlist_position)],
            rows=_conf_rows(conf, lang, attendee.ticket_code),
            button_label=tr(lang, "btn_ticket"), button_url=ticket_url(attendee.ticket_code),
        )
    return Message(
        to=attendee.email, lang=lang, name=attendee.name,
        subject=tr(lang, "reg_subject", title=conf.title), heading=tr(lang, "reg_heading"),
        paragraphs=[tr(lang, "reg_intro", title=conf.title)],
        rows=_conf_rows(conf, lang, attendee.ticket_code),
        button_label=tr(lang, "btn_ticket"), button_url=ticket_url(attendee.ticket_code),
    )


def promoted_message(attendee, conf) -> Message:
    lang = lang_or_default(attendee.lang)
    return Message(
        to=attendee.email, lang=lang, name=attendee.name,
        subject=tr(lang, "promo_subject", title=conf.title), heading=tr(lang, "promo_heading"),
        paragraphs=[tr(lang, "promo_intro")],
        rows=_conf_rows(conf, lang, attendee.ticket_code),
        button_label=tr(lang, "btn_ticket"), button_url=ticket_url(attendee.ticket_code),
    )


def reminder_message(attendee, conf) -> Message:
    lang = lang_or_default(attendee.lang)
    return Message(
        to=attendee.email, lang=lang, name=attendee.name,
        subject=tr(lang, "remind_subject", title=conf.title), heading=tr(lang, "remind_heading"),
        paragraphs=[tr(lang, "remind_intro", title=conf.title)],
        rows=_conf_rows(conf, lang, attendee.ticket_code),
        button_label=tr(lang, "btn_ticket"), button_url=ticket_url(attendee.ticket_code),
    )


def new_registration_message(org, conf, attendee_name: str, count: int) -> Message:
    lang = lang_or_default(org.lang)
    return Message(
        to=org.email, lang=lang, name=org.first_name,
        subject=tr(lang, "newreg_subject", title=conf.title), heading=tr(lang, "newreg_heading"),
        paragraphs=[tr(lang, "newreg_intro", attendee=attendee_name, title=conf.title, count=count)],
        button_label=tr(lang, "btn_dashboard"), button_url=f"{FRONTEND_URL}/attendees/{conf.id}",
    )


def feedback_reply_message(org, subject: str, reply: str) -> Message:
    lang = lang_or_default(org.lang)
    return Message(
        to=org.email, lang=lang, name=org.first_name,
        subject=tr(lang, "fb_subject", subject=subject), heading=tr(lang, "fb_heading"),
        paragraphs=[tr(lang, "fb_intro", subject=subject)], quote=reply,
        button_label=tr(lang, "btn_dashboard"), button_url=f"{FRONTEND_URL}/help",
    )


def password_reset_message(org, reset_url: str) -> Message:
    lang = lang_or_default(org.lang)
    return Message(
        to=org.email, lang=lang, name=org.first_name,
        subject=tr(lang, "reset_subject"), heading=tr(lang, "reset_heading"),
        paragraphs=[tr(lang, "reset_intro")],
        button_label=tr(lang, "btn_reset"), button_url=reset_url,
    )
