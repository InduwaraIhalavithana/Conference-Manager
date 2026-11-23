"""Fill a v3 database with realistic demo data, or remove it again.

    uv run python -m scripts.seed_demo --yes --password "<choose one>"   # add demo data
    uv run python -m scripts.seed_demo --yes --remove                    # delete everything the seed added

- Demo organizers use @demo.conferencehub.lk addresses and attendees @attendee.demo.conferencehub.lk; both
  domains are on the never-email list, so nobody real is ever written to. Generated images are named demo-*.webp.
- The demo organizers' password is given on the command line each time and never stored anywhere but as a hash.
- What you get: about 24 organizers (one suspended), around 60 conferences across Sri Lanka from five months ago
  to six months ahead (some running today, some in Sinhala or Tamil, some over two days with tracks), agendas
  and speakers with photos, registrations and waitlists, check-ins with arrival times, ratings and comments,
  live Q&A, saved sessions, organizer feedback, contact messages, notifications and activity.
- --remove deletes only demo data (and never the sample organizer of scripts.seed_spike, which CI uses).
- Refuses a production database unless --production is given (for a public demo site).
"""

import argparse
import asyncio
import math
import random
import sys
from datetime import UTC, date, datetime, time, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

from beanie import PydanticObjectId
from PIL import Image, ImageDraw, ImageFilter, ImageFont

from app.core.passwords import hash_password
from app.core.settings import get_settings
from app.db import mongo
from app.models import (
    ActivityLog,
    Admin,
    CheckInEvent,
    Conference,
    ContactMessage,
    Feedback,
    Notification,
    Organizer,
    Question,
    Registration,
    SessionRating,
)
from app.models.common import ActorRef, LocalizedText
from app.models.conference import AgendaSession, ConferenceDay, GeoPoint, Speaker, Track, Venue
from app.models.registration import CheckInMeta
from app.repositories import registrations as registration_repo
from app.services import uploads
from app.services.conferences import slugify

DEMO_DOMAIN = "demo.conferencehub.lk"
ATTENDEE_DOMAIN = f"attendee.{DEMO_DOMAIN}"
SPIKE_ORGANIZER = f"sample.organizer@{DEMO_DOMAIN}"  # scripts.seed_spike's account: CI relies on it, never removed here
ZONE = ZoneInfo("Asia/Colombo")
ORGANIZER_COUNT = 24
rng = random.Random(20261123)

FIRST = ["Nimal", "Kasun", "Dilini", "Sanduni", "Tharindu", "Ishara", "Chamari", "Ruwan", "Nadeesha", "Pradeep",
         "Hasini", "Malith", "Anushka", "Gayan", "Sachini", "Lahiru", "Kavindi", "Dinesh", "Nuwan", "Shehani",
         "Arjun", "Priya", "Karthik", "Meena", "Suresh", "Lakshmi", "Vijay", "Kavitha", "Ramesh", "Shalini",
         "Fathima", "Imran", "Ayesha", "Rizwan", "Zainab", "Nazeer", "Michelle", "Andrew", "Natasha", "Dylan"]  # fmt: skip
LAST = ["Perera", "Fernando", "Silva", "Jayasinghe", "Wickramasinghe", "Bandara", "Gunawardena", "Rajapaksha",
        "Dissanayake", "Herath", "Kumarasinghe", "Ekanayake", "Sivakumar", "Rajendran", "Thurairajah",
        "Selvaratnam", "Arulanandam", "Nadarajah", "Mohamed", "Hassan", "Cassim", "Marikar", "de Silva",
        "Van Twest", "Jansz", "Ratnayake", "Weerasinghe", "Abeysekara", "Mendis", "Senanayake"]  # fmt: skip
ORGS = ["University of Colombo", "University of Peradeniya", "University of Moratuwa", "University of Jaffna",
        "SLIIT", "IIT Sri Lanka", "NSBM Green University", "Sri Lanka Medical Association", "ICTA Sri Lanka",
        "Ceylon Chamber of Commerce", "WSO2", "National Science Foundation", "Sri Lanka Institute of Architects",
        "Colombo Art Biennale", "Lanka Hospitals", "Eastern University", "Open University of Sri Lanka", "SLASSCOM"]  # fmt: skip
