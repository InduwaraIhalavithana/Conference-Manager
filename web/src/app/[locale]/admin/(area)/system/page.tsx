import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/admin/admin-shell";
import { SystemCard } from "@/components/admin/admin-dashboard";

export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: t("sys_title") };
}

export default async function Page() {
  const t = await getTranslations();
  return (
    <div>
      <PageHeader title={t("sys_title")} sub={t("sys_sub")} />
      <SystemCard />
    </div>
  );
}
