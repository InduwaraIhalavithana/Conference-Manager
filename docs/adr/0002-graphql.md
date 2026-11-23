# ADR 0002: GraphQL (Strawberry) as the v3 API

- **Status:** accepted
- **Date:** 2026-11-21

## Context

v2 has about 75 REST endpoints. Pages often call several of them to show one conference (details, agenda, speakers, counts), and the frontend's types are written by hand to match the backend.

## Decision

Use GraphQL with Strawberry (code-first, Python type hints), mounted inside FastAPI at `/graphql`. REST stays only where GraphQL is a poor fit: file uploads, `.ics` calendar files, CSV export and `/health`. The frontend's types will be generated from the schema in a later phase.

## Why, honestly

- Nested data (conference → days → sessions → speakers) comes back in one request, shaped by the page that needs it.
- One typed schema shared by the API and the web app.
- Subscriptions give live updates (check-in counters, Q&A) without a separate protocol.
- **It is also chosen to learn GraphQL**: schema design, resolvers, DataLoaders and subscriptions.

## Consequences

- Every resolver must batch its database reads (DataLoaders) to avoid N+1 queries.
- Query depth and complexity limits, and no introspection in production, are needed to stop expensive queries.
- HTTP caching is weaker than with REST GETs; public pages rely on Next.js caching instead.

## Update (2026-11-23)

Two things turned out differently:

- **Live updates use server-sent events, not GraphQL subscriptions.** The check-in desk and live Q&A each open a
  plain `EventSource` on a REST route fed by Redis pub/sub. It needs no WebSocket support in the proxy, reconnects
  by itself, and (for Q&A) carries only "something changed" signals, so the page refetches through GraphQL.
- **Mostly the data model avoids N+1 queries,** not DataLoaders: a conference keeps its days, tracks, speakers and
  sessions inside one document, so a conference page is one read. One DataLoader remains, batching the organizer
  lookups for lists of conferences.
