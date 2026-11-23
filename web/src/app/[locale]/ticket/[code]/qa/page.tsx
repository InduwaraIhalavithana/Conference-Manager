import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { LiveQa } from "@/components/qa/live-qa";

/** Opened from the ticket page; the ticket code is the key, so search engines must never list it. */
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: t("nav_live_qa"), robots: { index: false, follow: false } };
}

export default function Page({ params }: PageProps<"/[locale]/ticket/[code]/qa">) {
  return (
    <div className="mx-auto max-w-page px-4 py-10 sm:px-6">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-3xl bg-muted" />}>
        <Board params={params} />
      </Suspense>
    </div>
  );
}

async function Board({ params }: { params: PageProps<"/[locale]/ticket/[code]/qa">["params"] }) {
  const { code } = await params;
  return <LiveQa ticketCode={decodeURIComponent(code)} />;
}
