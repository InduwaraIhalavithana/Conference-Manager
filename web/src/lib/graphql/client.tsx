"use client";

// GraphQL from the browser (urql). Requests go to /api/graphql on this site, which Next passes to the API,
// so the API's httpOnly cookies are first-party. Mutations carry the CSRF header the API requires.
import { Client, Provider, cacheExchange, fetchExchange } from "urql";
import { type ReactNode, useState } from "react";

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

export function makeClient(): Client {
  return new Client({
    url: "/api/graphql",
    exchanges: [cacheExchange, fetchExchange],
    preferGetMethod: false,
    fetch: async (input, init) => {
      const headers = new Headers(init?.headers);
      headers.set("X-CSRF-Token", await csrfToken());
      return fetch(input, { ...init, headers, credentials: "same-origin" });
    },
  });
}

export function GraphQLProvider({ children }: { children: ReactNode }) {
  const [client] = useState(makeClient);
  return <Provider value={client}>{children}</Provider>;
}
