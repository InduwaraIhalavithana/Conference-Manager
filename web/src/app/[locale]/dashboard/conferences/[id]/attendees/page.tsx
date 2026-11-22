import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { AttendeesPage } from "@/components/organizer/attendees-page";

export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: t("attendees") };
}

export default function Page({ params }: PageProps<"/[locale]/dashboard/conferences/[id]/attendees">) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-3xl bg-muted" />}>
      <Attendees params={params} />
    </Suspense>
  );
}

async function Attendees({ params }: { params: PageProps<"/[locale]/dashboard/conferences/[id]/attendees">["params"] }) {
  const { id } = await params;
  return <AttendeesPage id={id} />;
}
