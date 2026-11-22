import { Compass } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export default async function NotFound() {
  const t = await getTranslations();
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-4 px-4 py-24 text-center">
      <Compass className="size-12 text-primary" aria-hidden />
      <h1 className="text-3xl font-extrabold">{t("no_results_title")}</h1>
      <p className="text-muted-foreground">{t("err_not_found")}</p>
      <Button asChild className="rounded-xl">
        <Link href="/">{t("nav_home")}</Link>
      </Button>
    </div>
  );
}
