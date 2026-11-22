import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

import { LegalPage } from "@/components/site/legal-page";
import type { Locale } from "@/i18n/routing";
import { alternates } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  const locale = (await getLocale()) as Locale;
  return { title: t("privacy_title"), description: t("privacy_lead"), alternates: alternates(locale, "/privacy") };
}

export default function Page() {
  return <LegalPage prefix="privacy" sections={6} />;
}
