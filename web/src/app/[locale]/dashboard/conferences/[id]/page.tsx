import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { ConferenceEditor } from "@/components/organizer/conference-editor";

export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: t("edit_conference") };
}

export default function Page({ params }: PageProps<"/[locale]/dashboard/conferences/[id]">) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-3xl bg-muted" />}>
      <Editor params={params} />
    </Suspense>
  );
}

async function Editor({ params }: { params: PageProps<"/[locale]/dashboard/conferences/[id]">["params"] }) {
  const { id } = await params;
  return <ConferenceEditor id={id} />;
}
