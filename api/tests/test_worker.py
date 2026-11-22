"""Phase 3b: email rendering and delivery, the worker's retries, the scheduled jobs, calendar files and CSV."""

import csv
import io
import os
import string
import time
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
from arq import Retry

from app import worker
from app.core.email_text import TEXT
from app.db import queue
from app.models import Notification, Organizer
from app.repositories import conferences as conference_repo
from app.repositories import registrations as registration_repo
from app.services import email, jobs, registrations, uploads
from tests.conftest import OUTBOX, Api, sign_in_organizer, unique_email
from tests.test_conferences import CANCEL, conf_input, day
from tests.test_registrations import confirmed, register
from tests.test_uploads import image_bytes, upload

SAMPLE_PARAMS = {
    "name": "Nimal <b>Silva</b>", "title": "Galle Lit Fest", "code": "123456", "minutes": 15, "hours": 24,
    "link": "http://localhost:3100/ticket/ABCDEFGHJKMN", "date": "2027-01-06", "venue": "Fort Hall, Galle",
    "ticket": "ABCDEFGHJKMN", "position": 3, "subject": "Map pins", "quote": "Thanks, <i>fixed</i> now.",
}  # fmt: skip


# ── Email text and rendering ─────────────────────────────────────────────────────────────────────────


def test_every_language_has_every_email_text_with_the_same_placeholders() -> None:
    def fields(text: str) -> set[str]:
        return {f for _, f, _, _ in string.Formatter().parse(text) if f}

    for lang in ("si", "ta"):
        assert set(TEXT[lang]) == set(TEXT["en"])
        for key, text in TEXT["en"].items():
            assert fields(TEXT[lang][key]) == fields(text), (lang, key)


@pytest.mark.parametrize("lang", ["en", "si", "ta"])
@pytest.mark.parametrize("kind", sorted(email.KINDS))
def test_every_email_kind_renders_in_every_language(kind: str, lang: str) -> None:
    rendered = email.render(email.EmailMessage(to="x@example.com", kind=kind, lang=lang, params=SAMPLE_PARAMS))  # type: ignore[arg-type]
    assert rendered.subject and f'lang="{lang}"' in rendered.html
    assert "<b>Silva</b>" not in rendered.html and "&lt;b&gt;Silva&lt;/b&gt;" in rendered.html  # escaped
    if email.KINDS[kind].shows_code:
        assert "123456" in rendered.html
    if email.KINDS[kind].shows_quote:
        assert "Thanks, &lt;i&gt;fixed&lt;/i&gt; now." in rendered.html  # the quoted reply, escaped


def test_sinhala_dates_are_written_in_sinhala() -> None:
    rendered = email.render(email.EmailMessage(to="x@example.com", kind="reminder", lang="si", params=SAMPLE_PARAMS))
    assert "6 ජනවාරි 2027" in rendered.html


def test_smtp_message_has_the_headers_mail_servers_expect() -> None:
    sender = email.SmtpEmailSender("sender@gmail.com", "abcd efgh ijkl mnop")
    mime = sender.build(email.EmailMessage(to="a@b.lk", kind="verify_code", lang="ta", params=SAMPLE_PARAMS))
    assert sender.app_password == "abcdefghijklmnop"
    assert mime["From"] == "ConferenceHub <sender@gmail.com>" and mime["To"] == "a@b.lk"
    assert mime["Message-ID"].endswith("@gmail.com>") and mime["Date"]
    assert "123456" in str(mime["Subject"])


async def test_blocked_domains_are_never_delivered() -> None:
    delivered = email.MemoryEmailSender()
    email.use_delivery(delivered)
    try:
        for address in ("someone@example.com", "demo1@demo.conferencehub.lk", "x@mail.example.org"):
            assert await email.deliver(email.EmailMessage(address, "reminder", "en", SAMPLE_PARAMS)) is False
        assert await email.deliver(email.EmailMessage("real@gmail.com", "reminder", "en", SAMPLE_PARAMS)) is True
        assert [m.to for m in delivered.outbox] == ["real@gmail.com"]
    finally:
        email.use_delivery(email.LogEmailSender())


