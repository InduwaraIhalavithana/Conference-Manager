"""Image uploads: only real images, re-encoded to WebP without metadata, cleaned up when no longer used."""

import io
from pathlib import Path
from typing import Any

from PIL import Image

from app.services import uploads
from tests.conftest import ADMIN_PASSWORD, Api, sign_in_organizer
from tests.test_conferences import CREATE, DELETE, DUPLICATE, UPDATE, conf_input


def image_bytes(fmt: str = "PNG", size: tuple[int, int] = (800, 600), exif: bool = False) -> bytes:
    img = Image.new("RGB", size, (30, 120, 220))
    out = io.BytesIO()
    if exif:
        data = Image.Exif()
        data[0x010F] = "SecretCam"  # camera make
        data[0x8825] = {1: "N", 2: (6.0, 54.0, 0.0)}  # GPS
        img.save(out, fmt, exif=data)
    else:
        img.save(out, fmt)
    return out.getvalue()


async def upload(
    api: Api, kind: str, data: bytes, content_type: str = "image/png", csrf: bool = True
) -> tuple[int, dict[str, Any]]:
    headers = {}
    if csrf:
        token = api.http.cookies.get("cm_csrf") or (await api.http.get("/auth/csrf")).json()["csrfToken"]
        headers["X-CSRF-Token"] = token
    res = await api.http.post(f"/upload?kind={kind}", files={"file": ("photo", data, content_type)}, headers=headers)
    return res.status_code, res.json()


def file_for(url: str) -> Path:
    return uploads.upload_root() / url.removeprefix("/uploads/")


async def test_cover_is_reencoded_to_webp_without_metadata(api: Api) -> None:
    await sign_in_organizer(api)
    status, body = await upload(api, "cover", image_bytes("JPEG", (3000, 2000), exif=True), "image/jpeg")
    assert status == 200 and body["url"].startswith("/uploads/covers/") and body["url"].endswith(".webp")

    stored = Image.open(file_for(body["url"]))
    assert stored.format == "WEBP" and stored.size == (1350, 900)
    assert not stored.getexif()
    served = await api.http.get(body["url"])
    assert served.status_code == 200 and served.headers["content-type"] == "image/webp"


async def test_speaker_photo_is_cropped_square(api: Api) -> None:
    await sign_in_organizer(api)
    status, body = await upload(api, "speaker", image_bytes(size=(900, 500)))
    assert status == 200 and Image.open(file_for(body["url"])).size == (400, 400)


async def test_uploads_are_refused_when_not_allowed(api: Api, other_api: Api) -> None:
    assert (await upload(api, "cover", image_bytes()))[1]["code"] == "not_authenticated"
    await sign_in_organizer(api)
    assert (await upload(api, "cover", image_bytes(), csrf=False))[0] == 403
    assert (await upload(api, "cover", b"GIF89a....", "image/gif"))[0] == 415
    assert (await upload(api, "cover", b"<script>alert(1)</script>", "image/png"))[1]["code"] == "file_not_image"
    too_big = await upload(api, "speaker", image_bytes("BMP", (1100, 1100)), "image/png")
    assert too_big[0] == 413 and too_big[1]["maxMb"] == 2
    assert (await upload(api, "banner", image_bytes()))[1]["code"] == "validation"

    admin = "mutation($e: String!, $p: String!) { adminLogin(email: $e, password: $p) { __typename } }"
    await other_api.gql(admin, {"e": "admin", "p": ADMIN_PASSWORD})
    assert (await upload(other_api, "cover", image_bytes()))[0] == 403


async def test_image_fields_only_accept_our_own_uploads(api: Api) -> None:
    await sign_in_organizer(api)
    for bad in (
        "https://evil.example/x.webp",
        "/uploads/covers/../../app/main.py",
        "/uploads/covers/" + "a" * 32 + ".webp",
    ):
        res = (await api.gql(CREATE, {"input": conf_input(coverUrl=bad)}))["data"]["createConference"]
        assert res["code"] == "VALIDATION", bad
    _, speaker_photo = await upload(api, "speaker", image_bytes())
    res = (await api.gql(CREATE, {"input": conf_input(coverUrl=speaker_photo["url"])}))["data"]["createConference"]
    assert res["code"] == "VALIDATION"  # a speaker photo is not a cover


async def test_replaced_and_deleted_images_are_removed_and_copies_are_independent(api: Api) -> None:
    await sign_in_organizer(api)
    _, first = await upload(api, "cover", image_bytes())
    conf = (await api.gql(CREATE, {"input": conf_input(coverUrl=first["url"])}))["data"]["createConference"]

    copy = (await api.gql(DUPLICATE, {"id": conf["id"]}))["data"]["duplicateConference"]
    copy_cover = (
        await api.gql(
            "query($id: ID!) { myConference(id: $id) { ... on Conference { coverUrl } } }", {"id": copy["id"]}
        )
    )["data"]["myConference"]["coverUrl"]
    assert copy_cover != first["url"] and file_for(copy_cover).is_file()

    _, second = await upload(api, "cover", image_bytes())
    await api.gql(UPDATE, {"id": conf["id"], "input": conf_input(coverUrl=second["url"])})
    assert not file_for(first["url"]).exists()

    await api.gql(DELETE, {"id": conf["id"]})
    assert not file_for(second["url"]).exists()
    assert file_for(copy_cover).is_file()  # the copy still has its own file
