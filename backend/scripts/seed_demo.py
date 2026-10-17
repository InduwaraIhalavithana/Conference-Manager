"""Fill the database with realistic demo data, or remove it again.

    python -m scripts.seed_demo --yes                 # add demo data
    python -m scripts.seed_demo --yes --password X    # choose the demo organizers' password
    python -m scripts.seed_demo --remove --yes        # delete everything the seed added

Demo organizers use @demo.conferencehub.lk addresses and demo images are named demo-*.webp,
so --remove deletes only demo data and never touches real accounts.
Run from the backend folder with the backend virtual environment's Python.
"""
from __future__ import annotations

import argparse
import math
import random
import sys
from datetime import UTC, date, datetime, time, timedelta
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont
from sqlalchemy import delete, select

from app.core.config import UPLOAD_DIR
from app.core.security import hash_password
from app.core.tickets import new_ticket_code
from app.core.uploads import delete_image
from app.db.database import SessionLocal, engine
from app.models.activity import ActivityLog
from app.models.admin import Admin
from app.models.agenda import Session as AgendaSession
from app.models.agenda import Speaker
from app.models.attendee import REGISTERED, WAITLISTED, Attendee
from app.models.conference import Conference
from app.models.contact import ContactMessage
from app.models.feedback import Feedback
from app.models.notification import Notification
from app.models.organizer import Organizer

DEMO_DOMAIN = "demo.conferencehub.lk"
ATTENDEE_DOMAIN = "attendee.demo.conferencehub.lk"
rng = random.Random(20261017)

FIRST = ["Nimal", "Kasun", "Dilini", "Sanduni", "Tharindu", "Ishara", "Chamari", "Ruwan", "Nadeesha", "Pradeep",
         "Hasini", "Malith", "Anushka", "Gayan", "Sachini", "Lahiru", "Kavindi", "Dinesh", "Nuwan", "Shehani",
         "Arjun", "Priya", "Karthik", "Meena", "Suresh", "Lakshmi", "Vijay", "Kavitha", "Ramesh", "Shalini",
         "Fathima", "Imran", "Ayesha", "Rizwan", "Zainab", "Nazeer", "Michelle", "Andrew", "Natasha", "Dylan"]
LAST = ["Perera", "Fernando", "Silva", "Jayasinghe", "Wickramasinghe", "Bandara", "Gunawardena", "Rajapaksha",
        "Dissanayake", "Herath", "Kumarasinghe", "Ekanayake", "Sivakumar", "Rajendran", "Thurairajah",
        "Selvaratnam", "Arulanandam", "Nadarajah", "Mohamed", "Hassan", "Cassim", "Marikar", "de Silva",
        "Van Twest", "Jansz", "Ratnayake", "Weerasinghe", "Abeysekara", "Mendis", "Senanayake"]
ORGS = ["University of Colombo", "University of Peradeniya", "University of Moratuwa", "University of Jaffna",
        "SLIIT", "IIT Sri Lanka", "NSBM Green University", "Sri Lanka Medical Association", "ICTA Sri Lanka",
        "Ceylon Chamber of Commerce", "WSO2", "Dialog Axiata", "John Keells IT", "Virtusa", "Hemas Holdings",
        "National Science Foundation", "Sri Lanka Institute of Architects", "Colombo Art Biennale",
        "Lanka Hospitals", "Eastern University", "Open University of Sri Lanka", "SLASSCOM"]
JOBS = ["Professor", "Senior Lecturer", "CTO", "Founder", "Research Scientist", "Product Lead", "Consultant",
        "Head of Data", "Medical Officer", "Design Director", "Engineering Manager", "Policy Advisor",
        "Chief Economist", "Curator", "Software Architect", "Public Health Specialist"]

CITIES = [
    ("Colombo", "BMICH, Bauddhaloka Mawatha, Colombo 07", 6.9007, 79.8724),
    ("Colombo", "Shangri-La Hotel, Galle Face, Colombo 02", 6.9271, 79.8453),
    ("Colombo", "Hilton Colombo, Echelon Square, Colombo 01", 6.9333, 79.8445),
    ("Kandy", "Earl's Regency, Tennekumbura, Kandy", 7.2797, 80.6700),
    ("Kandy", "University of Peradeniya, Peradeniya", 7.2547, 80.5972),
    ("Galle", "Jetwing Lighthouse, Dadella, Galle", 6.0445, 80.1957),
    ("Galle", "Galle Fort Hall, Church Street, Galle", 6.0263, 80.2170),
    ("Jaffna", "Jaffna Public Library Auditorium, Jaffna", 9.6623, 80.0119),
    ("Jaffna", "University of Jaffna, Thirunelvely", 9.6845, 80.0225),
    ("Negombo", "Jetwing Blue, Ethukala, Negombo", 7.2283, 79.8410),
    ("Kurunegala", "Kurunegala Town Hall, Kurunegala", 7.4863, 80.3647),
    ("Batticaloa", "Eastern University, Vantharumoolai", 7.7929, 81.5793),
    ("Moratuwa", "University of Moratuwa, Katubedda", 6.7951, 79.9009),
    ("Malabe", "SLIIT Campus, New Kandy Road, Malabe", 6.9147, 79.9729),
    ("Trincomalee", "Trinco Blu, Uppuveli, Trincomalee", 8.6026, 81.2205),
]

