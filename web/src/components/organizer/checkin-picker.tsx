"use client";

import { CalendarDays, ScanLine, UserCheck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useQuery } from "urql";

import { MyConferencesQuery } from "@/components/organizer/conference-queries";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { formatNumber, formatRange, localized } from "@/lib/format";

/** /dashboard/check-in: choose which conference to check people in for (published and not over yet). */
export function CheckInPicker() {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const [{ data }] = useQuery({ query: MyConferencesQuery, requestPolicy: "cache-and-network" });
  const all = data?.myConferences.__typename === "ConferenceList" ? data.myConferences.items : null;
  const open = (all ?? []).filter((c) => c.status === "PUBLISHED" && !c.ended).sort((a, b) => a.startsAt.localeCompare(b.startsAt));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-3xl font-extrabold tracking-tight">
          <ScanLine className="size-7 text-primary" aria-hidden /> {t("nav_check_in")}
        </h1>
        <p className="mt-1 text-muted-foreground">{t("ci_sub")}</p>
      </header>

      <section aria-labelledby="pick-h" className="rounded-2xl border bg-card" data-tour="ci-pick">
        <h2 id="pick-h" className="border-b px-5 py-3 text-lg font-bold">
          {t("ci_pick")}
        </h2>
        {all === null ? (
          <div className="h-40 animate-pulse bg-muted" />
        ) : open.length === 0 ? (
          <div className="p-10 text-center">
            <CalendarDays className="mx-auto size-10 text-muted-foreground" aria-hidden />
            <p className="mt-2 font-semibold">{t("ci_none_title")}</p>
            <p className="text-sm text-muted-foreground">{t("ci_none_body")}</p>
            <Button asChild variant="outline" className="mt-4 rounded-xl">
              <Link href="/dashboard/conferences">{t("nav_my_conferences")}</Link>
            </Button>
          </div>
        ) : (
          <ul className="divide-y">
            {open.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{localized(c.title, locale)}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatRange(c.startsAt, c.endsAt, locale, c.timezone)}
                    {c.venue?.city ? ` · ${c.venue.city}` : ""}
                  </p>
                </div>
                <p className="flex items-center gap-1.5 text-sm tabular-nums text-muted-foreground">
                  <UserCheck className="size-4 text-success" aria-hidden />
                  {formatNumber(c.counters.checkedIn, locale)} / {formatNumber(c.counters.confirmed, locale)} {t("stat_checked_in").toLowerCase()}
                </p>
                <Button asChild className="rounded-xl">
                  <Link href={`/dashboard/conferences/${c.id}/check-in`}>
                    <ScanLine className="size-4" aria-hidden /> {t("ci_open_desk")}
                    <span className="sr-only">: {localized(c.title, locale)}</span>
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
