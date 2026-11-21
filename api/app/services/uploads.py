"""Image uploads: type and size limits, a real-image check with Pillow, then re-encoding to WebP.

Re-encoding drops everything except the pixels: EXIF data (camera, GPS position), embedded scripts and any
other payload hidden in the original file never reach the server's disk. Rules carried over from v2:
JPG, PNG or WebP only; 5 MB covers fitted into 1600x900; 2 MB speaker photos cropped to 400x400.
"""

import asyncio
import io
import re
import shutil
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Literal

from PIL import Image, ImageOps, UnidentifiedImageError

from app.core.errors import DomainError, ErrorCode
from app.core.settings import get_settings
from app.repositories import conferences as conference_repo
from app.services import ratelimit
from app.services.auth import Viewer

Kind = Literal["cover", "speaker"]
PUBLIC_PREFIX = "/uploads"
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}
_NAME = re.compile(r"^[0-9a-f]{32}\.webp$")
Image.MAX_IMAGE_PIXELS = 40_000_000  # refuse decompression bombs


@dataclass(frozen=True)
class KindRule:
    folder: str
    max_bytes: int
    box: tuple[int, int]
    square: bool


RULES: dict[Kind, KindRule] = {
    "cover": KindRule("covers", 5 * 1024 * 1024, (1600, 900), square=False),
    "speaker": KindRule("speakers", 2 * 1024 * 1024, (400, 400), square=True),
}


def upload_root() -> Path:
    return Path(get_settings().upload_dir).resolve()


def ensure_dirs() -> Path:
    root = upload_root()
    for rule in RULES.values():
        (root / rule.folder).mkdir(parents=True, exist_ok=True)
    return root


def _reencode(data: bytes, rule: KindRule) -> bytes:
    try:
        Image.open(io.BytesIO(data)).verify()  # catches truncated or fake images
        img: Image.Image = ImageOps.exif_transpose(Image.open(io.BytesIO(data)))
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError) as err:
        raise DomainError(ErrorCode.FILE_NOT_IMAGE, "That file is not a valid image") from err
    img = img.convert("RGB")
    if rule.square:
        img = ImageOps.fit(img, rule.box, Image.Resampling.LANCZOS)
    else:
        img.thumbnail(rule.box, Image.Resampling.LANCZOS)
    out = io.BytesIO()
    img.save(out, "WEBP", quality=85, method=4)
    return out.getvalue()


async def save_image(kind: Kind, content_type: str | None, data: bytes) -> str:
    """Validate, re-encode and store an image. Returns its public path, e.g. /uploads/covers/<id>.webp."""
    rule = RULES[kind]
    if (content_type or "").lower() not in ALLOWED_TYPES:
        raise DomainError(ErrorCode.FILE_TYPE, "Only JPG, PNG or WebP images are allowed")
    if not data:
        raise DomainError(ErrorCode.VALIDATION, "The file is empty")
    if len(data) > rule.max_bytes:
        mb = rule.max_bytes // (1024 * 1024)
        raise DomainError(ErrorCode.FILE_TOO_LARGE, f"The image is larger than {mb} MB", max_mb=mb)
    webp = await asyncio.to_thread(_reencode, data, rule)
    name = f"{uuid.uuid4().hex}.webp"
    target = ensure_dirs() / rule.folder / name
    await asyncio.to_thread(target.write_bytes, webp)
    return f"{PUBLIC_PREFIX}/{rule.folder}/{name}"


def _path_for(url: str | None) -> Path | None:
    """The file behind one of our upload URLs, or None for anything else (never escapes the upload folder)."""
    if not url or not url.startswith(PUBLIC_PREFIX + "/"):
        return None
    parts = url[len(PUBLIC_PREFIX) + 1 :].split("/")
    folders = {rule.folder for rule in RULES.values()}
    if len(parts) != 2 or parts[0] not in folders or not _NAME.match(parts[1]):
        return None
    return upload_root() / parts[0] / parts[1]


def require_own_upload(url: str, kind: Kind) -> None:
    """Image fields only accept files uploaded to this server, in the right folder."""
    path = _path_for(url)
    if path is None or path.parent.name != RULES[kind].folder or not path.is_file():
        raise DomainError(
            ErrorCode.VALIDATION, "Upload the image first, then use the address it returns", field="imageUrl"
        )


async def discard_if_unused(url: str) -> None:
    path = _path_for(url)
    if path is not None and not await conference_repo.file_still_used(url):
        path.unlink(missing_ok=True)


async def copy_upload(url: str | None) -> str | None:
    path = _path_for(url)
    if path is None or not path.is_file():
        return None
    name = f"{uuid.uuid4().hex}.webp"
    await asyncio.to_thread(shutil.copyfile, path, path.parent / name)
    return f"{PUBLIC_PREFIX}/{path.parent.name}/{name}"


async def upload(viewer: Viewer | None, kind: str, content_type: str | None, data: bytes) -> str:
    """An organizer uploads an image; the returned path is then used in a GraphQL mutation."""
    if viewer is None:
        raise DomainError(ErrorCode.NOT_AUTHENTICATED, "Sign in first")
    if viewer.organizer is None:
        raise DomainError(ErrorCode.FORBIDDEN, "Only organizers can upload images")
    if kind != "cover" and kind != "speaker":
        raise DomainError(ErrorCode.VALIDATION, "Unknown image kind", field="kind")
    checked: Kind = "cover" if kind == "cover" else "speaker"
    await ratelimit.enforce(ratelimit.UPLOAD, str(viewer.subject.id))
    return await save_image(checked, content_type, data)


def max_bytes() -> int:
    return max(rule.max_bytes for rule in RULES.values())