TOPICS = {
    "Tech": ["AI & Machine Learning Summit", "Cloud Native Day", "DevFest", "Cyber Security Forum", "Data Engineering Meetup",
             "Mobile Dev Conference", "Open Source Week", "FinTech Innovation Forum", "Web Performance Day"],
    "Health": ["Public Health Symposium", "Digital Health Conference", "Nutrition & Wellbeing Forum",
               "Mental Health Awareness Summit", "Tropical Medicine Update"],
    "Education": ["Teaching with Technology Conference", "STEM Educators Forum", "Higher Education Leaders Summit",
                  "Early Childhood Learning Workshop", "Language Teaching Seminar"],
    "Business": ["Startup Pitch Night", "SME Growth Forum", "Export Development Summit", "Women in Leadership Forum",
                 "Tourism Industry Outlook"],
    "Science": ["Climate & Ocean Science Symposium", "Biodiversity Research Forum", "Physics Frontiers Seminar",
                "Agri-Science Innovation Day"],
    "Arts": ["Design Week", "Photography Masterclass", "Heritage Architecture Forum", "Literary Festival Talks",
             "Film & Media Conference"],
    "Other": ["Volunteer Leaders Meetup", "Sports Management Seminar", "Community Builders Forum"],
}
CAT_COLORS = {"Tech": ((2, 132, 199), (79, 70, 229)), "Health": ((5, 150, 105), (13, 148, 136)),
              "Education": ((124, 58, 237), (79, 70, 229)), "Business": ((194, 65, 12), (190, 24, 93)),
              "Science": ((15, 118, 110), (2, 132, 199)), "Arts": ((190, 24, 93), (124, 58, 237)),
              "Other": ((71, 85, 105), (30, 64, 175))}
SESSION_TEMPLATES = {
    "keynote": ["Opening keynote", "Closing keynote", "Where the field is heading"],
    "talk": ["Lessons from five years in production", "Building for Sri Lankan users", "A practical introduction",
             "Case study: scaling a national programme", "Measuring what matters", "From research to practice"],
    "workshop": ["Hands-on workshop", "Bring-your-laptop lab", "Design sprint", "Practical clinic"],
    "panel": ["Panel: the next five years", "Panel: funding and partnerships", "Ask the experts"],
    "break": ["Tea break", "Lunch", "Networking break"],
}


def font(size: int, bold: bool = True) -> ImageFont.FreeTypeFont:
    for name in (["segoeuib.ttf", "arialbd.ttf"] if bold else ["segoeui.ttf", "arial.ttf"]):
        for folder in (Path("C:/Windows/Fonts"), Path("/usr/share/fonts/truetype/dejavu")):
            p = folder / name
            if p.exists():
                return ImageFont.truetype(str(p), size)
    return ImageFont.load_default(size=size)


def gradient(size: tuple[int, int], a: tuple[int, int, int], b: tuple[int, int, int], diagonal=True) -> Image.Image:
    w, h = size
    img = Image.new("RGB", size)
    px = img.load()
    for y in range(h):
        for x in range(0, w, 2):
            t = ((x / w) * 0.6 + (y / h) * 0.4) if diagonal else y / h
            c = tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))
            px[x, y] = c
            if x + 1 < w:
                px[x + 1, y] = c
    return img


def save(img: Image.Image, folder: str, name: str) -> str:
    target = UPLOAD_DIR / folder
    target.mkdir(parents=True, exist_ok=True)
    img.save(target / f"{name}.webp", "WEBP", quality=82)
    return f"/uploads/{folder}/{name}.webp"


