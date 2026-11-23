import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { QaModeration } from "@/components/qa/qa-moderation";

// Private pages render only once the browser knows who is signed in, so there is no shell to validate.
export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: t("nav_live_qa") };
}

export default function Page({ params }: PageProps<"/[locale]/dashboard/conferences/[id]/qa">) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-3xl bg-muted" />}>
      <Moderation params={params} />
    </Suspense>
  );
}

async function Moderation({ params }: { params: PageProps<"/[locale]/dashboard/conferences/[id]/qa">["params"] }) {
  const { id } = await params;
  return <QaModeration id={id} />;
}
