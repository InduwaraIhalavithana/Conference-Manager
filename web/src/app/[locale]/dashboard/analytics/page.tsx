import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { AnalyticsPage } from "@/components/organizer/analytics-page";

// Private pages render only once the browser knows who is signed in, so there is no shell to validate.
export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: t("nav_analytics") };
}

export default function Page({ searchParams }: PageProps<"/[locale]/dashboard/analytics">) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-3xl bg-muted" />}>
      <Analytics searchParams={searchParams} />
    </Suspense>
  );
}

async function Analytics({ searchParams }: { searchParams: PageProps<"/[locale]/dashboard/analytics">["searchParams"] }) {
  const raw = (await searchParams).conference;
  const conference = typeof raw === "string" && /^[0-9a-f]{24}$/.test(raw) ? raw : null;
  return <AnalyticsPage key={conference ?? "all"} initialConference={conference} />;
}
