import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "si", "ta"],
  defaultLocale: "en",
  // Every address carries its language (/si/conferences), so links can be shared in the language they were read in.
  localePrefix: "always",
});

export type Locale = (typeof routing.locales)[number];

/** BCP 47 tags for formatting dates and numbers. */
export const INTL_LOCALE: Record<Locale, string> = { en: "en-GB", si: "si-LK", ta: "ta-LK" };