def make_avatar(name: str, key: str, folder: str = "avatars") -> str:
    """A friendly generated portrait: gradient, soft shapes, initials."""
    palette = [((14, 165, 233), (99, 102, 241)), ((16, 185, 129), (13, 148, 136)), ((244, 114, 182), (168, 85, 247)),
               ((251, 146, 60), (239, 68, 68)), ((56, 189, 248), (16, 185, 129)), ((129, 140, 248), (236, 72, 153))]
    a, b = palette[sum(map(ord, name)) % len(palette)]
    img = gradient((400, 400), a, b)
    d = ImageDraw.Draw(img, "RGBA")
    d.ellipse((120, 70, 280, 230), fill=(255, 255, 255, 70))          # head
    d.ellipse((50, 250, 350, 520), fill=(255, 255, 255, 60))          # shoulders
    initials = "".join(p[0] for p in name.split()[:2]).upper()
    f = font(120)
    box = d.textbbox((0, 0), initials, font=f)
    d.text(((400 - (box[2] - box[0])) / 2, (400 - (box[3] - box[1])) / 2 - 30), initials, font=f,
           fill=(255, 255, 255, 235))
    return save(img, folder, f"demo-{key}")


def make_cover(category: str, key: str) -> str:
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
    img = img.filter(ImageFilter.GaussianBlur(1.2))
    return save(img, "covers", f"demo-{key}")


def person() -> tuple[str, str]:
    return rng.choice(FIRST), rng.choice(LAST)


