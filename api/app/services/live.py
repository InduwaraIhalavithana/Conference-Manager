"""Live check-in numbers for the conference's owner (check-in desk, attendees page): the current counts first,
then one event per check-in or undo, with a heartbeat while nothing happens."""

from collections.abc import AsyncIterator
from typing import Any

from app.repositories import live
from app.services.auth import Viewer
from app.services.registrations import owned_conference

HEARTBEAT_SECONDS = 20.0


async def snapshot(viewer: Viewer | None, conference_id: str) -> dict[str, Any]:
    """The opening event: who the stream is for and the numbers right now. Raises for anyone but the owner."""
    conference = await owned_conference(viewer, conference_id)
    counters = conference.counters
    return {
        "type": "snapshot",
        "checkedIn": counters.checked_in,
        "confirmed": counters.confirmed,
        "registered": counters.registered,
    }


async def events(conference_id: str, heartbeat: float = HEARTBEAT_SECONDS) -> AsyncIterator[dict[str, Any]]:
    """Every published event for the conference, and {"type": "ping"} after `heartbeat` quiet seconds."""
    async for event in live.listen(conference_id, heartbeat):
        yield event if event is not None else {"type": "ping"}
