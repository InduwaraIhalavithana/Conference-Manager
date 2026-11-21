"""Sample data for local development: two published conferences with agendas and one hidden draft,
owned by a sample organizer who cannot sign in (random password, demo domain that is never emailed).

    uv run python -m scripts.seed_spike            # insert or refresh
    uv run python -m scripts.seed_spike --remove   # delete them again

Phase 8 replaces this with the full demo seed.
"""

import argparse
import asyncio
import secrets
from datetime import UTC, date, datetime

from app.core.passwords import hash_password
from app.core.settings import get_settings
from app.db import mongo as db
from app.models import Conference, LocalizedText, Organizer
from app.models.conference import AgendaSession, ConferenceDay, GeoPoint, Speaker, Track, Venue

SLUGS = ["spike-colombo-tech-summit", "spike-kandy-health-forum", "spike-draft-hidden"]
ORGANIZER_EMAIL = "sample.organizer@demo.conferencehub.lk"


def t(en: str, si: str | None = None, ta: str | None = None) -> LocalizedText:
    return LocalizedText(en=en, si=si, ta=ta)


def utc(y: int, m: int, d: int, h: int, mi: int = 0) -> datetime:
    """Times below are Sri Lanka time (UTC+05:30), written as UTC."""
    return datetime(y, m, d, h, mi, tzinfo=UTC)


def conferences(organizer: Organizer) -> list[Conference]:
    assert organizer.id is not None
    ai, web = (
        Track(name=t("AI and data", "AI සහ දත්ත", "AI மற்றும் தரவு"), color="#8b5cf6"),
        Track(name=t("Web", "වෙබ්", "வலை"), color="#0ea5e9"),
    )
    nimali = Speaker(name="Nimali Fernando", job_title="Data scientist", organization="LankaTech")
    arun = Speaker(name="Arun Kumar", job_title="Frontend lead", organization="Jaffna Labs")
    tech = Conference(
        organizer_id=organizer.id,
        slug=SLUGS[0],
        status="published",
        published_at=datetime.now(UTC),
        title=t("Colombo Tech Summit", "කොළඹ තාක්ෂණ සමුළුව", "கொழும்பு தொழில்நுட்ப உச்சி மாநாடு"),
        summary=t("Two days of talks and workshops on software in Sri Lanka."),
        category="tech",
        tags=["ai", "web", "cloud"],
        venue=Venue(name="BMICH", address="Bauddhaloka Mawatha", city="Colombo", location=GeoPoint(coordinates=(79.8726, 6.9022))),
        starts_at=utc(2027, 2, 12, 3, 30),
        ends_at=utc(2027, 2, 13, 11, 30),
        days=[ConferenceDay(date=date(2027, 2, 12), label=t("Talks")), ConferenceDay(date=date(2027, 2, 13), label=t("Workshops"))],
        tracks=[ai, web],
        speakers=[nimali, arun],
        sessions=[
            AgendaSession(day=date(2027, 2, 12), title=t("Opening keynote"), kind="keynote", starts_at=utc(2027, 2, 12, 3, 30),
                          ends_at=utc(2027, 2, 12, 4, 30), room="Main hall", speaker_ids=[nimali.id]),
            AgendaSession(day=date(2027, 2, 12), title=t("Next.js in production"), kind="talk", track_id=web.id,
                          starts_at=utc(2027, 2, 12, 5, 0), ends_at=utc(2027, 2, 12, 5, 45), room="Hall B", speaker_ids=[arun.id]),
            AgendaSession(day=date(2027, 2, 13), title=t("Hands-on: models in Sinhala"), kind="workshop", track_id=ai.id,
                          starts_at=utc(2027, 2, 13, 4, 0), ends_at=utc(2027, 2, 13, 7, 0), room="Lab 1", speaker_ids=[nimali.id]),
        ],
        capacity=300,
    )  # fmt: skip
    health = Conference(
        organizer_id=organizer.id,
        slug=SLUGS[1],
        status="published",
        published_at=datetime.now(UTC),
        title=t("Kandy Health Forum", "මහනුවර සෞඛ්‍ය සංසදය", "கண்டி சுகாதார மன்றம்"),
        category="health",
        tags=["public health"],
        venue=Venue(name="Earl's Regency", city="Kandy", location=GeoPoint(coordinates=(80.6337, 7.2906))),
        starts_at=utc(2027, 3, 5, 4, 0),
        ends_at=utc(2027, 3, 5, 10, 0),
        days=[ConferenceDay(date=date(2027, 3, 5))],
        capacity=120,
    )
    draft = Conference(
        organizer_id=organizer.id,
        slug=SLUGS[2],
        title=t("Draft that must not appear"),
        venue=Venue(city="Galle"),
        starts_at=utc(2027, 1, 1, 4, 0),
        ends_at=utc(2027, 1, 1, 8, 0),
        days=[ConferenceDay(date=date(2027, 1, 1))],
    )
    return [tech, health, draft]


async def main(remove: bool) -> None:
    settings = get_settings()
    await db.connect(settings.mongo_url, settings.mongo_db)
    try:
        await Conference.get_pymongo_collection().delete_many({"slug": {"$in": SLUGS}})
        await Organizer.get_pymongo_collection().delete_many({"email": ORGANIZER_EMAIL})
        if remove:
            print("Removed the sample conferences and organizer.")
            return
        organizer = Organizer(
            first_name="Sample",
            last_name="Organizer",
            email=ORGANIZER_EMAIL,
            organization="ConferenceHub samples",
            password_hash=hash_password(secrets.token_urlsafe(32)),
            email_verified_at=datetime.now(UTC),
        )
        await organizer.insert()
        await Conference.insert_many(conferences(organizer))
        print(f"Inserted 3 sample conferences into '{settings.mongo_db}'.")
    finally:
        await db.disconnect()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--remove", action="store_true")
    asyncio.run(main(parser.parse_args().remove))
