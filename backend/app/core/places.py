"""Turn a free-text venue address into a city name for filters and charts."""
from __future__ import annotations

import re

_COUNTRY = {"sri lanka", "srilanka", "lk"}


def city_of(location: str | None) -> str | None:
    """'BMICH, Bauddhaloka Mawatha, Colombo 07, Sri Lanka' -> 'Colombo'; 'Kandy, Sri Lanka' -> 'Kandy'."""
    if not location:
        return None
    parts = [p.strip() for p in location.split(",") if p.strip()]
    parts = [p for p in parts if p.lower() not in _COUNTRY]
    if not parts:
        return None
    city = re.sub(r"\s+\d+$", "", parts[-1]).strip()  # drop postal district numbers ("Colombo 07")
    return city or None
