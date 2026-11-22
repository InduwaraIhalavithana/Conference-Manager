"use client";

import { RefreshCw, ServerCrash } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

/** Shown when a page cannot load its data (for example the API is down), instead of a blank screen. */
export default function PageError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations();
  return (
    <div role="alert" className="mx-auto flex max-w-xl flex-col items-center gap-4 px-4 py-24 text-center">
      <ServerCrash className="size-12 text-destructive" aria-hidden />
      <h1 className="text-2xl font-extrabold">{t("err_server")}</h1>
      <Button onClick={reset} className="rounded-xl">
        <RefreshCw className="size-4" aria-hidden /> {t("reload")}
      </Button>
    </div>
  );
}
