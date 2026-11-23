# ConferenceHub v3: features and technology, in plain words

This page explains what ConferenceHub does and every tool, library and service it is built with, and why each one
was chosen, without assuming a programming background.

---

## The big picture

Think of ConferenceHub as a restaurant:

| Part | Restaurant version | In ConferenceHub |
| --- | --- | --- |
| **Website** (`web/`) | The dining room and the menu people see | Next.js app at `localhost:3100` |
| **API** (`api/`) | The kitchen that takes orders and checks the rules | FastAPI + GraphQL at `localhost:8003` |
| **Database** | The pantry where everything is stored | MongoDB |
| **Fast memory** | The order board on the kitchen wall | Redis |
| **Worker** | The helper who does jobs in the back, on a schedule | ARQ worker (emails, reminders, nightly checks) |

The website never touches the pantry directly: it always asks the kitchen (the API), which checks who is asking
and whether they are allowed.

---

## Features

### For attendees (no account needed)
- **Browse and search** conferences by topic, city and date, or find them on a map; upcoming and past events.
- **Register in seconds** with a name and email, then confirm with a **6-digit code** sent by email. The seat is held
  for 24 hours while waiting for the code.
- **Waitlist:** when a conference is full, join the waitlist; when someone cancels, the next person moves up
  automatically and gets an email.
- **Ticket page** with a **QR code** to show at the door, "add to calendar", and cancel.
- **My agenda:** save the sessions you want to attend, each with its own calendar link.
- **Live Q&A:** during the event, ask the speakers questions and upvote other people's questions, updated live.
- **Feedback:** after being checked in, rate each session and the whole conference; a reminder email comes the
  day after.
- **Three languages:** English, Sinhala and Tamil everywhere, plus light and dark themes.

### For organizers
- **Dashboard** with live numbers (registrations, check-ins, waitlist) and recent activity.
- **Conference editor:** details in three languages, multi-day agendas with tracks and speakers, a cover image and
  a map pin for the venue.
- **Attendees page:** search and filter, export to a spreadsheet (CSV), send reminders.
- **Check-in desk:** scan tickets with any phone's camera or type the code; numbers update live across every desk;
  it **keeps working without internet** and catches up when the connection returns.
- **Analytics:** sign-ups by day, arrivals in 15-minute slots, how full the event got and how many turned up,
  plus anonymous attendee ratings.
- **Live Q&A moderation:** questions sorted by votes; mark them answered or hide them.
- **Notifications, settings, help pages with guided tours**, and a way to send feedback to the admin team.

### For the administrator
- **Platform numbers** at a glance.
- **Organizers:** suspend, restore or delete accounts.
- **Conferences:** hide or show any conference.
- **Inbox** for contact-form messages and organizer feedback.
- **Activity log** of important actions.
- **System page** showing whether the database, fast memory, worker and scheduled jobs are healthy.

### Behind the scenes (automatic)
- Unconfirmed seat holds are released after 24 hours, so seats are never stuck.
- Reminder emails the day before an event, and feedback emails the day after.
- A nightly seat recount, and cleanup of unverified sign-ups and unused images.
- Failed emails are retried automatically.
- Seat limits are exact even when hundreds of people register at the same second.

---

## Technologies, and why we chose them

### The website (what people see)

| Tool | What it is | Why we used it |
| --- | --- | --- |
| **Next.js** | A framework for building websites with React | Pages are prepared on the server, so they appear fast and search engines can read them. It also handles page addresses, images and languages. |
| **React** | The most popular library for building interactive screens | Screens are built from reusable pieces (a ticket card, a button), so the same piece works everywhere. |
| **TypeScript** | JavaScript with labels saying what kind of data each thing is | Catches mistakes (like a missing field) before the site runs, instead of users finding them. |
| **Tailwind CSS** | A styling system using short class names | Fast, consistent design: colours, spacing and dark mode come from one shared set of rules. |
| **tw-animate-css** | Ready-made animations for Tailwind | The small fade and slide effects on menus and dialogs. |
| **shadcn/ui + Radix UI** | Ready-made, accessible building blocks (dialogs, menus, dropdowns) | They already work with keyboards and screen readers, so we did not have to build that from scratch. |
| **cn, clsx, tailwind-merge, class-variance-authority** | Small helpers for combining style classes | Let one button come in several styles (main, outline, danger) without conflicting styles. |
| **Lucide** | An icon set | Clean, matching icons throughout the site. |
| **urql** | A small tool for talking to the GraphQL API | Fetches data for the screens and keeps it fresh, with very little code. |
| **GraphQL Code Generator** | Reads the API's description and writes TypeScript types | The website always knows exactly what the API returns, so a change on one side is caught on the other. |
| **next-intl** | Translations for Next.js | English, Sinhala and Tamil, with the right date and number formats for each. |
| **Leaflet + React Leaflet** | Interactive maps (with OpenStreetMap) | The conference map on the browse page and the venue pin, free and without a paid map account. |
| **Recharts** | Charts for React | The analytics charts: sign-ups by day and arrival times. |
| **qrcode** | Makes QR code images | The QR code on every ticket. |
| **jsQR** | Reads QR codes from a camera picture | Lets the check-in desk scan tickets with a normal phone camera. |
| **Sonner** | Small pop-up messages ("toasts") | Friendly "Saved" or "Checked in" messages that do not block the screen. |
| **Service worker** | A small script the browser keeps in the background | Lets the check-in desk keep working offline and send the scans later. |

### The API (the kitchen)

