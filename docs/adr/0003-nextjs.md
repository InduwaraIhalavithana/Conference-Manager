# ADR 0003: Next.js for the v3 web app

- **Status:** accepted
- **Date:** 2026-11-21

## Context

v2's frontend is a React single-page app built with Vite. Public conference pages are rendered in the browser, so search engines and link previews see an almost empty page, and the first view waits for JavaScript and API calls.

## Decision

Use Next.js 16 (App Router, React Server Components, TypeScript) with Tailwind CSS. Public pages are server components that call the GraphQL API on the server and send finished HTML; data that must be fresh streams in through `<Suspense>`. Organizer and admin screens are client components. The app lives in `web/`, runs on port 3100 locally, and uses npm.

## Why, honestly

- Server-rendered public pages are fast and readable by search engines and link previews.
- It stays close to the React and TypeScript skills v2 already uses.
- **It is also chosen to learn server components, streaming and Next.js caching.**

## Consequences

- Two kinds of components (server and client) with different rules about what they can use.
- Next.js 16 enables Cache Components: uncached reads must sit inside `<Suspense>`, otherwise the build fails. The Phase 0 spike already follows this.
- Hosting needs a Node runtime (Vercel or a container), not just static files.