async def test_queue_sender_puts_the_email_on_the_arq_queue() -> None:
    await email.QueueEmailSender().send(email.EmailMessage("queued@example.com", "reminder", "en", SAMPLE_PARAMS))
    assert queue._pool is not None and queue._queue_name.startswith("cm_test_")  # never the real worker's queue
    jobs_queued = await queue._pool.queued_jobs(queue_name=queue._queue_name)
    assert any(j.function == "send_email" and j.args[0]["to"] == "queued@example.com" for j in jobs_queued)


class _FailingSender:
    async def send(self, message: email.EmailMessage) -> None:
        raise OSError("SMTP down")


async def test_worker_retries_failed_emails_then_gives_up() -> None:
    email.use_delivery(_FailingSender())
    message = {"to": "real@gmail.com", "kind": "reminder", "lang": "en", "params": SAMPLE_PARAMS}
    try:
        with pytest.raises(Retry):
            await worker.send_email({"job_try": 1}, message)
        with pytest.raises(Retry):
            await worker.send_email({"job_try": 2}, message)
        assert await worker.send_email({"job_try": 3}, message) is False
    finally:
        email.use_delivery(email.LogEmailSender())


def test_worker_schedules_every_job() -> None:
    names = {c.name for c in worker.WorkerSettings.cron_jobs}
    assert names == {
        "cron:heartbeat",
        "cron:release_holds",
        "cron:send_reminders",
        "cron:recount_counters",
        "cron:purge_unverified",
        "cron:delete_orphan_uploads",
    }


# ── Scheduled jobs ───────────────────────────────────────────────────────────────────────────────────


async def published(api: Api, **extra: object) -> dict[str, str]:
    create = "mutation($input: ConferenceInput!) { createConference(input: $input) { ... on Conference { id slug } } }"
    conf = (await api.gql(create, {"input": conf_input(capacity=20, **extra)}))["data"]["createConference"]
    await api.gql("mutation($id: ID!) { publishConference(id: $id) { __typename } }", {"id": conf["id"]})
    return conf  # type: ignore[no-any-return]


async def test_day_before_reminders_go_out_once(api: Api, other_api: Api) -> None:
    await sign_in_organizer(api)
    tomorrow = await published(api, startsAt=day(1, 9), endsAt=day(1, 17))
    later = await published(api, startsAt=day(5, 9), endsAt=day(5, 17))
    seated = unique_email("rem")
    await confirmed(other_api, tomorrow["slug"], seated)
    unconfirmed = unique_email("rem")
    await register(other_api, tomorrow["slug"], unconfirmed)
    await confirmed(other_api, later["slug"])

    first_run = await jobs.send_due_reminders()
    assert first_run >= 1
    reminder = OUTBOX.last_to(seated, "reminder")
    assert reminder.params["ticket"] and reminder.params["date"]
    with pytest.raises(LookupError):
        OUTBOX.last_to(unconfirmed, "reminder")
    assert await jobs.send_due_reminders() == 0  # nobody twice
    assert await Notification.find_one({"kind": "reminders_sent", "params.title": "Galle Literary Days"}) is not None

    now = "mutation($c: ID!) { sendRemindersNow(conferenceId: $c) { ... on RemindersSent { count } ... on UserError { code } } }"
    assert (await api.gql(now, {"c": later["id"]}))["data"]["sendRemindersNow"] == {"count": 1}
    assert (await other_api.gql(now, {"c": later["id"]}))["data"]["sendRemindersNow"]["code"] == "NOT_AUTHENTICATED"


async def test_recount_fixes_drift(api: Api, other_api: Api) -> None:
    await sign_in_organizer(api)
    conf = await published(api)
    await confirmed(other_api, conf["slug"])
    doc = await conference_repo.by_id(conf["id"])
    assert doc is not None and doc.id is not None
    await registration_repo.bump(doc.id, registered=5, waitlisted=2)
    assert await registrations.recount(doc.id) == {"registered": -5, "waitlisted": -2}
    assert await registrations.recount(doc.id) == {}
    fixed = await conference_repo.by_id(conf["id"])
    assert fixed is not None and fixed.counters.registered == 1


