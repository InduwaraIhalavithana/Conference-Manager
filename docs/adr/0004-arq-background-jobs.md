# ADR 0004: ARQ (not Celery) for background jobs

- **Status:** accepted
- **Date:** 2026-11-22 (Phase 3)

## Context

v2 sent emails inside the request and ran reminders and hold releases in one asyncio loop inside the API process. With
several API containers that loop would run once per container, a slow mail server slowed down the request that sent
the email, and a failed email was simply lost.

v3 needs a queue for emails (retried when the mail server fails) and a scheduler for timed jobs: releasing
unconfirmed holds, day-before reminders, the nightly seat recount, removing unverified sign-ups and unused images,
and later the day-after feedback email.

## Decision

Use **ARQ**, an asyncio job queue on Redis, in a separate worker process (`uv run arq app.worker.WorkerSettings`).
The API enqueues emails; the worker sends them (3 tries, 30 s and 60 s apart) and runs the scheduled jobs with ARQ's
cron. Jobs are plain async functions in `app/services/jobs.py`, so tests call them directly.

## Why, honestly

- **The same async code as the API.** Celery workers are synchronous, so every job would need a second, sync way
  into MongoDB; ARQ jobs call the same async services and repositories the API uses.
- **Redis is already there** (rate limits, sessions, live updates), so there is no new broker to run.
- **Small and readable:** one dependency and a settings class, against Celery's broker, result backend, beat
  scheduler and their configuration.
- The workload is light (emails and a few timed jobs), so Celery's routing, chords and canvas are not needed.

## Consequences

- No built-in monitoring UI (Celery has Flower). The worker writes a heartbeat every minute and each job's last run
  to Redis; the admin's System page shows them, and failed emails are counted.
- Retries are explicit (`Retry(defer=...)` in the email job), not a decorator option.
- Every job must be safe to run twice (a second run finds nothing left to do), because a cron run can overlap a
  restart.
- In development, `EMAIL_DELIVERY=log` writes emails to the API log so the worker is optional.
