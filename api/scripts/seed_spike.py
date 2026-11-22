"""Sample data for local development: a dozen published conferences across topics and cities (two with agendas),
one past conference and one hidden draft,
owned by a sample organizer who cannot sign in (random password, demo domain that is never emailed).

    uv run python -m scripts.seed_spike            # insert or refresh
    uv run python -m scripts.seed_spike --remove   # delete them again

Phase 8 replaces this with the full demo seed.
"""

import argparse
import asyncio
import secrets
from datetime import UTC, date, datetime, timedelta

from app.core.passwords import hash_password
from app.core.settings import get_settings
from app.db import mongo as db
from app.models import Conference, LocalizedText, Organizer
from app.models.conference import AgendaSession, ConferenceDay, GeoPoint, Speaker, Track, Venue

SLUGS = ["spike-colombo-tech-summit", "spike-kandy-health-forum", "spike-draft-hidden"]
# (slug, English, Sinhala, Tamil, category, city, venue, lng, lat, days from now, capacity)
EXTRA = [
    (
        "spike-galle-literature-festival",
        "Galle Literature Festival",
        "ගාල්ල සාහිත්‍ය උළෙල",
        "காலி இலக்கிய விழா",
        "arts",
        "Galle",
        "Galle Fort Hall",
        80.2168,
        6.0269,
        18,
        400,
    ),
    (
        "spike-jaffna-education-expo",
        "Jaffna Education Expo",
        "යාපනය අධ්‍යාපන ප්‍රදර්ශනය",
        "யாழ்ப்பாணம் கல்விக் கண்காட்சி",
        "education",
        "Jaffna",
        "Jaffna Public Library",
        80.0089,
        9.6615,
        26,
        250,
    ),
    (
        "spike-colombo-startup-night",
        "Colombo Startup Night",
        "කොළඹ ආරම්භක ව්‍යාපාර රාත්‍රිය",
        "கொழும்பு புத்தொழில் இரவு",
        "business",
        "Colombo",
        "Hatch Works",
        79.8489,
        6.9344,
        9,
        120,
    ),
    (
        "spike-peradeniya-science-week",
        "Peradeniya Science Week",
        "පේරාදෙණිය විද්‍යා සතිය",
        "பேராதனை அறிவியல் வாரம்",
        "science",
        "Kandy",
        "University of Peradeniya",
        80.5986,
        7.2546,
        33,
        600,
    ),
    (
        "spike-matara-coastal-health",
        "Matara Coastal Health Day",
        "මාතර වෙරළබඩ සෞඛ්‍ය දිනය",
        "மாத்தறை கடலோர சுகாதார நாள்",
        "health",
        "Matara",
        "Matara Town Hall",
        80.5353,
        5.9485,
        14,
        80,
    ),
    (
        "spike-negombo-tourism-forum",
        "Negombo Tourism Forum",
        "මීගමුව සංචාරක සංසදය",
        "நீர்கொழும்பு சுற்றுலா மன்றம்",
        "business",
        "Negombo",
        "Negombo Beach Hotel",
        79.8358,
        7.2083,
        40,
        150,
    ),
    (
        "spike-kurunegala-ai-day",
        "Kurunegala AI Day",
        "කුරුණෑගල AI දිනය",
        "குருநாகல் AI நாள்",
        "tech",
        "Kurunegala",
        "Wayamba Hall",
        80.3647,
        7.4818,
        22,
        200,
    ),
    (
        "spike-trincomalee-arts-weekend",
        "Trincomalee Arts Weekend",
        "ත්‍රිකුණාමලය කලා සති අන්තය",
        "திருகோணமலை கலை வார இறுதி",
        "arts",
        "Trincomalee",
        "Fort Frederick Grounds",
        81.2335,
        8.5711,
        47,
        300,
    ),
    (
        "spike-anuradhapura-heritage-talks",
        "Anuradhapura Heritage Talks",
        "අනුරාධපුර උරුම දේශන",
        "அனுராதபுரம் பாரம்பரிய உரைகள்",
        "other",
        "Anuradhapura",
        "Sacred City Centre",
        80.3964,
        8.3114,
        55,
        90,
    ),
    (
        "spike-colombo-past-devfest",
        "Colombo DevFest (last year)",
        "කොළඹ DevFest (පසුගිය වසර)",
        "கொழும்பு DevFest (கடந்த ஆண்டு)",
        "tech",
        "Colombo",
        "BMICH",
        79.8726,
        6.9022,
        -60,
        500,
    ),
]
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


def extra_conferences(organizer: Organizer) -> list[Conference]:
    assert organizer.id is not None
    now = datetime.now(UTC).replace(hour=3, minute=30, second=0, microsecond=0)  # 09:00 in Sri Lanka
    out = []
    for slug, en, si, ta, category, city, venue, lng, lat, days, capacity in EXTRA:
        starts = now + timedelta(days=days)
        out.append(
            Conference(
                organizer_id=organizer.id,
                slug=slug,
                status="published",
                published_at=datetime.now(UTC),
                title=t(en, si, ta),
                summary=t(f"Sample: a day of talks, workshops and people in {city}."),
                category=category,
                tags=[category, city.lower()],
                venue=Venue(name=venue, city=city, location=GeoPoint(coordinates=(lng, lat))),
                starts_at=starts,
                ends_at=starts + timedelta(hours=7),
                days=[ConferenceDay(date=(starts + timedelta(hours=5, minutes=30)).date())],
                capacity=capacity,
            )
        )
    return out


async def main(remove: bool) -> None:
    settings = get_settings()
    await db.connect(settings.mongo_url, settings.mongo_db)
    try:
        await Conference.get_pymongo_collection().delete_many({"slug": {"$in": SLUGS + [e[0] for e in EXTRA]}})
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
        docs = conferences(organizer) + extra_conferences(organizer)
        await Conference.insert_many(docs)
        print(f"Inserted {len(docs)} sample conferences into '{settings.mongo_db}'.")
    finally:
        await db.disconnect()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--remove", action="store_true")
    asyncio.run(main(parser.parse_args().remove))
