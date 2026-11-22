import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { AdminHome } from "@/components/admin/admin-home";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: t("admin_home_title"), robots: { index: false, follow: false } };
}

export default function Page() {
  return (
    <Suspense fallback={<div className="min-h-[60vh]" />}>
      <AdminHome />
    </Suspense>
  );
}
