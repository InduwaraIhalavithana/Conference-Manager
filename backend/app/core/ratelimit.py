"""One limiter shared by every router, so app.state.limiter and the decorators agree."""
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.config import TESTING

limiter = Limiter(key_func=get_remote_address, enabled=not TESTING)
