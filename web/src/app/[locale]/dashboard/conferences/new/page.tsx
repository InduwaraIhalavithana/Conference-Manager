import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { DetailsForm } from "@/components/organizer/details-form";

export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: t("new_conference") };
}

export default async function Page() {
  const t = await getTranslations();
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-extrabold tracking-tight">{t("new_conference")}</h1>
        <p className="mt-1 text-muted-foreground">{t("new_conference_create_help")}</p>
      </header>
      <DetailsForm conference={null} />
    </div>
  );
}
