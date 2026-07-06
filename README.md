# Conference Manager

A full-stack conference management application built with FastAPI (Python) and React (Vite).

## Features

- Organizer registration, login, and JWT-authenticated sessions
- Create, edit, and manage conferences with capacity limits, categories, and draft/published status
- Public upcoming conferences page with search, date-range filter, and category chips
- Attendee registration with capacity enforcement and CSV export
- Admin dashboard: organizer management, suspension, feedback moderation
- Password reset via email (Gmail SMTP)
- Email notifications for registrations, feedback replies, and password resets
- Rate-limited login endpoints (10 req/min)
- Fully paginated list endpoints
- 36 backend tests (pytest) + 21 frontend tests (Vitest)

## Prerequisites

| Tool | Version |
|------|---------|
| Python | 3.11+ |
| Node.js | 18+ |
| PostgreSQL | 15+ |
| Git | any |

## Quick Start (Windows)

```bash
# 1. Clone
git clone <repo-url>
cd "Conference Manager"

# 2. Create the database
psql -U postgres -c "CREATE DATABASE conference_db;"

# 3. Configure backend
copy backend\.env.example backend\.env
# Edit backend\.env — set DATABASE_URL and SECRET_KEY at minimum

# 4. Run setup (creates venv, installs deps)
setup.bat

# 5. Start all services
start-services.bat
```

App is available at:
- Frontend: http://localhost:5174
- API docs (Swagger): http://localhost:8002/docs

To stop:
```bash
stop-services.bat
```

## Docker Quick Start

```bash
# Copy and edit env file first
copy backend\.env.example backend\.env

# Start everything
docker compose up --build

# App available at:
#   Frontend:  http://localhost:5174
#   Backend:   http://localhost:8002
#   API docs:  http://localhost:8002/docs
```

## Environment Variables

All variables live in `backend/.env`. Copy `backend/.env.example` to get started.

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `SECRET_KEY` | Yes | Long random string for JWT signing |
| `ALGORITHM` | No | JWT algorithm (default: `HS256`) |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | No | Token TTL in minutes (default: `1440`) |
| `ADMIN_INITIAL_PASSWORD` | No | Password for the seeded admin account (default: `admin123`) |
| `FRONTEND_URL` | No | Used in password-reset email links (default: `http://localhost:5174`) |
| `GMAIL_USER` | No | Gmail address for outbound email (leave blank to disable email) |
| `GMAIL_APP_PASSWORD` | No | Gmail App Password (16-char, not your Gmail password) |

## Test Accounts

After first startup the database is seeded automatically.

| Role | Username / Email | Password |
|------|-----------------|----------|
| Admin | `admin` | value of `ADMIN_INITIAL_PASSWORD` (default: `admin123`) |
| Organizer | register at `/register` | your choice |

## Ports

| Service | Port |
|---------|------|
| Frontend (Vite dev) | 5174 |
| Backend (uvicorn) | 8002 |
| PostgreSQL | 5432 |

## Running Tests

**Backend:**
```bash
cd backend
pip install -r requirements-dev.txt
pytest
```

**Frontend:**
```bash
cd frontend
npm test
```

## Project Structure

```
Conference Manager/
├── backend/
│   ├── app/
│   │   ├── api/          # auth routes
│   │   ├── core/         # security, email, pagination
│   │   ├── db/           # SQLAlchemy engine + session
│   │   ├── models/       # ORM models
│   │   ├── routers/      # feature routers
│   │   ├── schemas/      # Pydantic schemas
│   │   └── templates/    # Jinja2 email templates
│   ├── alembic/          # DB migrations
│   ├── tests/            # pytest test suite
│   ├── requirements.txt
│   └── requirements-dev.txt
├── frontend/
│   ├── src/
│   │   ├── components/   # reusable UI components
│   │   ├── context/      # AppContext (auth + theme + lang)
│   │   ├── pages/        # route-level page components
│   │   ├── services/     # api.js (fetch wrapper)
│   │   └── __tests__/    # Vitest test suite
│   └── package.json
├── docker-compose.yml
├── setup.bat
├── start-services.bat
└── stop-services.bat
```
