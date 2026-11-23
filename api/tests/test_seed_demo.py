"""The demo seed: needs --yes and a password, only uses demo addresses, links everything to real registrations,
and --remove takes everything away again (images too) without touching the CI sample organizer."""

import argparse
from pathlib import Path

import pytest

from app.core.settings import get_settings
from app.models import CheckInEvent, Conference, Organizer, Question, Registration, SessionRating
from scripts import seed_demo


def args(**kw: object) -> argparse.Namespace:
    return argparse.Namespace(
        **{"yes": True, "remove": False, "password": "demo-password-123", "production": False, **kw}
    )


def demo_images(root: Path) -> list[Path]:
    return list(root.rglob("demo-*.webp"))


async def test_the_demo_seed_adds_and_removes_only_demo_data(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(seed_demo, "ORGANIZER_COUNT", 10)  # enough for some conferences in the past
    monkeypatch.setattr(get_settings(), "upload_dir", str(tmp_path))
    await seed_demo.remove()  # a clean start, whatever another run left
    if not await Organizer.find_one({"email": seed_demo.SPIKE_ORGANIZER}):
        await Organizer(
            first_name="Sample", last_name="Organizer", email=seed_demo.SPIKE_ORGANIZER, password_hash="x"
        ).insert()

    assert await seed_demo.main(args(yes=False)) == 2  # nothing without --yes
    assert await seed_demo.main(args(password=None)) == 2  # nor without a password
    assert await seed_demo.main(args()) == 0

    demo = {"email": {"$regex": "@demo[.]conferencehub[.]lk$", "$ne": seed_demo.SPIKE_ORGANIZER}}
    orgs = await Organizer.find(demo).to_list()
    assert len(orgs) == 10 and sum(o.is_suspended for o in orgs) == 1
    org_ids = [o.id for o in orgs]
    confs = await Conference.find({"organizer_id": {"$in": org_ids}}).to_list()
    assert confs and all(c.sessions and c.speakers for c in confs)
    for c in confs:  # sessions sit on the conference's days, as the app keeps them (the agenda shows them by day)
        assert c.days and {s.day for s in c.sessions} <= {d.date for d in c.days}
    in_confs = {"$in": [c.id for c in confs]}
    regs = await Registration.find({"conference_id": in_confs}).to_list()
    assert regs and all(r.email.endswith("@attendee.demo.conferencehub.lk") for r in regs)
    for c in confs:  # the counters match the registrations
        seated = sum(1 for r in regs if r.conference_id == c.id and r.status == "registered")
        assert c.counters.registered == seated
    assert demo_images(tmp_path)

    # Check-ins, ratings and questions all point at real registrations.
    events = await CheckInEvent.find({"meta.conference_id": in_confs}).to_list()
    ratings = await SessionRating.find({"conference_id": in_confs}).to_list()
    questions = await Question.find({"conference_id": in_confs}).to_list()
    assert events and ratings and questions
    asked = [(q.session_id, q.text) for q in questions]
    assert len(asked) == len(set(asked))  # no session repeats a question
    linked = (
        {e.registration_id for e in events}
        | {x.registration_id for x in ratings}
        | {q.registration_id for q in questions}
    )
    assert linked <= {r.id for r in regs}

    with pytest.raises(SystemExit):  # a second seed refuses
        await seed_demo.seed("demo-password-123")

    await seed_demo.remove()
    assert await Organizer.find(demo).count() == 0
    assert await Conference.find({"organizer_id": {"$in": org_ids}}).count() == 0
    assert await CheckInEvent.find({"meta.conference_id": in_confs}).count() == 0
    assert demo_images(tmp_path) == []
    assert await Organizer.find_one({"email": seed_demo.SPIKE_ORGANIZER}) is not None
