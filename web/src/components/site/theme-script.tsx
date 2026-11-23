"use client";

import { useLayoutEffect } from "react";

import { syncTheme } from "@/lib/theme";
import { THEME_SCRIPT } from "@/lib/theme-script";

/**
 * Applies the saved theme. On a full page load the inline script runs before the first paint. Changing language
 * swaps the root layout in the browser, where scripts never run (React warns about them), so there the tag is inert
 * ("text/plain") and the layout effect puts the saved theme back, also before paint.
 */
export function ThemeScript() {
  useLayoutEffect(syncTheme, []);
  return (
    <script
      suppressHydrationWarning
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }}
    />
  );
}
