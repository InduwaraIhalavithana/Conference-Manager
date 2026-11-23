# ADR 0005: httpOnly cookies (not tokens in the browser) for sign-in

- **Status:** accepted
- **Date:** 2026-11-21 (Phase 1)

## Context

v2 kept a JWT in the browser and sent it as a bearer token. Anything that can run script on the page (an XSS bug or a
bad dependency) can read such a token and use it from anywhere, for as long as it is valid. v3 has organizers and an
admin who change other people's data, so a stolen sign-in matters.

## Decision

Keep the tokens where page scripts cannot reach them:

- a short-lived access token (15 minutes) and a refresh token (30 days) in **httpOnly** cookies (`cm_access`,
  `cm_refresh`), `SameSite=Lax`, `Secure` in production;
- the refresh token is **rotated on every use**, and presenting an old one revokes that whole session (reuse means it
  was copied);
- every mutation carries an `X-CSRF-Token` header that must match the readable `cm_csrf` cookie (**double submit**);
- a readable `cm_who` cookie says only "organizer" or "admin", so the header can show the right menu without asking
  the API; it grants nothing.

The web app calls the API through its own `/api` path (a Next.js rewrite), so the browser sees one site.

## Why, honestly

- An XSS bug can still act while the page is open, but it cannot carry the session away.
- Rotation with reuse detection turns a stolen refresh token into a signed-out session instead of a month of access.
- Sessions are rows the server can revoke: suspending an organizer, changing a password or "sign out other devices"
  takes effect at once.
- It is also the pattern worth learning for a real product, compared with a token in `localStorage`.

## Consequences

- CSRF protection is needed because cookies are sent automatically; the double-submit header covers mutations, and
  queries change nothing.
- The web app and API must be served from one site (or carefully configured cookie domains); the `/api` rewrite does
  this.
- Every request checks the session, so an access token is only part of the story: the API looks up the session to
  honour suspensions and revocations.
- When the access token expires, the web app refreshes once and retries the request.
