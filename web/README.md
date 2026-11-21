# ConferenceHub v3 web app

Next.js 16 (App Router, server components) + TypeScript + Tailwind CSS. Work in progress on the `v3` branch; v2 lives in `../frontend`.

```bash
npm install
npm run dev          # http://localhost:3100 (needs the API on :8003, see ../api/README.md)
npm run lint
npm run typecheck
npm run build
```

`GRAPHQL_URL` sets where server components send GraphQL queries (default `http://localhost:8003/graphql`).
