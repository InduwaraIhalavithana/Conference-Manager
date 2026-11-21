# ADR 0001: MongoDB as the v3 database

- **Status:** accepted
- **Date:** 2026-11-21

## Context

v2 stores a conference across four PostgreSQL tables (`conferences`, `speakers`, `sessions`, `attendees`). Almost every screen reads or edits a conference as a whole: its days, sessions, speakers, venue and text in three languages. v3 adds multi-day events, tracks and organizer text in English, Sinhala and Tamil, which would add more tables and joins.

## Decision

Use MongoDB 7 through the Beanie ODM (Pydantic models on PyMongo's async API). A conference is one document holding its days, tracks, sessions and speakers. Registrations, notifications and logs are separate collections because they grow without limit. Locally MongoDB runs in Docker as a single-node replica set, so transactions work the same as in production.

## Why, honestly

- A conference really is one aggregate, which is what the document model fits best.
- Multilingual fields (`{en, si, ta}`) and flexible agendas are simple as nested documents.
- **It is also chosen to learn document modelling, indexes, aggregation pipelines and time-series collections**, after three projects on PostgreSQL.

## Consequences

- No SQL row locks: the seat limit relies on atomic conditional updates (`$inc` only while below capacity) inside a transaction, proven by a load test in Phase 3.
- No foreign keys: integrity between conferences and registrations is enforced in the service layer and checked by a nightly recount.
- The v2 data is moved once by a migration script (Phase 8).