async def test_unverified_organizers_are_purged_after_a_week() -> None:
    old = Organizer(first_name="Old", last_name="X", email=unique_email("old"), password_hash="x",
                    created_at=datetime.now(UTC) - timedelta(days=8))  # fmt: skip
    fresh = Organizer(first_name="New", last_name="X", email=unique_email("new"), password_hash="x")
    verified = Organizer(first_name="Ok", last_name="X", email=unique_email("ok"), password_hash="x",
                         created_at=datetime.now(UTC) - timedelta(days=30), email_verified_at=datetime.now(UTC))  # fmt: skip
    for o in (old, fresh, verified):
        await o.insert()
    assert await jobs.purge_unverified_organizers() >= 1
    assert await Organizer.get(old.id) is None
    assert await Organizer.get(fresh.id) is not None and await Organizer.get(verified.id) is not None


async def test_unused_uploads_are_deleted_after_a_day(api: Api) -> None:
    await sign_in_organizer(api)
    _, used = await upload(api, "cover", image_bytes())
    _, abandoned = await upload(api, "cover", image_bytes())
    _, just_now = await upload(api, "cover", image_bytes())
    create = "mutation($input: ConferenceInput!) { createConference(input: $input) { __typename } }"
    await api.gql(create, {"input": conf_input(coverUrl=used["url"])})

    def path(url: str) -> Path:
        return uploads.upload_root() / url.removeprefix("/uploads/")

    two_days_ago = time.time() - 2 * 24 * 3600
    for url in (used["url"], abandoned["url"]):
        os.utime(path(url), (two_days_ago, two_days_ago))
    assert await jobs.delete_orphan_uploads() >= 1
    assert path(used["url"]).exists() and path(just_now["url"]).exists()
    assert not path(abandoned["url"]).exists()


# ── Calendar and CSV ─────────────────────────────────────────────────────────────────────────────────


async def test_calendar_file(api: Api, other_api: Api) -> None:
    await sign_in_organizer(api)
    title = {"en": "Galle; Lit, Fest — a very long title that certainly needs folding in the calendar file"}
    conf = await published(api, title=title, venueName="Fort Hall", latitude=6.0269, longitude=80.2168)
    res = await other_api.http.get(f"/conferences/{conf['slug']}/calendar.ics")
    assert res.status_code == 200 and res.headers["content-type"].startswith("text/calendar")
    body = res.text
    assert body.startswith("BEGIN:VCALENDAR\r\n") and body.endswith("END:VCALENDAR\r\n")
    assert "SUMMARY:Galle\\; Lit\\, Fest" in body and "STATUS:CONFIRMED" in body and "GEO:6.026900;80.216800" in body
    assert all(len(line.encode()) <= 75 for line in body.split("\r\n"))
    assert "DTSTART:" in body and body.split("DTSTART:")[1][:16].endswith("Z")

    await api.gql(CANCEL, {"id": conf["id"]})
    assert "STATUS:CANCELLED" in (await other_api.http.get(f"/conferences/{conf['slug']}/calendar.ics")).text
    assert (await other_api.http.get("/conferences/no-such-thing/calendar.ics")).status_code == 404


async def test_attendee_csv_is_owner_only_and_safe_in_excel(api: Api, other_api: Api) -> None:
    await sign_in_organizer(api)
    conf = await published(api)
    await confirmed(other_api, conf["slug"])
    await register(other_api, conf["slug"], name='=HYPERLINK("http://evil")')
    await register(other_api, conf["slug"], name="නිමල් සිල්වා")

    res = await api.http.get(f"/conferences/{conf['id']}/attendees.csv")
    assert res.status_code == 200 and res.headers["content-type"].startswith("text/csv")
    assert res.content.startswith("﻿".encode())
    rows = list(csv.reader(io.StringIO(res.content.decode("utf-8-sig"))))
    assert rows[0][:3] == ["Name", "Email", "Status"] and len(rows) == 4
    names = [r[0] for r in rows[1:]]
    assert '\'=HYPERLINK("http://evil")' in names and "නිමල් සිල්වා" in names

    assert (await other_api.http.get(f"/conferences/{conf['id']}/attendees.csv")).status_code == 401
    await sign_in_organizer(other_api, "Rival")
    assert (await other_api.http.get(f"/conferences/{conf['id']}/attendees.csv")).status_code == 404