def seed(password: str) -> None:
    now = datetime.now(UTC)
    today = date.today()
    with SessionLocal() as db:
        if db.execute(select(Organizer.id).where(Organizer.email.like(f"%@{DEMO_DOMAIN}"))).first():
            sys.exit("Demo data is already there. Run with --remove first.")
        admin_ids = list(db.execute(select(Admin.id)).scalars())
        pw_hash = hash_password(password)

        organizers: list[Organizer] = []
        used = set()
        for i in range(24):
            while True:
                fn, ln = person()
                if (fn, ln) not in used:
                    used.add((fn, ln))
                    break
            org = Organizer(
                first_name=fn, last_name=ln, email=f"{fn}.{ln}".lower().replace(" ", "") + f"@{DEMO_DOMAIN}",
                password_hash=pw_hash, phone=f"+94 7{rng.randint(0, 8)} {rng.randint(100, 999)} {rng.randint(1000, 9999)}",
                organization=rng.choice(ORGS), lang=rng.choice(["en", "en", "si", "ta"]),
                bio="Organizes conferences and community events across Sri Lanka.",
                is_suspended=(i == 23),
            )
            org.created_at = now - timedelta(days=rng.randint(3, 170), hours=rng.randint(0, 23))
            db.add(org)
            organizers.append(org)
        db.flush()
        for org in organizers:
            if rng.random() < 0.85:
                org.avatar = make_avatar(f"{org.first_name} {org.last_name}", f"org-{org.id}")

        conf_count = 0
        for org in organizers:
            for _ in range(rng.randint(2, 4)):
                category = rng.choice(list(TOPICS))
                base = rng.choice(TOPICS[category])
                city, venue, lat, lng = rng.choice(CITIES)
                offset = rng.randint(-150, 160)
                day = today + timedelta(days=offset)
                start = time(rng.choice([8, 9, 9, 10, 13, 14]), rng.choice([0, 0, 30]))
                end = time(min(start.hour + rng.randint(3, 8), 21), start.minute)
                cap = rng.choice([None, 40, 60, 80, 100, 120, 150, 200, 300])
                title = f"{base} {city} {day.year}" if rng.random() < 0.6 else f"{base} {day.year}"
                conf = Conference(
                    organizer_id=org.id, title=title,
                    description=(f"{base} brings together practitioners, researchers and students in {city} for a day of "
                                 f"talks, hands-on sessions and networking. Expect practical lessons you can use the next "
                                 f"day, local case studies and plenty of time to meet people working on the same problems."),
                    date=day, time=start, end_time=end, location=f"{venue}, Sri Lanka",
                    venue_lat=lat + rng.uniform(-0.002, 0.002), venue_lng=lng + rng.uniform(-0.002, 0.002),
                    max_attendees=cap, status="draft" if (offset > 60 and rng.random() < 0.15) else "published",
                    category=category,
                )
                # Published 3 to 12 weeks before the event (or before today), so registrations spread out.
                conf.created_at = min(now, datetime.combine(day, start, tzinfo=UTC)) - timedelta(days=rng.randint(20, 85))
                db.add(conf)
                db.flush()
                conf_count += 1
                if rng.random() < 0.85:
                    conf.cover_image = make_cover(category, f"cover-{conf.id}")
                db.add(ActivityLog(organizer_id=org.id, action="create_conference", target=title,
                                   created_at=conf.created_at))

                # Speakers and agenda
                speakers = []
                for p in range(rng.randint(2, 5)):
                    fn, ln = person()
                    sp = Speaker(conference_id=conf.id, name=f"{rng.choice(['Dr. ', 'Prof. ', '', '', ''])}{fn} {ln}",
                                 job_title=rng.choice(JOBS), organization=rng.choice(ORGS), position=p,
                                 bio=f"{fn} works on {category.lower()} projects and has spoken at events across South Asia.")
                    db.add(sp)
                    speakers.append(sp)
                db.flush()
                for sp in speakers:
                    if rng.random() < 0.8:
                        sp.photo = make_avatar(sp.name.replace("Dr. ", "").replace("Prof. ", ""), f"sp-{sp.id}", "speakers")
                minute = start.hour * 60 + start.minute
                kinds = ["keynote"] + rng.sample(["talk", "talk", "workshop", "panel", "talk"], k=3) + ["break", "talk"]
                for k in kinds:
                    length = 15 if k == "break" else rng.choice([30, 45, 60])
                    if minute + length > 21 * 60:
                        break
                    db.add(AgendaSession(
                        conference_id=conf.id, kind=k, title=rng.choice(SESSION_TEMPLATES[k]),
                        start_time=time(minute // 60, minute % 60), end_time=time((minute + length) // 60, (minute + length) % 60),
                        room=None if k == "break" else rng.choice(["Main hall", "Hall B", "Lab 1", "Auditorium"]),
                        speaker_id=None if k == "break" else rng.choice(speakers).id,
                    ))
                    minute += length

                # Registrations
                if conf.status != "published":
                    continue
                popularity = rng.uniform(0.35, 1.25)
                wanted = int((cap or rng.randint(40, 160)) * popularity)
                window_start = conf.created_at
                window_end = min(now, datetime.combine(day, start, tzinfo=UTC))
                registered = 0
                emails = set()
                for _ in range(wanted):
                    fn, ln = person()
                    em = f"{fn}.{ln}{rng.randint(1, 999)}".lower().replace(" ", "") + f"@{ATTENDEE_DOMAIN}"
                    if em in emails:
                        continue
                    emails.add(em)
                    status = REGISTERED if (cap is None or registered < cap) else WAITLISTED
                    if status == REGISTERED:
                        registered += 1
                    span = max(60.0, (window_end - window_start).total_seconds())
                    reg_at = window_start + timedelta(seconds=rng.random() * span)
                    a = Attendee(conference_id=conf.id, name=f"{fn} {ln}", email=em, status=status,
                                 ticket_code=new_ticket_code(db), lang=rng.choice(["en", "si", "ta"]), registered_at=reg_at)
                    if offset < 0 and status == REGISTERED and rng.random() < rng.uniform(0.62, 0.92):
                        a.checked_in_at = datetime.combine(day, start, tzinfo=UTC) + timedelta(minutes=rng.randint(-40, 90))
                        a.reminder_sent_at = a.checked_in_at - timedelta(days=1)
                    db.add(a)
                    db.flush()
                    if reg_at > now - timedelta(days=6) and rng.random() < 0.35:
                        db.add(Notification(recipient_type="organizer", recipient_id=org.id,
                                            kind="new_waitlist" if status == WAITLISTED else "new_registration",
                                            params={"attendee": a.name, "conference": title, "demo": 1},
                                            link=f"/attendees/{conf.id}", is_read=rng.random() < 0.5, created_at=reg_at))

        # Organizer feedback, some answered
        subjects = ["Can I export the waitlist too?", "Check-in camera on older phones", "Suggestion: recurring events",
                    "Reminder emails timing", "Cover image cropping", "Thank you for the Tamil translation",
                    "Payment integration request", "Two organizers on one conference?", "Map pin moved by itself",
                    "Bulk email to attendees", "Great tool for our faculty", "Session overlap warning"]
        for subject in subjects:
            org = rng.choice(organizers[:-1])
            replied = rng.random() < 0.55
            fb = Feedback(organizer_id=org.id, subject=subject,
                          message="We used ConferenceHub for our last event and wanted to share this with the team.",
                          status="resolved" if replied and rng.random() < 0.6 else "open",
                          reply="Thanks for writing in. We have noted this and will follow up soon." if replied else None)
            fb.created_at = now - timedelta(days=rng.randint(0, 40), hours=rng.randint(0, 23))
            db.add(fb)
            for admin_id in admin_ids:
                db.add(Notification(recipient_type="admin", recipient_id=admin_id, kind="new_feedback",
                                    params={"subject": subject, "organizer": f"{org.first_name} {org.last_name}", "demo": 1},
                                    link="/admin/feedback", is_read=rng.random() < 0.6, created_at=fb.created_at))

        for i, (name, topic) in enumerate([("Shanika Perera", "topic_attending"), ("Mohamed Rizan", "topic_organizing"),
                                           ("Kumaran Selvam", "topic_partnership"), ("Andrea Jansz", "topic_technical"),
                                           ("Ravindu Herath", "topic_general"), ("Thilini Silva", "topic_attending")]):
            msg = ContactMessage(name=name, email=f"contact{i}@{DEMO_DOMAIN}", subject=topic,
                                 message="Hello, I would like to know more about using ConferenceHub for our event.",
                                 status="open" if i < 4 else "resolved")
            msg.created_at = now - timedelta(days=rng.randint(0, 20))
            db.add(msg)

        for org in organizers[:8]:
            for admin_id in admin_ids:
                db.add(Notification(recipient_type="admin", recipient_id=admin_id, kind="new_organizer",
                                    params={"name": f"{org.first_name} {org.last_name}", "demo": 1},
                                    link="/admin/organizers", is_read=True, created_at=org.created_at))
        db.commit()
        print(f"Added {len(organizers)} organizers and {conf_count} conferences (plus speakers, agendas, "
              f"registrations, feedback and contact messages).")
        print(f"Demo organizer sign-in: any *@{DEMO_DOMAIN} address from the admin Organizers page, with the password you chose.")


def remove() -> None:
    with SessionLocal() as db:
        orgs = db.execute(select(Organizer).where(Organizer.email.like(f"%@{DEMO_DOMAIN}"))).scalars().all()
        ids = [o.id for o in orgs]
        # Images demo accounts uploaded themselves are not named demo-*, so collect them from the rows.
        images = [o.avatar for o in orgs]
        if ids:
            conf_ids = list(db.execute(select(Conference.id).where(Conference.organizer_id.in_(ids))).scalars())
            images += list(db.execute(select(Conference.cover_image).where(Conference.id.in_(conf_ids))).scalars())
            images += list(db.execute(select(Speaker.photo).where(Speaker.conference_id.in_(conf_ids))).scalars())
            if conf_ids:
                speaker_ids = list(db.execute(select(Speaker.id).where(Speaker.conference_id.in_(conf_ids))).scalars())
                db.execute(delete(AgendaSession).where(AgendaSession.conference_id.in_(conf_ids)))
                if speaker_ids:
                    db.execute(delete(Speaker).where(Speaker.id.in_(speaker_ids)))
                db.execute(delete(Attendee).where(Attendee.conference_id.in_(conf_ids)))
                db.execute(delete(Conference).where(Conference.id.in_(conf_ids)))
            db.execute(delete(Feedback).where(Feedback.organizer_id.in_(ids)))
            db.execute(delete(ActivityLog).where(ActivityLog.organizer_id.in_(ids)))
            db.execute(delete(Notification).where(Notification.recipient_type == "organizer",
                                                  Notification.recipient_id.in_(ids)))
            db.execute(delete(Organizer).where(Organizer.id.in_(ids)))
        db.execute(delete(ContactMessage).where(ContactMessage.email.like(f"%@{DEMO_DOMAIN}")))
        admin_notes = [n for n in db.execute(select(Notification).where(Notification.recipient_type == "admin")).scalars()
                       if (n.params or {}).get("demo")]
        for n in admin_notes:
            db.delete(n)
        db.commit()
    removed = 0
    for url in images:
        if url and (UPLOAD_DIR / url.removeprefix("/uploads/")).exists():
            delete_image(url)
            removed += 1
    for folder in ("avatars", "speakers", "covers"):
        for f in (UPLOAD_DIR / folder).glob("demo-*.webp"):
            f.unlink()
            removed += 1
    print(f"Removed {len(ids)} demo organizers with their conferences and {removed} images.")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--remove", action="store_true", help="delete the demo data instead of adding it")
    parser.add_argument("--yes", action="store_true", help="confirm you want to change this database")
    parser.add_argument("--password", default="Demo@12345", help="password for every demo organizer")
    args = parser.parse_args()
    target = engine.url.render_as_string(hide_password=True)
    print(f"Database: {target}")
    if not args.yes:
        sys.exit("Nothing changed. Add --yes to confirm this is the database you mean.")
    remove() if args.remove else seed(args.password)


if __name__ == "__main__":
    main()
