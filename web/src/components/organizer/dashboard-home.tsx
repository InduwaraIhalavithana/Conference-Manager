"use client";

import { CalendarDays, CheckCircle2, Circle, CircleHelp, Clock, Hourglass, ScanLine, Settings, Ticket, Users } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useQuery } from "urql";

import { NotificationRow } from "@/components/site/account-menu";
import { NotificationsQuery } from "@/components/organizer/queries";
import { useOrganizer } from "@/components/organizer/organizer-shell";
import { graphql } from "@/graphql/generated";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { formatDate, formatNumber, formatTime, localized } from "@/lib/format";
import { cn } from "@/lib/utils";

const DashboardData = graphql(`
  query DashboardData {
    myConferences {
      __typename
      ... on ConferenceList {
        items {
          id
          slug
          status
          title { en si ta }
          timezone
          startsAt
          endsAt
          ended
          capacity
          counters { registered confirmed waitlisted checkedIn }
          sessions { id }
        }
      }
    }
  }
`);

export function DashboardHome() {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const me = useOrganizer();
  const [{ data, fetching }] = useQuery({ query: DashboardData, requestPolicy: "cache-and-network" });
  const [{ data: notes }] = useQuery({ query: NotificationsQuery, variables: { first: 6 }, requestPolicy: "cache-and-network" });

  const all = data?.myConferences.__typename === "ConferenceList" ? data.myConferences.items : [];
  const upcoming = all
    .filter((c) => !c.ended && c.status !== "CANCELLED")
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const next = upcoming[0];
  const totals = all.reduce(
    (sum, c) => ({
      registered: sum.registered + c.counters.registered,
      checkedIn: sum.checkedIn + c.counters.checkedIn,
      waitlisted: sum.waitlisted + c.counters.waitlisted,
    }),
    { registered: 0, checkedIn: 0, waitlisted: 0 },
  );
  const stats = [
    { label: t("stat_my_conferences"), value: all.length, icon: CalendarDays, tone: "from-sky-500 to-blue-600" },
    { label: t("stat_registered"), value: totals.registered, icon: Users, tone: "from-emerald-500 to-teal-600" },
    { label: t("stat_checked_in"), value: totals.checkedIn, icon: ScanLine, tone: "from-violet-500 to-fuchsia-600" },
    { label: t("stat_waitlisted"), value: totals.waitlisted, icon: Hourglass, tone: "from-amber-500 to-orange-600" },
  ];
  const checklist = [
    { label: t("check_first_conf"), done: all.length > 0 },
    { label: t("check_agenda"), done: all.some((c) => c.sessions.length > 0) },
    { label: t("check_photo"), done: Boolean(me.avatarUrl), href: "/dashboard/settings" },
    { label: t("check_first_attendee"), done: totals.registered > 0 },
  ];
  const quick = [
    { href: "/dashboard/settings", label: t("nav_settings"), sub: t("qa_settings_sub"), icon: Settings },
    { href: "/contact", label: t("nav_help"), sub: t("qa_help_sub"), icon: CircleHelp },
    { href: "/conferences", label: t("nav_conferences"), sub: t("browse_conferences"), icon: Ticket },
  ];
  const items = notes?.notifications.__typename === "NotificationPage" ? notes.notifications.items : [];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">{t("welcome_back", { name: me.firstName })}</h1>
          <p className="mt-1 text-muted-foreground">{upcoming.length ? t("dash_sub_upcoming", { count: upcoming.length }) : t("dash_sub_empty")}</p>
        </div>
      </header>

      <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s, i) => (
          <div key={s.label} className="flex animate-rise flex-col-reverse rounded-2xl border bg-card p-4 shadow-sm" style={{ animationDelay: `${i * 60}ms` }}>
            <dt className="text-sm text-muted-foreground">{s.label}</dt>
            <dd className="mt-2 flex items-center justify-between">
              <span className="text-3xl font-extrabold tabular-nums">{fetching && !data ? "–" : formatNumber(s.value, locale)}</span>
              <span className={cn("inline-flex size-10 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow", s.tone)}>
                <s.icon className="size-5" aria-hidden />
              </span>
            </dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <section aria-labelledby="upcoming-h" className="rounded-2xl border bg-card p-5">
          <h2 id="upcoming-h" className="mb-4 text-lg font-bold">
            {t("upcoming_conferences")}
          </h2>
          {next && (
            <div className="mb-4 rounded-2xl bg-gradient-to-br from-brand to-brand-2 p-5 text-white shadow-lg">
              <p className="text-xs font-semibold uppercase tracking-widest text-white/80">{t("next_event")}</p>
              <p className="mt-1 text-xl font-bold">{localized(next.title, locale)}</p>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-white/85">
                <Clock className="size-4" aria-hidden />
                {formatDate(next.startsAt, locale, "long", next.timezone)}, {formatTime(next.startsAt, locale, next.timezone)}
              </p>
            </div>
          )}
          {upcoming.length === 0 ? (
            <div className="rounded-xl border border-dashed p-8 text-center">
              <p className="font-semibold">{t("no_upcoming_title")}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t("no_upcoming_body")}</p>
            </div>
          ) : (
            <ul className="divide-y">
              {upcoming.slice(0, 6).map((c) => {
                const taken = c.counters.registered;
                const pct = c.capacity ? Math.min(100, (taken / c.capacity) * 100) : 0;
                return (
                  <li key={c.id} className="py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Link href={`/c/${c.slug}`} className="font-semibold hover:text-primary">
                        {localized(c.title, locale)}
                      </Link>
                      <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", c.status === "DRAFT" ? "bg-muted text-muted-foreground" : "bg-success/15 text-success")}>
                        {c.status === "DRAFT" ? t("status_draft") : t("status_published")}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{formatDate(c.startsAt, locale, "medium", c.timezone)}</p>
                    {c.capacity !== null && (
                      <div className="mt-2 flex items-center gap-3 text-xs">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden>
                          <div className="h-full rounded-full bg-gradient-to-r from-brand to-brand-2" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="tabular-nums text-muted-foreground">{t("seats_of", { taken: formatNumber(taken, locale), capacity: formatNumber(c.capacity, locale) })}</span>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <div className="space-y-6">
          <section aria-labelledby="start-h" className="rounded-2xl border bg-card p-5">
            <h2 id="start-h" className="mb-3 text-lg font-bold">
              {t("getting_started")}
            </h2>
            <div className="mb-3 h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
              <div className="h-full rounded-full bg-success transition-all" style={{ width: `${(checklist.filter((c) => c.done).length / checklist.length) * 100}%` }} />
            </div>
            <ul className="space-y-2 text-sm">
              {checklist.map((item) => (
                <li key={item.label} className="flex items-center gap-2">
                  {item.done ? <CheckCircle2 className="size-5 text-success" aria-hidden /> : <Circle className="size-5 text-muted-foreground" aria-hidden />}
                  {item.href && !item.done ? (
                    <Link href={item.href} className="text-primary hover:underline">
                      {item.label}
                    </Link>
                  ) : (
                    <span className={cn(item.done && "text-muted-foreground line-through")}>{item.label}</span>
                  )}
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="recent-h" className="rounded-2xl border bg-card">
            <h2 id="recent-h" className="border-b px-5 py-3 text-lg font-bold">
              {t("notifications")}
            </h2>
            {items.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">{t("notifications_empty")}</p>
            ) : (
              <ul className="divide-y">
                {items.map((n) => (
                  <li key={n.id}>
                    <NotificationRow notification={n} className="block px-5 py-3 transition hover:bg-accent" />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      <section aria-labelledby="quick-h">
        <h2 id="quick-h" className="mb-3 text-lg font-bold">
          {t("quick_actions")}
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {quick.map((q) => (
            <Link key={q.label} href={q.href} className="group flex items-center gap-3 rounded-2xl border bg-card p-4 transition hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-lg">
              <span className="inline-flex size-10 items-center justify-center rounded-xl bg-primary/12 text-primary">
                <q.icon className="size-5" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block font-semibold group-hover:text-primary">{q.label}</span>
                <span className="block text-xs text-muted-foreground">{q.sub}</span>
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
