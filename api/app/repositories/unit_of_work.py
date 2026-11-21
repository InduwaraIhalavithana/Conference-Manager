"""Unit of Work: run several writes as one MongoDB transaction.

Either every write in the callback is committed, or none is. PyMongo's ``with_transaction`` retries the
whole callback on transient errors (for example two transactions changing the same conference counters at
the same moment), which is what makes the seat limit safe under concurrent registrations.
"""

from collections.abc import Awaitable, Callable
from typing import Any

from pymongo.asynchronous.client_session import AsyncClientSession
from pymongo.read_concern import ReadConcern
from pymongo.write_concern import WriteConcern

from app.db import mongo

Session = AsyncClientSession


async def run[T](work: Callable[[Session], Awaitable[T]]) -> T:
    async with mongo.client().start_session() as session:
        result: Any = await session.with_transaction(
            work, read_concern=ReadConcern("snapshot"), write_concern=WriteConcern("majority")
        )
        return result  # type: ignore[no-any-return]


class Rollback(Exception):
    """Raise inside a unit of work to undo everything it wrote (no error is reported to the caller)."""
