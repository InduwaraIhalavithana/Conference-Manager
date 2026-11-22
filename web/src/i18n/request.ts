import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { notFound } from "next/navigation";
import * as rootParams from "next/root-params";

import { routing } from "./routing";

export default getRequestConfig(async ({ locale }) => {
  if (!locale) {
    // The [locale] segment of the URL, read through Next 16's root params (works with Cache Components).
    const fromUrl = await rootParams.locale();
    if (!hasLocale(routing.locales, fromUrl)) notFound();
    locale = fromUrl;
  }
  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
    timeZone: "Asia/Colombo",
  };
});
