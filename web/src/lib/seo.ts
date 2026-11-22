import type { Metadata } from "next";

import { type Locale, routing } from "@/i18n/routing";

/** The canonical URL of a page in this language, and the same page in the other two (hreflang). */
export function alternates(locale: Locale, path: string): Metadata["alternates"] {
  const suffix = path === "/" ? "" : path;
  return {
    canonical: `/${locale}${suffix}`,
    languages: {
      ...Object.fromEntries(routing.locales.map((l) => [l, `/${l}${suffix}`])),
      "x-default": `/${routing.defaultLocale}${suffix}`,
    },
  };
}
