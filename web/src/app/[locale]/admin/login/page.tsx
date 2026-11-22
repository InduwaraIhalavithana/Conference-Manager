import { ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { AdminLoginForm } from "@/components/auth/auth-forms";
import { AuthShell } from "@/components/auth/auth-shell";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: t("admin_login"), robots: { index: false, follow: false } };
}

export default async function Page() {
  const t = await getTranslations();
  return (
    <AuthShell
      icon={ShieldCheck}
      title={t("admin_login_title")}
      subtitle={t("admin_login_subtitle")}
      sideTitle={t("admin_side_title")}
      points={[t("admin_side_1"), t("admin_side_2"), t("admin_side_3"), t("admin_side_4")]} admin
    >
      <Suspense fallback={<div className="h-72 animate-pulse rounded-2xl bg-muted" />}>
        <AdminLoginForm />
      </Suspense>
    </AuthShell>
  );
}
