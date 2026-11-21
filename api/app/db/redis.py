"""Redis connection (rate limits now; cache, pub/sub and the ARQ job queue in later phases)."""

from redis.asyncio import Redis

_redis: Redis | None = None
_prefix = "cm3"


async def connect(url: str, prefix: str) -> None:
    global _redis, _prefix
    _redis = Redis.from_url(url, decode_responses=True)
    _prefix = prefix
    await _redis.ping()


async def disconnect() -> None:
    global _redis
    if _redis is not None:
        await _redis.aclose()
        _redis = None


def client() -> Redis:
    if _redis is None:
        raise RuntimeError("Redis is not connected")
    return _redis


def key(*parts: str) -> str:
    """A namespaced key, e.g. key("rl", "login", "1.2.3.4") -> "cm3:rl:login:1.2.3.4"."""
    return ":".join((_prefix, *parts))


async def ping() -> bool:
    if _redis is None:
        return False
    try:
        return bool(await _redis.ping())
    except Exception:
        return False
