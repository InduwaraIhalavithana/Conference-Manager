# Architecture decision records

Short notes on the big choices in ConferenceHub v3: the context, what was decided, the honest reasons, and what follows from it.

| # | Decision | Status |
|---|---|---|
| [0001](0001-mongodb.md) | MongoDB as the v3 database | accepted |
| [0002](0002-graphql.md) | GraphQL (Strawberry) as the v3 API | accepted |
| [0003](0003-nextjs.md) | Next.js for the v3 web app | accepted |
| [0004](0004-arq-background-jobs.md) | ARQ (not Celery) for background jobs | accepted |
| [0005](0005-cookie-sessions.md) | httpOnly cookies (not tokens in the browser) for sign-in | accepted |