| Tool | What it is | Why we used it |
| --- | --- | --- |
| **Python** | The programming language of the API | Clear and readable, with excellent libraries; Python stays the main language across my projects. |
| **FastAPI** | A modern Python web framework | Very fast, and checks incoming data automatically. |
| **Strawberry GraphQL** | Adds GraphQL to Python | One flexible entrance: each screen asks for exactly the data it needs in one request, instead of many fixed addresses. |
| **Uvicorn** | The program that runs the API | A fast server that handles many visitors at once. |
| **Pydantic + pydantic-settings** | Data checking, and reading settings from the `.env` file | Wrong data is refused at the door; and settings like passwords are kept out of the code. |
| **email-validator** | Checks email addresses | Stops typos like `name@gmial` before an email is sent. |
| **python-multipart** | Reads uploaded files | Needed for cover image uploads. |
| **Pillow** | Image processing | Resizes and cleans uploaded images so pages stay light and safe. |
| **Jinja2** | A templating tool | Builds the emails in three languages from one design. |
| **aiosmtplib** | Sends email | Sends confirmation codes, tickets and reminders through Gmail without slowing the API down. |
| **structlog** | Tidy, searchable logs | When something goes wrong, the logs say clearly what happened and to whom. |
| **Sentry** (optional) | Error reporting service | Can alert us about crashes in a live deployment, with details to fix them. |

### Data storage

| Tool | What it is | Why we used it |
| --- | --- | --- |
| **MongoDB** | A document database (stores records like flexible cards) | A conference with its days, tracks, speakers and three languages fits naturally in one record. It runs as a "replica set", which allows safe multi-step changes (transactions). |
| **Beanie** | Connects Python to MongoDB | Records are described once as Python classes, and checked on the way in and out. |
| **Redis** | Very fast temporary memory | Used for rate limits (stopping password guessing), live updates (check-in numbers, Q&A), and the worker's job queue. |

### Background jobs (the helper in the back)

| Tool | What it is | Why we used it |
| --- | --- | --- |
| **ARQ** | A job queue on Redis | Emails and timed jobs run outside the website request, so pages stay fast and failed emails are retried. It uses the same style of code as the API. (Details: `docs/adr/0004-arq-background-jobs.md`.) |

### Security

| Tool / method | What it is | Why we used it |
| --- | --- | --- |
| **httpOnly cookies** | Sign-in kept in a cookie page scripts cannot read | Even if a bad script got onto the page, it could not steal the sign-in. (Details: `docs/adr/0005-cookie-sessions.md`.) |
| **PyJWT** | Creates and checks signed sign-in tokens | A short-lived pass (15 minutes) that cannot be forged, renewed safely in the background. |
| **pwdlib + Argon2** | Password hashing | Passwords are never stored, only a scrambled version that is very slow to crack. |
| **CSRF protection** | A second check on every change | Stops another website from secretly making changes using your sign-in. |
| **Rate limiting** (with Redis) | Limits on repeated attempts | Blocks password guessing and code guessing. |

### Quality and testing

| Tool | What it is | Why we used it |
| --- | --- | --- |
| **pytest + pytest-asyncio + httpx** | The API test tools | 168 automatic tests check every rule (seat limits, waitlist, permissions) on every change. |
| **Vitest** | Website unit tests | Quick checks of small pieces like formatting and helpers. |
| **Playwright** | A robot that uses the real website in a browser | 74 end-to-end tests click through the site like a person: register, check in, ask questions. |
| **axe** | Accessibility checker | Makes sure the site works for people using screen readers or keyboards and that colours are readable. |
| **Lighthouse CI** | Google's page quality check | Every change must score at least 90 for speed, accessibility, best practice and SEO. |
| **Ruff** | Python style checker and formatter | Keeps the Python code tidy and catches common mistakes. |
| **mypy** | Python type checker | Like TypeScript for Python: catches mismatched data before running. |
| **import-linter** | Architecture rule checker | Keeps the code in clean layers (API → services → storage), so it stays easy to change. |
| **ESLint** | JavaScript/TypeScript checker | Catches bugs and React mistakes in the website code. |
| **pip-audit and npm audit** | Security scanners | Warn when any library has a known security hole. |

### Building, running and delivering

| Tool | What it is | Why we used it |
| --- | --- | --- |
| **uv** | Python package manager | Installs exact library versions in seconds, the same on every computer. |
| **npm + Node.js** | JavaScript package manager and runtime | Installs and runs the website tools. |
| **Docker + Docker Compose** | Runs MongoDB and Redis in containers | One command starts both databases, identical on every computer, without installing them. |
| **Git + GitHub** | Version history and code hosting | Every change is reviewed in a pull request and can be undone. |
| **GitHub Actions** | Automatic checks on GitHub | Runs all tests, checks and audits on every pull request before anything reaches `master`. |
| **Dependabot** | Automatic update suggestions | Opens pull requests when libraries have updates or security fixes. |
| **Windows .bat scripts** | Double-click launchers | `setup.bat` installs everything once; `start-services.bat` and `stop-services.bat` start and stop all five services. |

---

## Starting and stopping on Windows

| File | What it does |
| --- | --- |
| `setup.bat` | Run once: installs the API and website packages and creates `api\.env` from the example. |
| `start-services.bat` | Starts Docker Desktop if needed, then MongoDB + Redis, the API, the worker and the website, each in its own window, and waits until each answers. |
| `stop-services.bat` | Closes the API, worker and website windows and stops MongoDB + Redis (data is kept). `stop-services.bat /keepdb` leaves the databases running. |

Addresses: website `http://localhost:3100`, GraphQL API `http://localhost:8003/graphql`.
