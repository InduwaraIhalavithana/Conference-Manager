"""Files people download: a conference's calendar entry (.ics) and its attendee list (.csv)."""

import csv
import io
from datetime import UTC, datetime
from zoneinfo import ZoneInfo

from app.core.errors import DomainError, ErrorCode
from app.core.settings import get_settings
from app.models import Conference
from app.repositories import registrations as registration_repo
from app.services import conferences
from app.services.auth import Viewer

# ── Calendar (RFC 5545) ──────────────────────────────────────────────────────────────────────────────


def _ics_text(value: str) -> str:
    return (
        value.replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,").replace("\r\n", "\\n").replace("\n", "\\n")
    )


def _fold(line: str) -> str:
    """Lines longer than 75 bytes continue on the next line after a space (never splitting a character)."""
    out, current = [], ""
    for char in line:
        if len((current + char).encode()) > 75:
            out.append(current)
            current = " " + char
        else:
            current += char
    out.append(current)
    return "\r\n".join(out)


def _utc(value: datetime) -> str:
    return value.astimezone(UTC).strftime("%Y%m%dT%H%M%SZ")


def calendar_file(conference: Conference) -> str:
    url = f"{get_settings().frontend_url}/c/{conference.slug}"
    venue = ", ".join(p for p in (conference.venue.name, conference.venue.address, conference.venue.city) if p)
    description = "\n\n".join(p for p in ((conference.summary.en if conference.summary else None), url) if p)
    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//ConferenceHub//v3//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        "BEGIN:VEVENT",
        f"UID:{conference.slug}@conferencehub",
        f"DTSTAMP:{_utc(datetime.now(UTC))}",
        f"DTSTART:{_utc(conference.starts_at)}",
        f"DTEND:{_utc(conference.ends_at)}",
        f"SUMMARY:{_ics_text(conference.title.en)}",
        f"DESCRIPTION:{_ics_text(description)}",
        f"URL:{url}",
        f"STATUS:{'CANCELLED' if conference.status == 'cancelled' else 'CONFIRMED'}",
    ]
    if venue:
        lines.append(f"LOCATION:{_ics_text(venue)}")
    if conference.venue.location:
        lines.append(f"GEO:{conference.venue.location.lat:.6f};{conference.venue.location.lng:.6f}")
    lines += ["END:VEVENT", "END:VCALENDAR"]
    return "\r\n".join(_fold(line) for line in lines) + "\r\n"


async def public_calendar(slug: str) -> tuple[str, str]:
    conference = await conferences.public_by_slug(slug)
    if conference is None:
        raise DomainError(ErrorCode.NOT_FOUND, "Conference not found")
    return f"{conference.slug}.ics", calendar_file(conference)


# ── Attendee list (CSV) ──────────────────────────────────────────────────────────────────────────────

_FORMULA_START = ("=", "+", "-", "@", "\t", "\r")


def _cell(value: object) -> str:
    """Excel and LibreOffice run cells that start with = + - @ as formulas; prefix a quote so they stay text."""
    text = "" if value is None else str(value)
    return f"'{text}" if text.startswith(_FORMULA_START) else text


def _when(value: datetime | None, tz: ZoneInfo) -> str:
    return value.astimezone(tz).strftime("%Y-%m-%d %H:%M") if value else ""


async def attendees_csv(viewer: Viewer | None, conference_id: str) -> tuple[str, bytes]:
    """Owner only. UTF-8 with a byte-order mark, so Excel shows Sinhala and Tamil names correctly."""
    conference = await conferences.for_edit(viewer, conference_id)
    assert conference.id is not None
    tz = ZoneInfo(conference.timezone)
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["Name", "Email", "Status", "Language", "Registered", "Confirmed", "Checked in", "Ticket code"])
    after: str | None = None
    while True:
        page = await registration_repo.list_for_conference(
            conference.id, statuses=None, q=None, checked_in=None, first=500, after=after
        )
        for r in page.items:
            writer.writerow(
                [
                    _cell(r.name),
                    _cell(r.email),
                    r.status,
                    r.lang,
                    _when(r.created_at, tz),
                    _when(r.confirmed_at, tz),
                    _when(r.checked_in_at, tz),
                    r.ticket_code,
                ]
            )
        if not page.has_next:
            break
        after = page.end_cursor
    return f"{conference.slug}-attendees.csv", ("\ufeff" + buffer.getvalue()).encode("utf-8")
