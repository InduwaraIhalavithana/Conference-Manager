# Changelog

v3 is a rewrite of ConferenceHub on new technology, built on a `v3` branch phase by phase (each phase one or more
reviewed pull requests with its own tests) and merged into `master` on 2026-11-23. v2 is kept at the `v2-final` tag.

## v3 (in progress)

### Phase 8: data move and docs (2026-11-23)
- **#83** Script that moves the v2 data into v3: organizers keep their passwords (upgraded to Argon2 at the next
  sign-in) and photos, the admin keeps the v2 password; test accounts' rows stay behind. Dry run first; refuses a
  production database without `--production`.
- **#84** Demo data set for MongoDB: 24 organizers, about 55 conferences, 6,500 registrations, check-ins, ratings
  and live Q&A, using only never-emailed demo addresses; `--remove` takes it all away.
- **#85** v2 removed from the `v3` branch; new README with an architecture diagram and screenshots.
- Decision records for ARQ and cookie sessions, a generated GraphQL reference (`docs/graphql-schema.md`, checked in
  CI) and this changelog.

### Phase 6: new features (2026-11-23)
- **#76** Session bookmarks on the ticket page (with calendar links), session and conference ratings from people
  who were checked in, a feedback email the day after, and anonymous results for organizers.
- **#77** Live Q&A for ticket holders (ask, upvote, live updates) with moderation for organizers.
- Certificates were dropped (PDF libraries could not shape Sinhala and Tamil reliably).

### Phase 5: organizer and admin areas (2026-11-22)
- **#63** Sign-in pages, organizer dashboard, settings, notifications.
- **#64** Conference editor (three languages, multi-day agenda, tracks, speakers, cover, map) and the attendees page.
- **#65** Check-in desk (camera or typed codes, live numbers, works offline) and analytics.
- **#66** Admin area (organizers, conferences, inbox, activity, System page) and organizer help with feedback.
- **#67** Guided tours on every main page and a check-in picker, closing the gaps found by a v2 feature check.
- **#68** Stopped end-to-end tests failing on first CI runs (test-only rate-limit scale) and fixed a check-in desk
  bug that dropped codes typed during another check.

### Phase 4: public site (2026-11-22)
- **#48** Next.js foundation, home page and browse page (search, filters, map).
- **#49** Conference page and the registration flow.
- **#50** Ticket, about, contact and legal pages, SEO, Playwright and axe tests.
- **#51** Lighter pages and a Lighthouse check in CI (each category at least 90 on desktop).

### Phases 0 to 3: the API (2026-11-21)
- **#4** Spike: a Next.js server component reading MongoDB through GraphQL.
- **#16** Layered FastAPI + Strawberry backend, MongoDB models, cookie-based auth with refresh rotation and CSRF.
- **#24** Conferences, agenda, search and image uploads.
- **#35** Registrations with atomic seat limits, waitlist and check-in.
- **#36** ARQ worker, queued trilingual email, scheduled jobs, `.ics` and CSV.

Phase 7 (AI features) was dropped. Phase 9 (going live) and Phase 10 (launch) are next.
