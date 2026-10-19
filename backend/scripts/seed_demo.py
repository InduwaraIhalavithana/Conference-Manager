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
from datetime import UTC, date, datetime, time, timedelta, timezone
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
LK = timezone(timedelta(hours=5, minutes=30))  # event times are Sri Lanka local time
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
ORGANIZER_COUNT = 36
TODAY_SLOTS = [(time(8, 30), time(17, 30)), (time(14, 0), time(21, 0))]

# Days from today. Guarantees events today, tomorrow and through the coming weeks.
NEAR_TERM_OFFSETS = [0, 0, 1, 1, 2, 3, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 17, 19, 21, 24, 27, 30]

FOCUS = {
    "Tech": "software, data and AI", "Health": "public health and patient care", "Education": "teaching and learning",
    "Business": "growing businesses", "Science": "research and discovery", "Arts": "art, design and culture",
    "Other": "community work",
}

DESCRIPTIONS = [
    "{base} brings together practitioners, researchers and students in {city} for a day of talks, hands-on sessions "
    "and networking on {focus}. Expect practical lessons you can use the next day and plenty of time to meet people "
    "working on the same problems.",
    "Join speakers from universities, industry and government in {city} for {base}. The programme mixes keynotes, "
    "short case studies from Sri Lankan teams and small-group workshops, all focused on {focus}.",
    "{base} is a one-day gathering for anyone working in {focus}. Hear what is working in Sri Lanka today, try new "
    "tools in guided workshops, and leave with contacts and ideas for your own projects.",
    "Now in its third year, {base} returns to {city} with a fuller agenda: panels with practitioners, live demos and "
    "a career corner for students. Seats are limited, so register early.",
]

SPEAKER_BIOS = [
    "{name} has spent more than ten years working on {topic} and advises organisations across South Asia.",
    "{name} leads projects on {topic} and regularly speaks at regional conferences.",
    "{name} teaches and researches {topic}, with a focus on practical results for Sri Lankan communities.",
    "{name} founded a local initiative on {topic} that now works with partners in five districts.",
]

ORG_BIOS = [
    "Organizes conferences and community events across Sri Lanka.",
    "Runs the annual events programme for our faculty and partners.",
    "Brings practitioners and students together through workshops and conferences.",
    "Coordinates professional development events for members nationwide.",
]

# A few events written in Sinhala or Tamil, as organizers would publish them.
LOCAL_EVENTS = [
    {"lang": "si", "category": "Arts", "title": "සිංහල සාහිත්‍ය උළෙල",
     "description": "ලේඛකයින්, කවියන් සහ පාඨකයින් එක් කරන සාහිත්‍ය උළෙලකි. කතිකා, කවි සැඳෑ සහ නව ලේඛකයින් සඳහා වැඩමුළු ඇතුළත් වේ."},
    {"lang": "si", "category": "Education", "title": "ගුරු සංවර්ධන වැඩමුළුව",
     "description": "පන්ති කාමරයේ නව ඉගැන්වීම් ක්‍රම, ඩිජිටල් මෙවලම් සහ ශිෂ්‍ය ඇගයීම පිළිබඳ ප්‍රායෝගික වැඩමුළුවකි."},
    {"lang": "si", "category": "Science", "title": "කෘෂි තාක්ෂණ සම්මන්ත්‍රණය",
     "description": "ගොවීන්, පර්යේෂකයින් සහ ව්‍යවසායකයින් සඳහා නවීන කෘෂි තාක්ෂණය, ජල කළමනාකරණය සහ අස්වැන්න වැඩි කිරීම ගැන සාකච්ඡා කෙරේ."},
    {"lang": "si", "category": "Business", "title": "තරුණ ව්‍යවසායකයින්ගේ සමුළුව",
     "description": "නව ව්‍යාපාර අදහස් ඉදිරිපත් කිරීම, මූල්‍ය උපදෙස් සහ සාර්ථක ව්‍යවසායකයින්ගේ අත්දැකීම් බෙදාගැනීමේ සමුළුවකි."},
    {"lang": "ta", "category": "Arts", "title": "தமிழ் இலக்கிய மாநாடு",
     "description": "எழுத்தாளர்கள், கவிஞர்கள், வாசகர்கள் ஒன்றுகூடும் இலக்கிய மாநாடு. உரைகள், கவியரங்கம், இளம் எழுத்தாளர்களுக்கான பயிலரங்குகள் இடம்பெறும்."},
    {"lang": "ta", "category": "Education", "title": "ஆசிரியர் மேம்பாட்டுப் பயிலரங்கு",
     "description": "புதிய கற்பித்தல் முறைகள், டிஜிட்டல் கருவிகள், மாணவர் மதிப்பீடு பற்றிய நடைமுறைப் பயிலரங்கு."},
    {"lang": "ta", "category": "Health", "title": "சமூக சுகாதார மாநாடு",
     "description": "சுகாதாரப் பணியாளர்கள், மருத்துவர்கள், சமூகத் தலைவர்கள் இணைந்து நோய்த் தடுப்பு, ஊட்டச்சத்து, மனநலம் பற்றிக் கலந்துரையாடுவார்கள்."},
    {"lang": "ta", "category": "Tech", "title": "தொழில்நுட்பக் கண்காட்சி",
     "description": "மாணவர்களும் தொடக்க நிறுவனங்களும் தங்கள் புதிய தொழில்நுட்பத் திட்டங்களைக் காட்சிப்படுத்தும் கண்காட்சியும் கருத்தரங்கும்."},
]

