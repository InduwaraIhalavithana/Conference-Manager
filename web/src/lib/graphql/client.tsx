"use client";

// GraphQL from the browser (urql). Requests go to /api/graphql on this site, which Next passes to the API,
// so the API's httpOnly cookies are first-party. Mutations carry the CSRF header the API requires.
import { Client, Provider, cacheExchange, fetchExchange } from "urql";
import { type ReactNode, useState } from "react";

import { useWho } from "@/lib/session";

const CSRF_COOKIE = "cm_csrf";

function readCookie(name: string): string | null {
  const match = document.cookie.split("; ").find((part) => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split("=")[1]) : null;
}

let csrfRequest: Promise<string> | null = null;

/** The CSRF token from its cookie, asking the API to set the cookie the first time. */
export async function csrfToken(): Promise<string> {
  const existing = readCookie(CSRF_COOKIE);
  if (existing) return existing;
  csrfRequest ??= fetch("/api/auth/csrf", { credentials: "same-origin" })
    .then((res) => res.json() as Promise<{ csrfToken: string }>)
    .then((body) => body.csrfToken)
    .finally(() => {
      csrfRequest = null;
    });
  return csrfRequest;
}

const REFRESH = JSON.stringify({ query: "mutation { refresh { __typename } }" });
let refreshing: Promise<boolean> | null = null;

/** Swap the refresh cookie for new tokens once, however many requests noticed the expired access token. */
function refreshSession(): Promise<boolean> {
  refreshing ??= csrfToken()
    .then((token) =>
      fetch("/api/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": token },
        body: REFRESH,
        credentials: "same-origin",
      }),
    )
    .then((res) => res.json() as Promise<{ data?: { refresh?: { __typename: string } } }>)
    .then((body) => body.data?.refresh?.__typename === "SignedIn")
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

/** Whether the person thinks they are signed in (the API's readable cm_who cookie). */
function hasSession(): boolean {
  return readCookie("cm_who") !== null;
}

export function makeClient(): Client {
  return new Client({
    url: "/api/graphql",
    exchanges: [cacheExchange, fetchExchange],
    preferGetMethod: false,
    // Access tokens last 15 minutes. When one has expired the API answers NOT_AUTHENTICATED; the request is
    // then retried once after a refresh, so organizers never see a sign-in page in the middle of their work.
    fetch: async (input, init) => {
      const send = async () => {
        const headers = new Headers(init?.headers);
        headers.set("X-CSRF-Token", await csrfToken());
        return fetch(input, { ...init, headers, credentials: "same-origin" });
      };
      const res = await send();
      if (!hasSession()) return res;
      const text = await res.clone().text();
      const expired = text.includes('"code":"NOT_AUTHENTICATED"') || text.includes('"me":null');
      if (expired && (await refreshSession())) return send();
      return res;
    },
  });
}

export function GraphQLProvider({ children }: { children: ReactNode }) {
  // A new client (and so an empty cache) whenever someone signs in or out: nothing cached for one person,
  // such as "me: null" from before signing in, is ever shown to the next.
  const who = useWho();
  return (
    <ClientFor key={who ?? "visitor"}>{children}</ClientFor>
  );
}

function ClientFor({ children }: { children: ReactNode }) {
  const [client] = useState(makeClient);
  return <Provider value={client}>{children}</Provider>;
}