JOBS = ["Professor", "Senior Lecturer", "CTO", "Founder", "Research Scientist", "Product Lead", "Consultant",
        "Head of Data", "Medical Officer", "Design Director", "Engineering Manager", "Policy Advisor",
        "Chief Economist", "Curator", "Software Architect", "Public Health Specialist"]  # fmt: skip
CITIES = [
    ("Colombo", "BMICH", "Bauddhaloka Mawatha, Colombo 07", 6.9007, 79.8724),
    ("Colombo", "Shangri-La Hotel", "Galle Face, Colombo 02", 6.9271, 79.8453),
    ("Kandy", "Earl's Regency", "Tennekumbura, Kandy", 7.2797, 80.6700),
    ("Kandy", "University of Peradeniya", "Peradeniya", 7.2547, 80.5972),
    ("Galle", "Galle Fort Hall", "Church Street, Galle", 6.0263, 80.2170),
    ("Jaffna", "Jaffna Public Library Auditorium", "Jaffna", 9.6623, 80.0119),
    ("Negombo", "Jetwing Blue", "Ethukala, Negombo", 7.2283, 79.8410),
    ("Kurunegala", "Kurunegala Town Hall", "Kurunegala", 7.4863, 80.3647),
    ("Batticaloa", "Eastern University", "Vantharumoolai", 7.7929, 81.5793),
    ("Moratuwa", "University of Moratuwa", "Katubedda", 6.7951, 79.9009),
    ("Trincomalee", "Trinco Blu", "Uppuveli, Trincomalee", 8.6026, 81.2205),
]
TOPICS = {
    "tech": ["AI & Machine Learning Summit", "Cloud Native Day", "DevFest", "Cyber Security Forum", "Data Engineering Meetup",
             "Mobile Dev Conference", "Open Source Week", "FinTech Innovation Forum"],
    "health": ["Public Health Symposium", "Digital Health Conference", "Nutrition & Wellbeing Forum", "Mental Health Awareness Summit"],
    "education": ["Teaching with Technology Conference", "STEM Educators Forum", "Higher Education Leaders Summit"],
    "business": ["Startup Pitch Night", "SME Growth Forum", "Export Development Summit", "Women in Leadership Forum"],
    "science": ["Climate & Ocean Science Symposium", "Biodiversity Research Forum", "Agri-Science Innovation Day"],
    "arts": ["Design Week", "Photography Masterclass", "Heritage Architecture Forum", "Film & Media Conference"],
    "other": ["Volunteer Leaders Meetup", "Community Builders Forum"],
}  # fmt: skip
FOCUS = {"tech": "software, data and AI", "health": "public health and patient care", "education": "teaching and learning",
         "business": "growing businesses", "science": "research and discovery", "arts": "art, design and culture",
         "other": "community work"}  # fmt: skip
SUMMARIES = {
    "en": "A day of talks, workshops and networking on {focus} in {city}.",
    "si": "{city} නුවර {focus} පිළිබඳ දේශන, වැඩමුළු සහ හමුවීම් දිනයක්.",
    "ta": "{city} நகரில் {focus} பற்றிய உரைகள், பயிலரங்குகள், சந்திப்புகள் நிறைந்த ஒரு நாள்.",
}
DESCRIPTIONS = [
    "{base} brings together practitioners, researchers and students in {city} for talks, hands-on sessions and "
    "networking on {focus}. Expect practical lessons you can use the next day.",
    "Join speakers from universities, industry and government in {city} for {base}. Keynotes, short case studies "
    "from Sri Lankan teams and small-group workshops, all focused on {focus}.",
    "Now in its third year, {base} returns to {city} with a fuller agenda: panels, live demos and a career corner "
    "for students. Seats are limited, so register early.",
]  # fmt: skip
# Events written first in Sinhala or Tamil, as organizers would publish them (English kept as the required base).
LOCAL_EVENTS = [
    ("si", "arts", "සිංහල සාහිත්‍ය උළෙල", "Sinhala Literature Festival"),
    ("si", "education", "ගුරු සංවර්ධන වැඩමුළුව", "Teacher Development Workshop"),
    ("si", "science", "කෘෂි තාක්ෂණ සම්මන්ත්‍රණය", "Agri-Technology Conference"),
    ("ta", "arts", "தமிழ் இலக்கிய மாநாடு", "Tamil Literature Conference"),
    ("ta", "health", "சமூக சுகாதார மாநாடு", "Community Health Conference"),
    ("ta", "tech", "தொழில்நுட்பக் கண்காட்சி", "Technology Exhibition"),
]
SESSIONS = {
    "keynote": ["Opening keynote", "Closing keynote", "Where the field is heading"],
    "talk": ["Lessons from five years in production", "Building for Sri Lankan users", "A practical introduction",
             "Case study: scaling a national programme", "Measuring what matters", "From research to practice"],
    "workshop": ["Hands-on workshop", "Bring-your-laptop lab", "Design sprint", "Practical clinic"],
    "panel": ["Panel: the next five years", "Panel: funding and partnerships", "Ask the experts"],
    "break": ["Tea break", "Lunch", "Networking break"],
}  # fmt: skip
SESSIONS_LOCAL = {
    "si": {"keynote": "ආරම්භක දේශනය", "talk": "විශේෂ දේශනය", "workshop": "ප්‍රායෝගික වැඩමුළුව", "panel": "සාකච්ඡා මණ්ඩලය", "break": "තේ විවේකය"},
    "ta": {"keynote": "தொடக்க உரை", "talk": "சிறப்புரை", "workshop": "நடைமுறைப் பயிலரங்கு", "panel": "குழு விவாதம்", "break": "தேநீர் இடைவேளை"},
}  # fmt: skip
QUESTIONS = ["Will the slides be shared after the session?", "How would this work for a small team with no budget?",
             "Is there a Sinhala or Tamil version of the material?", "What was the hardest part to get right?",
             "Can students join the follow-up workshop?", "How do you measure success after a year?",
             "Which tools would you recommend for a beginner?", "Will there be a recording?"]  # fmt: skip
