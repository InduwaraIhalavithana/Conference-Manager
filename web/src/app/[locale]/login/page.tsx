import { LogIn } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { LoginForm } from "@/components/auth/auth-forms";
import { AuthShell } from "@/components/auth/auth-shell";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: t("login") };
}

export default async function Page() {
  const t = await getTranslations();
  return (
    <AuthShell
      icon={LogIn}
      title={t("login_title")}
      subtitle={t("login_subtitle")}
      sideTitle={t("login_side_title")}
      points={[t("login_side_1"), t("login_side_2"), t("login_side_3"), t("login_side_4")]}
    >
      <Suspense fallback={<div className="h-72 animate-pulse rounded-2xl bg-muted" />}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
