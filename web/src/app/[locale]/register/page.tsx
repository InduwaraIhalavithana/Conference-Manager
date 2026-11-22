import { UserPlus } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { RegisterForm } from "@/components/auth/auth-forms";
import { AuthShell } from "@/components/auth/auth-shell";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: t("register") };
}

export default async function Page() {
  const t = await getTranslations();
  return (
    <AuthShell
      icon={UserPlus}
      title={t("register_title")}
      subtitle={t("register_subtitle")}
      sideTitle={t("register_side_title")}
      points={[t("register_side_1"), t("register_side_2"), t("register_side_3"), t("register_side_4")]}
    >
      <Suspense fallback={<div className="h-72 animate-pulse rounded-2xl bg-muted" />}>
        <RegisterForm />
      </Suspense>
    </AuthShell>
  );
}