COMMENTS = ["Clear and practical, thank you.", "Great examples from Sri Lanka.", "A bit rushed at the end.",
            "Loved the hands-on part.", "The room was too small for the crowd.", "Would like more time for questions.",
            "Best session of the day!", "Slides were hard to read from the back."]  # fmt: skip
FEEDBACK_SUBJECTS = ["Can I export the waitlist too?", "Check-in camera on older phones", "Suggestion: recurring events",
                     "Reminder emails timing", "Thank you for the Tamil translation", "Two organizers on one conference?",
                     "Bulk email to attendees", "Great tool for our faculty"]  # fmt: skip
FEEDBACK_MESSAGES = ["We used ConferenceHub for our last event and wanted to share this with the team.",
                     "Check-in went very smoothly for 180 people. One small idea below.",
                     "Our attendees loved getting the reminder in Sinhala. Could we also customise the text?",
                     "Is there a way to copy last year's agenda into this year's conference?"]  # fmt: skip
CONTACTS = [("Shanika Perera", "attending", "I registered for a conference but cannot find my ticket email. Could you help?"),
            ("Mohamed Rizan", "organizing", "Our university would like to run its research week on ConferenceHub. Who should we talk to?"),
            ("Kumaran Selvam", "partnership", "We are interested in a partnership for our annual business forum."),
            ("Andrea Jansz", "technical", "The camera does not start on my laptop at the check-in desk. Any tips?"),
            ("Ravindu Herath", "general", "Can attendees register for several conferences with the same email address?"),
            ("Priyanthi Rajan", "general", "Thank you for the Tamil interface, it made a big difference for our audience.")]  # fmt: skip
CAT_COLORS = {"tech": ((2, 132, 199), (79, 70, 229)), "health": ((5, 150, 105), (13, 148, 136)),
              "education": ((124, 58, 237), (79, 70, 229)), "business": ((194, 65, 12), (190, 24, 93)),
              "science": ((15, 118, 110), (2, 132, 199)), "arts": ((190, 24, 93), (124, 58, 237)),
              "other": ((71, 85, 105), (30, 64, 175))}  # fmt: skip
PALETTE = [((14, 165, 233), (99, 102, 241)), ((16, 185, 129), (13, 148, 136)), ((244, 114, 182), (168, 85, 247)),
           ((251, 146, 60), (239, 68, 68)), ((56, 189, 248), (16, 185, 129)), ((129, 140, 248), (236, 72, 153))]  # fmt: skip


# ── Images ──────────────────────────────────────────────────────────────────────────────────────────


