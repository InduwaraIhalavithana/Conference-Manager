"""Fixed-window counters in Redis, used by the rate-limit service."""

from app.db import redis


async def hit(name: str, ident: str, window_seconds: int) -> tuple[int, int]:
    """Count one request. Returns (requests in the current window, seconds until the window resets)."""
    r = redis.client()
    k = redis.key("rl", name, ident)
    async with r.pipeline(transaction=True) as pipe:
        pipe.incr(k)
        pipe.expire(k, window_seconds, nx=True)
        pipe.ttl(k)
        count, _, ttl = await pipe.execute()
    return int(count), max(int(ttl), 1)
