import { KeyRound } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { ForgotForm } from "@/components/auth/auth-forms";
import { AuthShell } from "@/components/auth/auth-shell";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: t("forgot_title") };
}

export default async function Page() {
  const t = await getTranslations();
  return (
    <AuthShell
      icon={KeyRound}
      title={t("forgot_title")}
      subtitle={t("forgot_subtitle")}
      sideTitle={t("forgot_side_title")}
      points={[t("forgot_side_1"), t("forgot_side_2"), t("forgot_side_3")]}
    >
      <Suspense fallback={<div className="h-72 animate-pulse rounded-2xl bg-muted" />}>
        <ForgotForm />
      </Suspense>
    </AuthShell>
  );
}