def font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for folder, name in ((Path("C:/Windows/Fonts"), "segoeuib.ttf"), (Path("C:/Windows/Fonts"), "arialbd.ttf"),
                         (Path("/usr/share/fonts/truetype/dejavu"), "DejaVuSans-Bold.ttf")):  # fmt: skip
        if (folder / name).exists():
            return ImageFont.truetype(str(folder / name), size)
    return ImageFont.load_default(size=size)


def gradient(size: tuple[int, int], a: tuple[int, int, int], b: tuple[int, int, int]) -> Image.Image:
    w, h = size
    img = Image.new("RGB", size)
    draw = ImageDraw.Draw(img)
    for x in range(0, w, 4):  # diagonal-ish: blend by x, the y shading comes from the shapes on top
        t = x / w
        draw.rectangle((x, 0, x + 4, h), fill=tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3)))
    return img


def save(img: Image.Image, folder: str, name: str) -> str:
    target = uploads.ensure_dirs() / folder
    target.mkdir(parents=True, exist_ok=True)
    img.save(target / f"demo-{name}.webp", "WEBP", quality=82)
    return f"{uploads.PUBLIC_PREFIX}/{folder}/demo-{name}.webp"


def portrait(name: str, key: str, folder: str) -> str:
    a, b = PALETTE[sum(map(ord, name)) % len(PALETTE)]
    img = gradient((400, 400), a, b)
    d = ImageDraw.Draw(img, "RGBA")
    d.ellipse((120, 70, 280, 230), fill=(255, 255, 255, 70))
    d.ellipse((50, 250, 350, 520), fill=(255, 255, 255, 60))
    initials = "".join(p[0] for p in name.replace("Dr. ", "").replace("Prof. ", "").split()[:2]).upper()
    f = font(120)
    box = d.textbbox((0, 0), initials, font=f)
    d.text(
        ((400 - (box[2] - box[0])) / 2, (400 - (box[3] - box[1])) / 2 - 30), initials, font=f, fill=(255, 255, 255, 235)
    )
    return save(img, folder, key)


def cover(category: str, key: str) -> str:
    a, b = CAT_COLORS[category]
    img = gradient((1600, 900), a, b)
    d = ImageDraw.Draw(img, "RGBA")
    for _ in range(9):
        r = rng.randint(80, 360)
        x, y = rng.randint(-100, 1600), rng.randint(-100, 900)
        d.ellipse((x - r, y - r, x + r, y + r), fill=(255, 255, 255, rng.randint(14, 34)))
    for i in range(14):
        y = 560 + i * 26
        d.line((0, y + math.sin(i) * 20, 1600, y - 80 + math.cos(i) * 30), fill=(255, 255, 255, 26), width=3)
    return save(img.filter(ImageFilter.GaussianBlur(1.2)), "covers", key)


# ── Data ────────────────────────────────────────────────────────────────────────────────────────────


def person() -> tuple[str, str]:
    return rng.choice(FIRST), rng.choice(LAST)


def local(day: date, at: time) -> datetime:
    return datetime.combine(day, at, tzinfo=ZONE).astimezone(UTC)


