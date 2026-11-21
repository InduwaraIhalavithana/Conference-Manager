"""Phase 0 spike data: three sample conferences (one draft, which must stay hidden).

uv run python -m scripts.seed_spike            # insert or refresh
uv run python -m scripts.seed_spike --remove   # delete them again
"""

import argparse
import asyncio
from datetime import UTC, datetime

from app import db
from app.models import Conference, LocalizedText
from app.settings import get_settings


def spike_conferences() -> list[Conference]:
    return [
        Conference(
            slug="spike-colombo-tech-summit",
            status="published",
            title=LocalizedText(en="Colombo Tech Summit", si="කොළඹ තාක්ෂණ සමුළුව", ta="கொழும்பு தொழில்நுட்ப உச்சி மாநாடு"),
            summary=LocalizedText(en="Spike sample: two days of talks on software in Sri Lanka."),
            city="Colombo",
            starts_at=datetime(2027, 2, 12, 3, 30, tzinfo=UTC),
        ),
        Conference(
            slug="spike-kandy-health-forum",
            status="published",
            title=LocalizedText(en="Kandy Health Forum", si="මහනුවර සෞඛ්‍ය සංසදය", ta="கண்டி சுகாதார மன்றம்"),
            city="Kandy",
            starts_at=datetime(2027, 3, 5, 4, 0, tzinfo=UTC),
        ),
        Conference(
            slug="spike-draft-hidden",
            status="draft",
            title=LocalizedText(en="Draft that must not appear"),
            city="Galle",
            starts_at=datetime(2027, 1, 1, 4, 0, tzinfo=UTC),
        ),
    ]


async def main(remove: bool) -> None:
    settings = get_settings()
    await db.connect(settings.mongo_url, settings.mongo_db)
    try:
        items = spike_conferences()
        result = await Conference.find({"slug": {"$in": [c.slug for c in items]}}).delete()
        if remove:
            print(f"Removed {result.deleted_count if result else 0} spike conferences.")
            return
        await Conference.insert_many(items)
        print(f"Inserted {len(items)} spike conferences into '{settings.mongo_db}'.")
    finally:
        await db.disconnect()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--remove", action="store_true")
    asyncio.run(main(parser.parse_args().remove))
