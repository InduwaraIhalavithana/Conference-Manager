"use client";

import { useSyncExternalStore } from "react";

export type Who = "organizer" | "admin";

function read(): Who | null {
  const value = document.cookie
    .split("; ")
    .find((part) => part.startsWith("cm_who="))
    ?.split("=")[1];
  return value === "organizer" || value === "admin" ? value : null;
}

const listeners = new Set<() => void>();

/** Call after signing in or out, so the header updates without a reload. */
export function sessionChanged(): void {
  for (const listener of listeners) listener();
}

/** Who the API says is signed in (its readable cm_who cookie), or null. Never trusted for access. */
export function useWho(): Who | null {
  return useSyncExternalStore(
    (onChange) => {
      listeners.add(onChange);
      window.addEventListener("focus", onChange);
      return () => {
        listeners.delete(onChange);
        window.removeEventListener("focus", onChange);
      };
    },
    read,
    () => null,
  );
}

/** Where to go after signing in: a path inside that role's area of this site, never another site. */
export function safeNext(next: string | null, area: "dashboard" | "admin"): string {
  const home = `/${area}`;
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return home;
  const withoutLocale = next.replace(/^\/(en|si|ta)(?=\/|$)/, "") || "/";
  return withoutLocale === home || withoutLocale.startsWith(`${home}/`) ? withoutLocale : home;
}