def agenda(conf: Conference, lang: str, days: list[date], start: time, end: time) -> None:
    """Speakers (with photos), tracks for two-day events, and a timetable for each day."""
    conf.speakers = []
    for _ in range(rng.randint(3, 6)):
        fn, ln = person()
        name = f"{rng.choice(['Dr. ', 'Prof. ', '', '', ''])}{fn} {ln}"
        sp = Speaker(name=name, job_title=rng.choice(JOBS), organization=rng.choice(ORGS),
                     bio=LocalizedText(en=f"{fn} works on {FOCUS[conf.category]} and speaks at regional conferences."))  # fmt: skip
        sp.photo_url = portrait(name, f"sp-{conf.slug[:20]}-{sp.id}", "speakers")
        conf.speakers.append(sp)
    if len(days) > 1:
        conf.tracks = [
            Track(name=LocalizedText(en="Main stage"), color="#0ea5e9"),
            Track(name=LocalizedText(en="Workshops"), color="#10b981"),
        ]
        conf.days = [ConferenceDay(date=d, label=LocalizedText(en=f"Day {i + 1}")) for i, d in enumerate(days)]
    used: set[str] = set()
    for day in days:
        minute = start.hour * 60 + start.minute
        for kind in [
            "keynote",
            *rng.sample(["talk", "talk", "workshop", "panel", "talk"], k=3),
            "break",
            "talk",
            "panel",
        ]:
            length = 15 if kind == "break" else rng.choice([30, 45, 60])
            if minute + length > end.hour * 60 + end.minute:
                break
            fresh = [t for t in SESSIONS[kind] if t not in used] or SESSIONS[
                kind
            ]  # no repeated titles in one conference
            en_title = rng.choice(fresh)
            used.add(en_title)
            title = LocalizedText(en=en_title, **({lang: SESSIONS_LOCAL[lang][kind]} if lang in SESSIONS_LOCAL else {}))
            conf.sessions.append(AgendaSession(
                day=day, kind=kind, title=title,
                starts_at=local(day, time(minute // 60, minute % 60)),
                ends_at=local(day, time((minute + length) // 60, (minute + length) % 60)),
                room=None if kind == "break" else rng.choice(["Main hall", "Hall B", "Lab 1", "Auditorium"]),
                speaker_ids=[] if kind == "break" else [rng.choice(conf.speakers).id],
                track_id=(conf.tracks[1].id if kind == "workshop" else conf.tracks[0].id) if conf.tracks and kind != "break" else None,
            ))  # fmt: skip
            minute += length


async def people_for(
    conf: Conference, org: Organizer, now: datetime, admins: list[Admin], counts: dict[str, int]
) -> None:
    """Registrations (and waitlist), check-ins with arrival times, ratings, Q&A, saved sessions, notifications."""
    assert conf.id is not None and org.id is not None
    cap = conf.capacity
    wanted = int((cap or rng.randint(50, 180)) * rng.uniform(0.45, 1.3))
    window_end = min(now, conf.starts_at)
    span = max(60.0, (window_end - conf.created_at).total_seconds())
    ended, running = conf.ends_at < now, conf.starts_at <= now <= conf.ends_at
    regs: list[Registration] = []
    seats = 0
    emails: set[str] = set()
    for _ in range(wanted):
        fn, ln = person()
        email = f"{fn}.{ln}{rng.randint(1, 999)}".lower().replace(" ", "") + f"@{ATTENDEE_DOMAIN}"
        if email in emails:
            continue
        emails.add(email)
        seat = cap is None or seats < cap
        seats += seat
        at = conf.created_at + timedelta(seconds=(rng.random() ** 0.8) * span)  # interest builds towards the event
        reg = Registration(id=PydanticObjectId(), conference_id=conf.id, name=f"{fn} {ln}", email=email, lang=rng.choice(["en", "en", "si", "ta"]),
                           status="registered" if seat else "waitlisted", confirmed_at=at + timedelta(minutes=rng.randint(1, 120)),
                           created_at=at, updated_at=at)  # fmt: skip
        if seat and (ended and rng.random() < rng.uniform(0.62, 0.92) or running and rng.random() < 0.6):
            late = (now - conf.starts_at).total_seconds() if running else 3 * 3600
            reg.checked_in_at = (
                conf.starts_at - timedelta(minutes=30) + timedelta(seconds=rng.random() * min(late, 3 * 3600))
            )
        if seat and not ended and conf.sessions and rng.random() < 0.3:
            reg.bookmarked_session_ids = [
                s.id for s in rng.sample(conf.sessions, k=min(3, len(conf.sessions))) if s.kind != "break"
            ]
        if ended and reg.checked_in_at:
            reg.feedback_requested_at = conf.ends_at + timedelta(days=1)
        regs.append(reg)
    if regs:  # ids are set above: insert_many does not hand them back, and ratings, check-ins and Q&A link to them
        await Registration.insert_many(regs)
    counts["registrations"] += len(regs)

    arrived = [r for r in regs if r.checked_in_at]
    if arrived:
        await CheckInEvent.insert_many([CheckInEvent(at=r.checked_in_at, meta=CheckInMeta(conference_id=conf.id), registration_id=r.id)
                                        for r in arrived])  # fmt: skip
    talks = [s for s in conf.sessions if s.kind != "break"]
    ratings: list[SessionRating] = []
    for r in arrived if ended else []:
        if rng.random() > 0.45:
            continue
        for s in [None, *rng.sample(talks, k=min(len(talks), rng.randint(1, 3)))]:
            score = rng.choices([5, 4, 3, 2, 1], weights=[45, 32, 14, 6, 3])[0]
            comment = rng.choice(COMMENTS) if rng.random() < 0.25 else None
            ratings.append(SessionRating(conference_id=conf.id, registration_id=r.id, session_id=s.id if s else None,
                                         score=score, comment=comment, created_at=conf.ends_at + timedelta(hours=rng.randint(2, 60))))  # fmt: skip
    if ratings:
        await SessionRating.insert_many(ratings)
    counts["ratings"] += len(ratings)

    askers = [r for r in regs if r.status == "registered"]
    questions: list[Question] = []
    if (ended or running) and askers:
        for s in talks:
            if s.starts_at > now:
                continue
            for _ in range(rng.randint(0, 5)):
                author = rng.choice(askers)
                voters = rng.sample(askers, k=min(len(askers), rng.randint(0, 12)))
                ids = [v.id for v in voters if v.id != author.id]
                questions.append(Question(conference_id=conf.id, session_id=s.id, registration_id=author.id,
                                          author_name=author.name.split()[0], text=rng.choice(QUESTIONS), voter_ids=ids, votes=len(ids),
                                          status="answered" if ended or rng.random() < 0.4 else "open",
                                          created_at=s.starts_at + timedelta(minutes=rng.randint(5, 40))))  # fmt: skip
    if questions:
        await Question.insert_many(questions)
    counts["questions"] += len(questions)

    notes = [Notification(recipient=ActorRef(type="organizer", id=org.id),
                          kind="new_waitlist" if r.status == "waitlisted" else "new_registration",
                          params={"name": r.name, "title": conf.title.en, "demo": True},
                          link=f"/dashboard/conferences/{conf.id}/attendees",
                          read_at=r.created_at if rng.random() < 0.5 else None, created_at=r.created_at)
             for r in regs if r.created_at > now - timedelta(days=6) and rng.random() < 0.35]  # fmt: skip
    if notes:
        await Notification.insert_many(notes)
    counters = await registration_repo.counts_by_status(conf.id)  # the same numbers the nightly check expects
    await conf.set({"counters": counters})


async def seed(password: str) -> None:
    demo = {"email": {"$regex": f"@{DEMO_DOMAIN.replace('.', '[.]')}$", "$ne": SPIKE_ORGANIZER}}
    if await Organizer.find_one(demo):
        sys.exit("Demo data is already there. Run with --remove first.")
    now = datetime.now(UTC)
    today = now.astimezone(ZONE).date()
    admins = await Admin.find_all().to_list()
    pw_hash = hash_password(password)
    counts = {"organizers": 0, "conferences": 0, "registrations": 0, "ratings": 0, "questions": 0}

    organizers: list[Organizer] = []
    used: set[tuple[str, str]] = set()
    while len(organizers) < ORGANIZER_COUNT:
        fn, ln = person()
        if (fn, ln) in used:
            continue
        used.add((fn, ln))
        created = now - timedelta(days=rng.randint(30, 200), hours=rng.randint(0, 23))
        org = Organizer(first_name=fn, last_name=ln, email=f"{fn}.{ln}".lower().replace(" ", "") + f"@{DEMO_DOMAIN}",
                        password_hash=pw_hash, phone=f"+94 7{rng.randint(0, 8)} {rng.randint(100, 999)} {rng.randint(1000, 9999)}",
                        organization=rng.choice(ORGS), lang=rng.choice(["en", "en", "si", "ta"]),
                        bio=LocalizedText(en="Organizes conferences and community events across Sri Lanka."),
                        is_suspended=len(organizers) == ORGANIZER_COUNT - 1,
                        created_at=created, updated_at=created, email_verified_at=created + timedelta(minutes=rng.randint(2, 90)))  # fmt: skip
        await org.insert()
        org.avatar_url = portrait(f"{fn} {ln}", f"org-{org.id}", "avatars") if rng.random() < 0.95 else None
        await org.save()
        organizers.append(org)
    counts["organizers"] = len(organizers)

    # Days from today: some today and this week, then spread over the coming six months and the last five.
    near = [0, 0, 1, 2, 3, 4, 5, 7, 9, 11, 14, 17, 21, 25, 30]
    rng.shuffle(near)
    locals_left = list(LOCAL_EVENTS)
    rng.shuffle(locals_left)
    slugs: set[str] = set()
    for org in organizers[:-1]:  # the suspended account keeps no conferences
        assert org.id is not None
        for _ in range(rng.randint(2, 3)):
            offset = near.pop() if near else (rng.randint(1, 175) if rng.random() < 0.55 else rng.randint(-150, -2))
            first_day = today + timedelta(days=offset)
            two_days = rng.random() < 0.15 and offset != 0
            days = [first_day, first_day + timedelta(days=1)] if two_days else [first_day]
            city, venue, address, lat, lng = rng.choice(CITIES)
            if locals_left and rng.random() < 0.15:
                lang, category, native, english = locals_left.pop()
                title = LocalizedText(en=f"{english} {first_day.year}", **{lang: f"{native} {first_day.year}"})
                description = LocalizedText(en=f"{english} in {city}: talks, workshops and time to meet people.")
            else:
                lang, category = "en", rng.choice(list(TOPICS))
                base = rng.choice(TOPICS[category])
                title = LocalizedText(
                    en=f"{base} {city} {first_day.year}" if rng.random() < 0.6 else f"{base} {first_day.year}"
                )
                description = LocalizedText(
                    en=rng.choice(DESCRIPTIONS).format(base=base, city=city, focus=FOCUS[category])
                )
            summary = LocalizedText(**{k: v.format(focus=FOCUS[category], city=city) for k, v in SUMMARIES.items()})
            start = (
                time(8, 30)
                if offset == 0 and rng.random() < 0.5
                else time(rng.choice([8, 9, 9, 10, 13]), rng.choice([0, 30]))
            )
            end = time(min(start.hour + rng.randint(5, 9), 21), start.minute)
            slug = slugify(title.en)
            while slug in slugs or await Conference.find_one({"slug": slug}):
                slug = f"{slugify(title.en)[:52]}-{rng.randint(100, 999)}"
            slugs.add(slug)
            starts_at, ends_at = local(days[0], start), local(days[-1], end)
            created = min(now, starts_at) - timedelta(days=rng.randint(20, 85))
            status = "draft" if offset > 60 and rng.random() < 0.12 else "published"
            conf = Conference(
                organizer_id=org.id, slug=slug, status=status, title=title, summary=summary, description=description,
                source_lang=lang, category=category, tags=[category, city.lower()],
                venue=Venue(name=venue, address=address, city=city,
                            location=GeoPoint(coordinates=(lng + rng.uniform(-0.002, 0.002), lat + rng.uniform(-0.002, 0.002)))),
                starts_at=starts_at, ends_at=ends_at, capacity=rng.choice([None, 40, 60, 80, 100, 120, 150, 200, 300]),
                created_at=created, updated_at=created, published_at=created if status == "published" else None,
                reminders_sent_at=starts_at - timedelta(days=1) if starts_at < now + timedelta(days=1) else None,
            )  # fmt: skip
            if rng.random() < 0.9:
                conf.cover_url = cover(category, slug[:40])
            agenda(conf, lang, days, start, end)
            await conf.insert()
            counts["conferences"] += 1
            await ActivityLog(actor=ActorRef(type="organizer", id=org.id), action="conference_created", target=slug,
                              meta={"demo": True}, created_at=created).insert()  # fmt: skip
            if status == "published":
                await people_for(conf, org, now, admins, counts)

    # Sign-ins and edits for the activity log; organizer feedback (some answered); contact messages.
    activity = [ActivityLog(actor=ActorRef(type="organizer", id=org.id), action=rng.choice(["login", "login", "conference_updated", "update_profile"]),
                            target=org.email, meta={"demo": True}, created_at=now - timedelta(hours=rng.randint(1, 240)))
                for org in organizers[:-1] for _ in range(rng.randint(1, 4))]  # fmt: skip
    await ActivityLog.insert_many(activity)
    for subject in FEEDBACK_SUBJECTS:
        org = rng.choice(organizers[:-1])
        created = now - timedelta(days=rng.randint(0, 40), hours=rng.randint(0, 23))
        replied = rng.random() < 0.55
        await Feedback(organizer_id=org.id, subject=subject, message=rng.choice(FEEDBACK_MESSAGES),
                       status="replied" if replied else "open", created_at=created,
                       reply="Thanks for writing in. We have noted this and will follow up soon." if replied else None,
                       replied_at=created + timedelta(hours=6) if replied else None).insert()  # fmt: skip
        for admin in admins:
            await Notification(recipient=ActorRef(type="admin", id=admin.id), kind="new_feedback",
                               params={"organizer": f"{org.first_name} {org.last_name}", "subject": subject, "demo": True},
                               link="/admin/inbox", read_at=created if replied else None, created_at=created).insert()  # fmt: skip
    for i, (name, topic, message) in enumerate(CONTACTS):
        created = now - timedelta(days=rng.randint(0, 20))
        await ContactMessage(name=name, email=f"contact{i}@{DEMO_DOMAIN}", subject=topic, message=message,
                             status="open" if i < 4 else "resolved", resolved_at=None if i < 4 else created + timedelta(days=1),
                             created_at=created).insert()  # fmt: skip
    for org in organizers[:6]:
        for admin in admins:
            await Notification(recipient=ActorRef(type="admin", id=admin.id), kind="new_organizer",
                               params={"name": f"{org.first_name} {org.last_name}", "demo": True},
                               link="/admin/organizers", read_at=org.created_at, created_at=org.created_at).insert()  # fmt: skip

    print("Added " + ", ".join(f"{n} {what}" for what, n in counts.items()) + ".")
    print(
        f"Demo organizers sign in with any *@{DEMO_DOMAIN} address (see the admin's Organizers page) and the password you gave."
    )


async def remove() -> None:
    demo = {"email": {"$regex": f"@{DEMO_DOMAIN.replace('.', '[.]')}$", "$ne": SPIKE_ORGANIZER}}
    orgs = await Organizer.find(demo).to_list()
    org_ids = [o.id for o in orgs]
    confs = await Conference.find({"organizer_id": {"$in": org_ids}}).to_list()
    conf_ids: list[PydanticObjectId | None] = [c.id for c in confs]
    images = (
        [o.avatar_url for o in orgs] + [c.cover_url for c in confs] + [s.photo_url for c in confs for s in c.speakers]
    )
    reg_ids = [r.id for r in await Registration.find({"conference_id": {"$in": conf_ids}}).to_list()]
    for model, query in (
        (CheckInEvent, {"meta.conference_id": {"$in": conf_ids}}),
        (SessionRating, {"conference_id": {"$in": conf_ids}}),
        (Question, {"conference_id": {"$in": conf_ids}}),
        (Registration, {"_id": {"$in": reg_ids}}),
        (Conference, {"_id": {"$in": conf_ids}}),
        (Feedback, {"organizer_id": {"$in": org_ids}}),
        (ActivityLog, {"actor.id": {"$in": org_ids}}),
        (Notification, {"$or": [{"recipient.id": {"$in": org_ids}}, {"params.demo": True}]}),
        (ContactMessage, {"email": {"$regex": f"@{DEMO_DOMAIN.replace('.', '[.]')}$"}}),
        (Organizer, {"_id": {"$in": org_ids}}),
    ):
        await model.get_pymongo_collection().delete_many(query)
    removed = 0
    root = uploads.upload_root()
    for url in images:
        path = root / url.removeprefix(f"{uploads.PUBLIC_PREFIX}/") if url else None
        if path and path.is_file():
            path.unlink()
            removed += 1
    for folder in ("avatars", "speakers", "covers"):
        for f in (root / folder).glob("demo-*.webp"):
            f.unlink()
            removed += 1
    print(
        f"Removed {len(orgs)} demo organizers, {len(confs)} conferences with everything in them, and {removed} images."
    )


async def main(args: argparse.Namespace) -> int:
    settings = get_settings()
    print(f"Database: {settings.mongo_db}")
    if settings.is_production and not args.production:
        print("This is a production database: add --production to really mean it.", file=sys.stderr)
        return 2
    if not args.yes:
        print("Nothing changed. Add --yes to confirm this is the database you mean.", file=sys.stderr)
        return 2
    if not args.remove and (not args.password or len(args.password) < 10):
        print(
            "Give the demo organizers' password with --password (10 characters or more). It is never stored.",
            file=sys.stderr,
        )
        return 2
    await mongo.connect(settings.mongo_url, settings.mongo_db)
    await (remove() if args.remove else seed(args.password))
    return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--yes", action="store_true", help="confirm you want to change this database")
    parser.add_argument("--remove", action="store_true", help="delete the demo data instead of adding it")
    parser.add_argument("--password", help="password for every demo organizer (required when adding; never stored)")
    parser.add_argument("--production", action="store_true", help="allow a production database")
    sys.exit(asyncio.run(main(parser.parse_args())))
