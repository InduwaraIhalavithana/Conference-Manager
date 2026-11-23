"use client";

import { Building2, CalendarDays, CheckCircle2, CircleAlert, Inbox, ServerCog, Ticket, UserX, XCircle } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect } from "react";
import { useQuery } from "urql";

import { PageHeader } from "@/components/admin/admin-shell";
import { AdminOverviewQuery, SystemStatusQuery } from "@/components/admin/admin-queries";
import { NotificationsQuery } from "@/components/organizer/queries";
import { NotificationRow } from "@/components/site/account-menu";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { formatDate, formatNumber, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const DASHBOARD_CONTEXT = {
  additionalTypenames: ["ContactMessage", "FeedbackItem", "AdminOrganizer", "AdminConference"],
};

export function AdminDashboard() {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const [{ data }] = useQuery({
    query: AdminOverviewQuery,
    requestPolicy: "cache-and-network",
    context: DASHBOARD_CONTEXT,
  });
  const [{ data: notes }] = useQuery({
    query: NotificationsQuery,
    variables: { first: 8 },
    requestPolicy: "cache-and-network",
  });
  const o = data?.adminOverview.__typename === "AdminOverview" ? data.adminOverview : null;
  const items = notes?.notifications.__typename === "NotificationPage" ? notes.notifications.items : [];
  const n = (v: number | undefined) => (v === undefined ? "–" : formatNumber(v, locale));

  const tiles = [
    {
      label: t("stat_organizers"),
      value: n(o?.organizersActive),
      sub: `${n(o?.organizersUnverified)} ${t("admin_stat_unverified").toLowerCase()}`,
      icon: Building2,
      tone: "from-sky-500 to-blue-600",
      href: "/admin/organizers",
    },
    {
      label: t("stat_upcoming"),
      value: n(o?.conferencesUpcoming),
      sub: `${n(o?.conferencesDrafts)} ${t("status_draft").toLowerCase()}`,
      icon: CalendarDays,
      tone: "from-emerald-500 to-teal-600",
      href: "/admin/conferences",
    },
    {
      label: t("admin_stat_active_regs"),
      value: n(o?.registrationsActive),
      sub: `${n(o?.registrationsWeek)} · ${t("admin_stat_week").toLowerCase()}`,
      icon: Ticket,
      tone: "from-violet-500 to-fuchsia-600",
      href: "/admin/conferences",
    },
    {
      label: t("admin_open_messages"),
      value: n(o ? o.contactsOpen + o.feedbackOpen : undefined),
      sub: t("nav_inbox"),
      icon: Inbox,
      tone: "from-amber-500 to-orange-600",
      href: "/admin/inbox",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t("admin_home_title")} sub={t("admin_dashboard_sub")} />
      <ul className="grid grid-cols-2 gap-4 xl:grid-cols-4" data-tour="adm-stats">
        {tiles.map((tile, i) => (
          <li key={tile.label} className="flex">
            <Link
              href={tile.href}
              className="flex w-full animate-rise flex-col-reverse rounded-2xl border bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <span className="text-sm text-muted-foreground">
                {tile.label}
                <span className="block text-xs">{tile.sub}</span>
              </span>
              <span className="mb-2 flex items-center justify-between">
                <span className="text-3xl font-extrabold tabular-nums">{tile.value}</span>
                <span className={cn("inline-flex size-10 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow", tile.tone)}>
                  <tile.icon className="size-5" aria-hidden />
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {o && (o.organizersSuspended > 0 || o.conferencesHidden > 0) && (
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-2xl bg-warning/12 px-4 py-3 text-sm">
          <UserX className="size-4 text-warning" aria-hidden />
          <span>
            {t("suspended_accounts")}: <strong>{n(o.organizersSuspended)}</strong>
          </span>
          <span>
            {t("badge_hidden")}: <strong>{n(o.conferencesHidden)}</strong>
          </span>
        </p>
      )}
      <div className="grid gap-6 xl:grid-cols-[1fr_1.1fr]">
        <SystemCard compact />
        <section data-tour="adm-notes" aria-labelledby="admin-notes" className="rounded-2xl border bg-card">
          <h2 id="admin-notes" className="border-b px-5 py-3 text-lg font-bold">
            {t("notifications")}
          </h2>
          {items.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">{t("notifications_empty")}</p>
          ) : (
            <ul className="divide-y">
              {items.map((item) => (
                <li key={item.id}>
                  <NotificationRow notification={item} className="block px-5 py-3 transition hover:bg-accent" />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function Light({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  return (
    <li className="flex items-center justify-between gap-3 py-2.5">
      <span className="flex items-center gap-2 font-medium">
        {ok ? <CheckCircle2 className="size-5 text-success" aria-hidden /> : <XCircle className="size-5 text-destructive" aria-hidden />}
        {label}
      </span>
      <span className={cn("text-sm", ok ? "text-muted-foreground" : "font-semibold text-destructive")}>{detail}</span>
    </li>
  );
}

/** Databases, the worker and its jobs, the queue and recent errors; refreshed every 30 seconds. */
export function SystemCard({ compact = false }: { compact?: boolean }) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const [{ data }, refresh] = useQuery({
    query: SystemStatusQuery,
    requestPolicy: "network-only",
  });
  useEffect(() => {
    const timer = window.setInterval(() => document.visibilityState === "visible" && refresh({ requestPolicy: "network-only" }), 30_000);
    return () => window.clearInterval(timer);
  }, [refresh]);
  const s = data?.systemStatus.__typename === "SystemStatus" ? data.systemStatus : null;
  const when = (iso: string) => `${formatDate(iso, locale, "short")}, ${formatTime(iso, locale)}`;
  const allOk = s ? s.mongo && s.redis && s.workerRunning && s.jobs.every((j) => j.ok) : false;

  return (
    <section aria-labelledby="system-h" className="rounded-2xl border bg-card p-5" data-tour="adm-system">
      <div className="flex items-center justify-between gap-3">
        <h2 id="system-h" className="flex items-center gap-2 text-lg font-bold">
          <ServerCog className="size-5 text-primary" aria-hidden /> {t("sys_title")}
        </h2>
        {s && (
          <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold", allOk ? "bg-success/15 text-success" : "bg-warning/15 text-warning")}>
            {allOk ? <CheckCircle2 className="size-3.5" aria-hidden /> : <CircleAlert className="size-3.5" aria-hidden />}
            {allOk ? t("system_online") : t("sys_down")}
          </span>
        )}
      </div>
      {!s ? (
        <div className="mt-4 h-40 animate-pulse rounded-xl bg-muted" />
      ) : (
        <>
          <ul className="mt-3 divide-y text-sm">
            <Light ok={s.mongo} label={t("sys_mongo")} detail={s.mongo ? t("sys_ok") : t("sys_down")} />
            <Light ok={s.redis} label={t("sys_redis")} detail={s.redis ? t("sys_ok") : t("sys_down")} />
            <Light ok={s.workerRunning} label={t("sys_worker")} detail={s.workerSeenAt ? t("sys_worker_seen", { time: when(s.workerSeenAt) }) : t("sys_never")} />
          </ul>
          <dl className="mt-3 grid grid-cols-2 gap-3">
            {[
              {
                label: t("sys_queue"),
                value: s.queueLength,
                bad: s.queueLength > 50,
              },
              {
                label: t("sys_failed"),
                value: s.failedEmailsToday,
                bad: s.failedEmailsToday > 0,
              },
              {
                label: t("sys_requests"),
                value: s.requestsLastHour,
                bad: false,
              },
              {
                label: t("sys_errors"),
                value: s.errorsLastHour,
                bad: s.errorsLastHour > 0,
              },
            ].map((m) => (
              <div key={m.label} className="flex flex-col-reverse rounded-xl bg-muted/60 p-3">
                <dt className="text-xs text-muted-foreground">{m.label}</dt>
                <dd className={cn("text-xl font-extrabold tabular-nums", m.bad && "text-destructive")}>{formatNumber(m.value, locale)}</dd>
              </div>
            ))}
          </dl>
          {!compact && (
            <section aria-labelledby="jobs-h" className="mt-5">
              <h3 id="jobs-h" className="mb-2 font-semibold">
                {t("sys_jobs")}
              </h3>
              <ul className="divide-y rounded-xl border text-sm">
                {["release_holds", "send_reminders", "send_start_alerts", "send_feedback_requests", "recount_counters", "purge_unverified", "delete_orphan_uploads"].map((name) => {
                  const run = s.jobs.find((j) => j.name === name);
                  return (
                    <li key={name} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
                      <span className="flex items-center gap-2">
                        {!run ? (
                          <CircleAlert className="size-4 text-muted-foreground" aria-hidden />
                        ) : run.ok ? (
                          <CheckCircle2 className="size-4 text-success" aria-hidden />
                        ) : (
                          <XCircle className="size-4 text-destructive" aria-hidden />
                        )}
                        {t(`job_${name}`)}
                      </span>
                      <span className="text-muted-foreground">{run ? `${when(run.at)}${run.ok ? ` · ${run.result}` : ` · ${t("sys_job_failed")}`}` : t("sys_never")}</span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
          {compact && (
            <Link href="/admin/system" className="mt-4 inline-block text-sm font-semibold text-primary hover:underline">
              {t("sys_jobs")} →
            </Link>
          )}
        </>
      )}
    </section>
  );
}
