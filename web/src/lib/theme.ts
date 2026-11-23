"use client";

import { useSyncExternalStore } from "react";

import { THEME_KEY } from "./theme-script";

// Light or dark, remembered in localStorage. The page starts dark (class on <html>); THEME_SCRIPT (in
// theme-script.ts) runs in <head> before the first paint to switch to light, so the page never flashes.

export type Theme = "light" | "dark";

const listeners = new Set<() => void>();

function current(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export function setTheme(theme: Theme): void {
  document.documentElement.classList.toggle("dark", theme === "dark");
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Private mode or blocked storage: the choice just is not remembered.
  }
  listeners.forEach((notify) => notify());
}

export function useTheme(): Theme {
  return useSyncExternalStore(
    (notify) => {
      listeners.add(notify);
      return () => listeners.delete(notify);
    },
    current,
    () => "dark",
  );
}
