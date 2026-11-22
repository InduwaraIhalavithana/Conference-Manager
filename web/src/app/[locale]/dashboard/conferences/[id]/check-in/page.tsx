import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { CheckinDesk } from "@/components/organizer/checkin-desk";

export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: t("nav_check_in") };
}

export default function Page({ params }: PageProps<"/[locale]/dashboard/conferences/[id]/check-in">) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-3xl bg-muted" />}>
      <Desk params={params} />
    </Suspense>
  );
}

async function Desk({ params }: { params: PageProps<"/[locale]/dashboard/conferences/[id]/check-in">["params"] }) {
  const { id } = await params;
  return <CheckinDesk id={id} />;
}
