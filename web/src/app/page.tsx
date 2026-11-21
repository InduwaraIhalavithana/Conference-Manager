import { Suspense } from "react";

import { gql } from "@/lib/graphql";

type LocalizedText = { en: string; si: string | null; ta: string | null };
type Conference = { slug: string; city: string; startsAt: string; title: LocalizedText };

const CONFERENCES = /* GraphQL */ `
  query Conferences {
    conferences(first: 20) {
      slug
      city
      startsAt
      title { en si ta }
    }
  }
`;

const dateFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "Asia/Colombo" });

// A server component: it runs on the server, calls the API over GraphQL and sends finished HTML to the browser.
async function ConferenceList() {
  const { conferences } = await gql<{ conferences: Conference[] }>(CONFERENCES);
  if (conferences.length === 0) return <p className="text-slate-400">No published conferences yet.</p>;
  return (
    <ul className="grid gap-4 sm:grid-cols-2" data-testid="conference-list">
      {conferences.map((c) => (
        <li key={c.slug} className="rounded-xl border border-slate-700 bg-slate-900/60 p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-sky-400">
            {c.city} · {dateFormat.format(new Date(c.startsAt))}
          </p>
          <h2 className="mt-2 text-lg font-semibold text-white">{c.title.en}</h2>
          {c.title.si && <p className="mt-1 text-sm text-slate-300">{c.title.si}</p>}
          {c.title.ta && <p className="text-sm text-slate-300">{c.title.ta}</p>}
        </li>
      ))}
    </ul>
  );
}

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-12">
      <p className="text-sm font-semibold text-sky-400">ConferenceHub v3 · Phase 0 spike</p>
      <h1 className="mt-2 text-3xl font-bold text-white">Upcoming conferences</h1>
      <p className="mt-2 text-slate-400">
        Rendered by a Next.js server component from a GraphQL query to FastAPI, which reads MongoDB.
      </p>
      <div className="mt-8">
        <Suspense fallback={<p className="text-slate-400">Loading conferences…</p>}>
          <ConferenceList />
        </Suspense>
      </div>
    </main>
  );
}