LOCAL_SESSIONS = {
    "si": {"keynote": "ආරම්භක දේශනය", "talk": "විශේෂ දේශනය", "workshop": "ප්‍රායෝගික වැඩමුළුව",
           "panel": "සාකච්ඡා මණ්ඩලය", "break": "තේ විවේකය"},
    "ta": {"keynote": "தொடக்க உரை", "talk": "சிறப்புரை", "workshop": "நடைமுறைப் பயிலரங்கு",
           "panel": "குழு விவாதம்", "break": "தேநீர் இடைவேளை"},
}

FEEDBACK_MESSAGES = [
    "We used ConferenceHub for our last event and wanted to share this with the team.",
    "Check-in went very smoothly for 180 people. One small idea below.",
    "Our attendees loved getting the reminder in Sinhala. Could we also customise the text?",
    "The waitlist filled up within a day. It would help to see where people heard about us.",
    "Is there a way to copy last year's agenda into this year's conference?",
]

CONTACT_MESSAGES = [
    "Hello, I registered for a conference but cannot find my ticket email. Could you help?",
    "Our university would like to run its research week on ConferenceHub. Who should we talk to?",
    "We are interested in a partnership for our annual business forum.",
    "The camera does not start on my laptop at the check-in desk. Any tips?",
    "Can attendees register for several conferences with the same email address?",
    "Thank you for the Tamil interface, it made a big difference for our audience.",
]

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
        for i in range(ORGANIZER_COUNT):
            while True:
                fn, ln = person()
                if (fn, ln) not in used:
                    used.add((fn, ln))
                    break
            org = Organizer(
                first_name=fn, last_name=ln, email=f"{fn}.{ln}".lower().replace(" ", "") + f"@{DEMO_DOMAIN}",
                password_hash=pw_hash, phone=f"+94 7{rng.randint(0, 8)} {rng.randint(100, 999)} {rng.randint(1000, 9999)}",
                organization=rng.choice(ORGS), lang=rng.choice(["en", "en", "si", "ta"]),
                bio=rng.choice(ORG_BIOS),
                is_suspended=(i == ORGANIZER_COUNT - 1),
            )
            org.created_at = now - timedelta(days=rng.randint(3, 200), hours=rng.randint(0, 23))
            org.email_verified_at = org.created_at + timedelta(minutes=rng.randint(2, 90))
            db.add(org)
            organizers.append(org)
        db.flush()
        for org in organizers:
            if rng.random() < 0.95:
                org.avatar = make_avatar(f"{org.first_name} {org.last_name}", f"org-{org.id}")

        # Dates: a few events today and this week so the site always has something happening,
        # then a spread over the next six months and the past five.
        near = list(NEAR_TERM_OFFSETS)
        rng.shuffle(near)

        def next_offset() -> int:
            if near:
                return near.pop()
            return rng.randint(1, 175) if rng.random() < 0.6 else rng.randint(-160, -2)

        local_pool = list(LOCAL_EVENTS)  # each Sinhala/Tamil event appears once
        rng.shuffle(local_pool)
        conf_count = 0
        today_count = 0
        for org in organizers[:-1]:  # the suspended account keeps no events, so the public site stays consistent
            for _ in range(rng.randint(2, 4)):
                offset = next_offset()
                day = today + timedelta(days=offset)
                city, venue, lat, lng = rng.choice(CITIES)
                if local_pool and rng.random() < 0.12:
                    local = local_pool.pop()
                    category, description, lang = local["category"], local["description"], local["lang"]
                    title = f"{local['title']} {day.year}"
                else:
                    category = rng.choice(list(TOPICS))
                    base = rng.choice(TOPICS[category])
                    title = f"{base} {city} {day.year}" if rng.random() < 0.6 else f"{base} {day.year}"
                    description = rng.choice(DESCRIPTIONS).format(base=base, city=city, focus=FOCUS[category])
                    lang = "en"
                if offset == 0:
                    # Today: one daytime event and one running into the evening, so something is usually live.
                    start, end = TODAY_SLOTS[today_count % len(TODAY_SLOTS)]
                    today_count += 1
                else:
                    start = time(rng.choice([8, 9, 9, 10, 13, 14]), rng.choice([0, 0, 30]))
                    end = time(min(start.hour + rng.randint(4, 8), 21), start.minute)
                cap = rng.choice([None, 40, 60, 80, 100, 120, 150, 200, 300])
                conf = Conference(
                    organizer_id=org.id, title=title, description=description,
                    date=day, time=start, end_time=end, location=f"{venue}, Sri Lanka",
                    venue_lat=lat + rng.uniform(-0.002, 0.002), venue_lng=lng + rng.uniform(-0.002, 0.002),
                    max_attendees=cap, status="draft" if (offset > 60 and rng.random() < 0.12) else "published",
                    category=category,
                )
                # Published 3 to 12 weeks before the event (or before today), so registrations spread out.
                conf.created_at = min(now, datetime.combine(day, start, tzinfo=LK)) - timedelta(days=rng.randint(20, 85))
                db.add(conf)
                db.flush()
                conf_count += 1
                if rng.random() < 0.9:
                    conf.cover_image = make_cover(category, f"cover-{conf.id}")
                db.add(ActivityLog(organizer_id=org.id, action="create_conference", target=title,
                                   created_at=conf.created_at))

                # Speakers and agenda
                speakers = []
                for p in range(rng.randint(3, 6)):
                    fn, ln = person()
                    sp = Speaker(conference_id=conf.id, name=f"{rng.choice(['Dr. ', 'Prof. ', '', '', ''])}{fn} {ln}",
                                 job_title=rng.choice(JOBS), organization=rng.choice(ORGS), position=p,
                                 bio=rng.choice(SPEAKER_BIOS).format(name=fn, topic=FOCUS[category]))
                    db.add(sp)
                    speakers.append(sp)
                db.flush()
                for sp in speakers:
                    sp.photo = make_avatar(sp.name.replace("Dr. ", "").replace("Prof. ", ""), f"sp-{sp.id}", "speakers")
                minute = start.hour * 60 + start.minute
                kinds = ["keynote"] + rng.sample(["talk", "talk", "workshop", "panel", "talk"], k=3) + ["break", "talk", "panel"]
                for k in kinds:
                    length = 15 if k == "break" else rng.choice([30, 45, 60])
                    if minute + length > 21 * 60:
                        break
                    session_title = LOCAL_SESSIONS[lang][k] if lang != "en" else rng.choice(SESSION_TEMPLATES[k])
                    db.add(AgendaSession(
                        conference_id=conf.id, kind=k, title=session_title,
                        start_time=time(minute // 60, minute % 60), end_time=time((minute + length) // 60, (minute + length) % 60),
                        room=None if k == "break" else rng.choice(["Main hall", "Hall B", "Lab 1", "Auditorium"]),
                        speaker_id=None if k == "break" else rng.choice(speakers).id,
                    ))
                    minute += length

                # Registrations
                if conf.status != "published":
                    continue
                popularity = rng.uniform(0.45, 1.3)
                wanted = int((cap or rng.randint(50, 180)) * popularity)
                starts_at = datetime.combine(day, start, tzinfo=LK)
                window_start = conf.created_at
                window_end = min(now, starts_at)
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
                    # Interest builds up towards the event: more registrations near the end of the window.
                    reg_at = window_start + timedelta(seconds=(rng.random() ** 0.8) * span)
                    a = Attendee(conference_id=conf.id, name=f"{fn} {ln}", email=em, status=status,
                                 ticket_code=new_ticket_code(db), lang=rng.choice(["en", "si", "ta"]), registered_at=reg_at,
                                 confirmed_at=reg_at + timedelta(minutes=rng.randint(1, 120)))
                    if status == REGISTERED and offset < 0 and rng.random() < rng.uniform(0.62, 0.92):
                        a.checked_in_at = starts_at + timedelta(minutes=rng.randint(-40, 90))
                    elif status == REGISTERED and offset == 0 and now > starts_at and rng.random() < 0.6:
                        # Today's event is under way: people are still arriving.
                        elapsed = min((now - starts_at).total_seconds(), 3 * 3600)
                        a.checked_in_at = starts_at - timedelta(minutes=30) + timedelta(seconds=rng.random() * elapsed)
                    if status == REGISTERED and offset <= 1:
                        a.reminder_sent_at = starts_at - timedelta(days=1)
                    db.add(a)
                    db.flush()
                    if reg_at > now - timedelta(days=6) and rng.random() < 0.35:
                        db.add(Notification(recipient_type="organizer", recipient_id=org.id,
                                            kind="new_waitlist" if status == WAITLISTED else "new_registration",
                                            params={"attendee": a.name, "conference": title, "demo": 1},
                                            link=f"/attendees/{conf.id}", is_read=rng.random() < 0.5, created_at=reg_at))

        # Recent sign-ins and edits, so activity feeds show what organizers are doing.
        for org in organizers[:-1]:
            for _ in range(rng.randint(1, 4)):
                db.add(ActivityLog(organizer_id=org.id, action=rng.choice(["login", "login", "update_conference", "update_profile"]),
                                   target=org.email, created_at=now - timedelta(hours=rng.randint(1, 240))))

        # Organizer feedback, some answered
        subjects = ["Can I export the waitlist too?", "Check-in camera on older phones", "Suggestion: recurring events",
                    "Reminder emails timing", "Cover image cropping", "Thank you for the Tamil translation",
                    "Payment integration request", "Two organizers on one conference?", "Map pin moved by itself",
                    "Bulk email to attendees", "Great tool for our faculty", "Session overlap warning"]
        for subject in subjects:
            org = rng.choice(organizers[:-1])
            replied = rng.random() < 0.55
            fb = Feedback(organizer_id=org.id, subject=subject,
                          message=rng.choice(FEEDBACK_MESSAGES),
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
                                           ("Ravindu Herath", "topic_general"), ("Thilini Silva", "topic_attending"),
                                           ("Nalaka Gunasekara", "topic_organizing"), ("Priyanthi Rajan", "topic_attending"),
                                           ("Zeenath Hussain", "topic_partnership"), ("Kevin Ondaatjie", "topic_technical")]):
            msg = ContactMessage(name=name, email=f"contact{i}@{DEMO_DOMAIN}", subject=topic,
                                 message=CONTACT_MESSAGES[i % len(CONTACT_MESSAGES)],
                                 status="open" if i < 6 else "resolved")
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
