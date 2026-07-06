import math
from fastapi import Query
from typing import Any


def paginate(items: list[Any], page: int, per_page: int) -> dict:
    total = len(items)
    pages = math.ceil(total / per_page) if per_page else 1
    start = (page - 1) * per_page
    return {
        "items": items[start : start + per_page],
        "total": total,
        "page": page,
        "pages": pages,
    }


def page_params(page: int = Query(1, ge=1), per_page: int = Query(20, ge=1, le=100)):
    return page, per_page
