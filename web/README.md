# ConferenceHub v3 web app

Next.js 16 (App Router, server components, `cacheComponents`) + TypeScript + Tailwind CSS v4 + shadcn/ui, with
next-intl for English, Sinhala and Tamil (`/en`, `/si`, `/ta`). Work in progress on the `v3` branch; v2 lives in `../frontend`.

```bash
npm install
npm run dev          # http://localhost:3100 (needs the API on :8003, see ../api/README.md)
npm run codegen      # GraphQL types from src/graphql/schema.graphql (export it with `uv run python -m scripts.export_schema` in ../api)
npm run lint
npm run typecheck
npm test             # Vitest: translations complete in all three languages, date and number formatting
npm run e2e          # Playwright + axe against the running site (uses your installed Chrome locally)
npm run build
```

## Pages

| Path | What it is |
|---|---|
| `/[locale]` | Home: next conference, live numbers, upcoming, topics, cities |
| `/[locale]/conferences` | Browse: search, topic, city, dates, past, near me, list or map; filters live in the URL |
| `/[locale]/c/[slug]` | A conference: agenda, speakers, venue map, registration with email code, calendar, share image |
| `/[locale]/ticket/[code]` | An attendee's ticket: QR code, confirm the email code, cancel (never indexed) |
| `/[locale]/about`, `/contact`, `/privacy`, `/terms` | About, contact form, privacy policy, terms of use |
| `/[locale]/login`, `/register`, `/forgot`, `/reset`, `/admin/login` | Organizer sign-in and sign-up (with the emailed code), password reset, admin sign-in |
| `/[locale]/dashboard`, `/dashboard/settings` | Organizer dashboard and settings (profile, photo, password, other devices); signed-out visitors are sent to sign in |
| `/[locale]/dashboard/conferences` | My conferences: status tabs, search, duplicate, delete drafts |
| `/[locale]/dashboard/conferences/new`, `/[id]` | Conference editor: details in three languages, dates, venue with a map pin, cover, seats and waitlist; agenda (tracks, day names, sessions); speakers with photos; publish checklist, move back to draft, cancel |
| `/[locale]/dashboard/conferences/[id]/attendees` | Attendees: status filters, search, remove (the waitlist moves up), undo check-in, reminders, CSV |
| `/[locale]/admin` | Admin landing page (notifications); the full admin area arrives in Phase 5d |
| `/sitemap.xml`, `/robots.txt` | For search engines; every page lists its other languages (hreflang) |

## Settings

| Variable | Default | Used for |
|---|---|---|
| `API_URL` | `http://127.0.0.1:8003` | Where server components send GraphQL, and where `/api/*` is proxied (so cookies are first-party) |
| `SITE_URL` | `http://localhost:3100` | Absolute links in metadata, the sitemap and share images |
| `E2E_BASE_URL` | `http://localhost:3100` | The site Playwright tests |
| `E2E_ORGANIZER_EMAIL`, `E2E_ORGANIZER_PASSWORD` | `e2e.organizer@example.com`, none | The test organizer Playwright signs in as; create it with `uv run python -m scripts.e2e_account` in `../api` (refuses to run in production). Without a password the organizer tests are skipped. |

Security headers (CSP, frame, referrer, permissions, HSTS in production) are set in `next.config.ts`; see `../docs/security-checklist.md`.
