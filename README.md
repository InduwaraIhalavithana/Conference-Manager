# ConferenceHub (Conference Manager)

Publish conferences, take registrations with an automatic waitlist, and check people in with QR tickets.
Every page, email and notification works in **English, Sinhala and Tamil**.

Built with FastAPI + PostgreSQL (backend) and React + TypeScript + Vite (frontend).

## Features

**Attendees** (no account needed)
- Browse and search conferences by topic, city and date; upcoming and past
- Register in seconds; join a waitlist when a conference is full
- Ticket page with a QR code, add-to-calendar (Google Calendar or .ics) and self-cancel
- Confirmation and day-before reminder emails in the language they registered in

**Organizers**
- Dashboard with live numbers, 14-day trend, next-event countdown, activity and a getting-started checklist
- Conference editor: details, cover image, venue pin on an OpenStreetMap map, agenda sessions and speakers with photos
- Seat limits with automatic promotion from the waitlist (on cancellation or when the limit is raised)
- Attendee list with manual check-in, CSV export and "send reminders now"
- Check-in desk: scan QR tickets with any camera (or type the code), live arrival counter
- Analytics: registrations and check-ins over time, by weekday, by topic, per conference
- Profile photo (upload, replace, remove), settings, help centre and feedback to the admin team
- Notification bell with "mark as seen" and "mark all as seen"

**Administrators**
- Dashboard with platform analytics (trends, topics, months, cities, top organizers and conferences)
- Organizer management (search, suspend, restore, delete), all conferences, activity log
- Organizer feedback with replies, and messages from the public contact form

**Everywhere**
- Light and dark themes, large readable text, keyboard support, guided "Need help?" tours
- Role-protected pages; each role reaches only its own area
- Uploads limited to JPG/PNG/WebP (2 MB photos, 5 MB covers), checked and re-encoded on the server

## Quick start (Windows)

```bash
copy backend\.env.example backend\.env
```
Edit `backend\.env` (at least `DATABASE_URL`, `SECRET_KEY`, `ADMIN_INITIAL_PASSWORD`), then:

```bash
setup.bat
```
`setup.bat` creates `backend\.venv` with the exact package versions, creates the database, installs the
frontend and starts everything. Afterwards use `start-services.bat` and `stop-services.bat`.

- App: http://127.0.0.1:5174
- API docs: http://127.0.0.1:8002/docs

The administrator signs in at `/admin/login` with `ADMIN_EMAIL` and `ADMIN_INITIAL_PASSWORD`.
Organizers create their own accounts at `/register`.

## Demo data

Fill the database with 36 organizers and about 100 past and upcoming conferences (some happening today,
a dozen this week, a few written in Sinhala or Tamil), speakers with photos, agendas, about 10,000
registrations with waitlists and check-ins, feedback, contact messages and generated pictures:

```bash
cd backend
.venv\Scripts\python -m scripts.seed_demo --yes --password "choose-a-demo-password"
```

Remove all of it again (real accounts are never touched; demo accounts use `@demo.conferencehub.lk`):

```bash
.venv\Scripts\python -m scripts.seed_demo --remove --yes
```

Take a backup with `pg_dump` first if the database holds real data.

## Docker

```bash
copy backend\.env.example backend\.env
docker compose up --build
```

Compose runs PostgreSQL, the API (with a volume for uploaded images) and the frontend on the same ports.

## Environment variables (`backend/.env`)

Real environment variables take priority over `backend/.env`.

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `SECRET_KEY` | Yes | Long random string for signing sign-in tokens |
| `ADMIN_EMAIL` | No | Administrator sign-in email (default `admin.conferencehub@gmail.com`) |
| `ADMIN_INITIAL_PASSWORD` | Yes on first start | Administrator password when the account is first created |
| `FRONTEND_URL` | No | Base of links in emails (default `http://127.0.0.1:5174`) |
| `GMAIL_USER`, `GMAIL_APP_PASSWORD` | No | Gmail SMTP for outgoing email. Empty = emails are written to the log |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | No | Session length (default 1440) |
| `UPLOAD_DIR` | No | Where images are stored (default `backend/uploads`) |
| `REMINDER_INTERVAL_SECONDS` | No | How often the reminder job runs (default 900) |

## Quality checks

```bash
cd backend
.venv\Scripts\ruff check app tests scripts
.venv\Scripts\python -m pytest
```

```bash
cd frontend
npm run lint
npm run typecheck
npm test
npm run build
```

Backend tests use their own temporary SQLite database and never touch PostgreSQL.
GitHub Actions runs all of the above, plus the Alembic migrations against PostgreSQL.

## Project structure

```
backend/
  app/api/          sign-in, registration, password reset
  app/core/         settings, errors, uploads, email (+ Sinhala/Tamil texts), notifications, reminders
  app/models/       SQLAlchemy models
  app/routers/      conferences, agenda, attendees + tickets, organizers, notifications, public, admin
  alembic/          database migrations
  scripts/          seed_demo.py
  tests/            pytest suite
frontend/
  src/components/   navbar, notification bell, custom select, date picker, charts, map, QR, tour
  src/i18n/         en.ts, si.ts, ta.ts, date formatting
  src/pages/        public, auth, organizer and admin pages
  src/services/     typed API client
  src/test/         Vitest suite
```

## Contact

admin.conferencehub@gmail.com
