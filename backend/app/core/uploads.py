"""Image uploads: size and type limits, real-image check with Pillow, re-encode to WebP."""
from __future__ import annotations

import io
import uuid
from pathlib import Path

from fastapi import UploadFile
from PIL import Image, ImageOps, UnidentifiedImageError

from app.core.config import UPLOAD_DIR
from app.core.errors import AppError

ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}

# kind -> (folder, max bytes, output box, crop to square)
KINDS: dict[str, tuple[str, int, tuple[int, int], bool]] = {
    "avatar": ("avatars", 2 * 1024 * 1024, (400, 400), True),
    "speaker": ("speakers", 2 * 1024 * 1024, (400, 400), True),
    "cover": ("covers", 5 * 1024 * 1024, (1600, 900), False),
}

PUBLIC_PREFIX = "/uploads"


def max_bytes(kind: str) -> int:
    return KINDS[kind][1]


async def save_image(file: UploadFile, kind: str) -> str:
    """Validate and store an upload. Returns its public URL path (/uploads/<folder>/<name>.webp)."""
    folder, limit, box, square = KINDS[kind]
    if (file.content_type or "").lower() not in ALLOWED_TYPES:
        raise AppError(415, "file_type", "Only JPG, PNG or WebP images are allowed", {"allowed": "JPG, PNG, WebP"})

    data = await file.read(limit + 1)
    if len(data) > limit:
        raise AppError(413, "file_too_large", f"Image is larger than {limit // (1024 * 1024)} MB",
                       {"max_mb": limit // (1024 * 1024)})
    if not data:
        raise AppError(400, "file_empty", "The file is empty")

    try:
        img = Image.open(io.BytesIO(data))
        img.verify()  # catches truncated or fake images
        img = Image.open(io.BytesIO(data))
        img = ImageOps.exif_transpose(img)
    except (UnidentifiedImageError, OSError, ValueError) as err:
        raise AppError(415, "file_not_image", "The file is not a valid image") from err

    img = img.convert("RGB")
    if square:
        img = ImageOps.fit(img, box, Image.Resampling.LANCZOS)
    else:
        img.thumbnail(box, Image.Resampling.LANCZOS)

    target_dir = UPLOAD_DIR / folder
    target_dir.mkdir(parents=True, exist_ok=True)
    name = f"{uuid.uuid4().hex}.webp"
    img.save(target_dir / name, "WEBP", quality=85, method=4)
    return f"{PUBLIC_PREFIX}/{folder}/{name}"


def delete_image(url: str | None) -> None:
    """Remove a stored upload; ignores anything that is not inside UPLOAD_DIR."""
    if not url or not url.startswith(PUBLIC_PREFIX + "/"):
        return
    path = (UPLOAD_DIR / url[len(PUBLIC_PREFIX) + 1:]).resolve()
    root = UPLOAD_DIR.resolve()
    if root in path.parents and path.is_file():
        path.unlink(missing_ok=True)


def ensure_upload_dirs() -> Path:
    for folder, *_ in KINDS.values():
        (UPLOAD_DIR / folder).mkdir(parents=True, exist_ok=True)
    return UPLOAD_DIR
