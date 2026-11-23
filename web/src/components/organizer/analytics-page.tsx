"use client";

import { BarChart3, CheckCircle2, ScanLine, Users } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useId, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useQuery } from "urql";

import { AnalyticsOverviewQuery, ConferenceAnalyticsQuery } from "@/components/organizer/conference-queries";
import { FeedbackPanel } from "@/components/organizer/feedback-panel";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { formatDate, formatDay, formatNumber, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const COLORS = { primary: "var(--chart-1, #0284c7)", left: "var(--destructive)", wait: "#f59e0b", arrivals: "#10b981" };
const AXIS = { fontSize: 12, fill: "var(--muted-foreground)" };
const SELECT =
  "h-11 w-full max-w-md rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

function pct(part: number, whole: number | null | undefined): string {
  return whole ? `${Math.round((part / whole) * 100)}%` : "–";
}

export function AnalyticsPage({ initialConference }: { initialConference: string | null }) {
  const t = useTranslations();
  const selectId = useId();
  const [conferenceId, setConferenceId] = useState<string>(initialConference ?? "");
  const [{ data: overviewData }] = useQuery({ query: AnalyticsOverviewQuery, variables: { days: 30 }, requestPolicy: "cache-and-network" });
  const overview = overviewData?.analyticsOverview.__typename === "AnalyticsOverview" ? overviewData.analyticsOverview : null;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-3xl font-extrabold tracking-tight">
          <BarChart3 className="size-7 text-primary" aria-hidden /> {t("nav_analytics")}
        </h1>
        <p className="mt-1 text-muted-foreground">{t("analytics_sub")}</p>
      </header>
      <div className="space-y-1.5" data-tour="an-pick">
        <label htmlFor={selectId} className="text-sm font-medium">
          {t("an_conference")}
        </label>
        <select id={selectId} value={conferenceId} onChange={(e) => setConferenceId(e.target.value)} className={SELECT}>
          <option value="">{t("an_overview")}</option>
          {overview?.conferences.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
      </div>
      {conferenceId ? <ConferenceView id={conferenceId} /> : <OverviewView overview={overview} />}
    </div>
  );
}

function Tile({ label, value, sub, icon: Icon, tone }: { label: string; value: string; sub?: string; icon: typeof Users; tone: string }) {
  return (
    <div className="flex animate-rise flex-col-reverse rounded-2xl border bg-card p-4 shadow-sm">
      <dt className="text-sm text-muted-foreground">
        {label}
        {sub && <span className="block text-xs">{sub}</span>}
      </dt>
      <dd className="mb-2 flex items-center justify-between">
        <span className="text-3xl font-extrabold tabular-nums">{value}</span>
        <span className={cn("inline-flex size-10 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow", tone)}>
          <Icon className="size-5" aria-hidden />
        </span>
      </dd>
    </div>
  );
}

function ChartCard({ title, sub, children, empty }: { title: string; sub?: string; children: React.ReactNode; empty: boolean }) {
  const t = useTranslations();
  return (
    <section className="rounded-2xl border bg-card p-5" aria-label={title} data-tour="an-chart">
      <h2 className="font-bold">{title}</h2>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      <div className="mt-4 h-64">{empty ? <p className="flex h-full items-center justify-center text-sm text-muted-foreground">{t("an_no_data")}</p> : children}</div>
    </section>
  );
}

function tooltipStyle() {
  return { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, color: "var(--popover-foreground)" };
}

function OverviewView({ overview }: { overview: { byDay: { day: string; registered: number; left: number }[]; conferences: { id: string; title: string; startsAt: string; capacity?: number | null; registered: number; checkedIn: number }[] } | null }) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  if (!overview) return <div className="h-72 animate-pulse rounded-2xl bg-muted" />;
  const total = overview.byDay.reduce((sum, d) => sum + d.registered, 0);
  const withLimit = overview.conferences.filter((c) => c.capacity);
  const avgFill = withLimit.length ? Math.round((withLimit.reduce((s, c) => s + c.registered / (c.capacity ?? 1), 0) / withLimit.length) * 100) : null;
  const registered = overview.conferences.reduce((s, c) => s + c.registered, 0);
  const checkedIn = overview.conferences.reduce((s, c) => s + c.checkedIn, 0);
  const days = overview.byDay.map((d) => ({ ...d, label: formatDay(d.day, locale, "month-day") }));

  return (
    <div className="space-y-6">
      <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Tile label={t("an_last_30")} value={formatNumber(total, locale)} icon={Users} tone="from-sky-500 to-blue-600" />
        <Tile label={t("avg_fill")} sub={t("avg_fill_sub")} value={avgFill === null ? "–" : `${avgFill}%`} icon={BarChart3} tone="from-violet-500 to-fuchsia-600" />
        <Tile label={t("stat_registered")} value={formatNumber(registered, locale)} icon={CheckCircle2} tone="from-emerald-500 to-teal-600" />
        <Tile label={t("stat_checked_in")} value={formatNumber(checkedIn, locale)} sub={pct(checkedIn, registered)} icon={ScanLine} tone="from-amber-500 to-orange-600" />
      </dl>
      <ChartCard title={t("an_last_30")} empty={days.length === 0}>
        <ResponsiveContainer>
          <BarChart data={days}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="label" tick={AXIS} />
            <YAxis allowDecimals={false} tick={AXIS} width={32} />
            <Tooltip contentStyle={tooltipStyle()} />
            <Bar dataKey="registered" name={t("an_signups")} fill={COLORS.primary} radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
      <section className="overflow-hidden rounded-2xl border bg-card" aria-labelledby="fill-h" data-tour="an-table">
        <h2 id="fill-h" className="border-b px-5 py-3 font-bold">
          {t("an_fill")}
        </h2>
        {overview.conferences.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">{t("an_no_data")}</p>
        ) : (
          <ul className="divide-y">
            {overview.conferences.map((c) => {
              const fill = c.capacity ? Math.min(100, (c.registered / c.capacity) * 100) : 0;
              return (
                <li key={c.id} className="grid gap-2 px-5 py-3 sm:grid-cols-[1fr_220px] sm:items-center">
                  <div className="min-w-0">
                    <Link href={`/dashboard/analytics?conference=${c.id}`} className="truncate font-semibold hover:text-primary">
                      {c.title}
                    </Link>
                    <p className="text-xs text-muted-foreground">{formatDate(c.startsAt, locale)}</p>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden>
                      <div className="h-full rounded-full bg-gradient-to-r from-brand to-brand-2" style={{ width: `${fill}%` }} />
                    </div>
                    <span className="w-24 text-right tabular-nums text-muted-foreground">
                      {formatNumber(c.registered, locale)}
                      {c.capacity ? ` / ${formatNumber(c.capacity, locale)}` : ""}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function ConferenceView({ id }: { id: string }) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const [{ data, fetching }] = useQuery({ query: ConferenceAnalyticsQuery, variables: { conferenceId: id }, requestPolicy: "cache-and-network" });
  const a = data?.conferenceAnalytics.__typename === "ConferenceAnalytics" ? data.conferenceAnalytics : null;
  if (!a) return fetching ? <div className="h-72 animate-pulse rounded-2xl bg-muted" /> : <p className="rounded-2xl border p-6">{t("conf_not_yours")}</p>;

  const days = a.byDay.map((d) => ({ ...d, label: formatDay(d.day, locale, "month-day") }));
  const arrivals = a.arrivals.map((s) => ({ ...s, label: formatTime(s.at, locale) }));
  const status = a.byStatus.map((s) => ({ name: t(`status_${s.key}`), count: s.count }));
  const languages = a.byLanguage.map((s) => ({ name: t(`language_name_${s.key}`), count: s.count }));

  return (
    <div className="space-y-6">
      <dl className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Tile label={t("an_fill")} value={pct(a.registered, a.capacity)} sub={a.capacity ? `${formatNumber(a.registered, locale)} / ${formatNumber(a.capacity, locale)}` : undefined} icon={BarChart3} tone="from-sky-500 to-blue-600" />
        <Tile label={t("an_confirm_rate")} value={pct(a.everConfirmed, a.totalSignups)} icon={CheckCircle2} tone="from-emerald-500 to-teal-600" />
        <Tile label={t("an_show_rate")} value={pct(a.checkedIn, a.confirmed)} sub={`${formatNumber(a.checkedIn, locale)} / ${formatNumber(a.confirmed, locale)}`} icon={ScanLine} tone="from-violet-500 to-fuchsia-600" />
        <Tile label={t("stat_waitlisted")} value={formatNumber(a.waitlisted, locale)} icon={Users} tone="from-amber-500 to-orange-600" />
      </dl>
      <div className="grid gap-6 xl:grid-cols-2">
        <ChartCard title={t("an_by_day")} empty={days.length === 0}>
          <ResponsiveContainer>
            <BarChart data={days}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="label" tick={AXIS} />
              <YAxis allowDecimals={false} tick={AXIS} width={32} />
              <Tooltip contentStyle={tooltipStyle()} />
              <Legend />
              <Bar dataKey="registered" name={t("an_signups")} stackId="a" fill={COLORS.primary} />
              <Bar dataKey="left" name={t("an_left")} fill={COLORS.left} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title={t("an_arrivals")} sub={t("an_arrivals_sub")} empty={arrivals.length === 0}>
          <ResponsiveContainer>
            <AreaChart data={arrivals}>
              <defs>
                <linearGradient id="arrivals-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={COLORS.arrivals} stopOpacity={0.6} />
                  <stop offset="100%" stopColor={COLORS.arrivals} stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="label" tick={AXIS} />
              <YAxis allowDecimals={false} tick={AXIS} width={32} />
              <Tooltip contentStyle={tooltipStyle()} />
              <Area type="monotone" dataKey="count" name={t("an_arrivals")} stroke={COLORS.arrivals} fill="url(#arrivals-fill)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title={t("an_by_status")} empty={status.length === 0}>
          <ResponsiveContainer>
            <BarChart data={status} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={AXIS} />
              <YAxis type="category" dataKey="name" tick={AXIS} width={140} />
              <Tooltip contentStyle={tooltipStyle()} />
              <Bar dataKey="count" name={t("an_signups")} fill={COLORS.primary} radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title={t("an_by_language")} empty={languages.length === 0}>
          <ResponsiveContainer>
            <BarChart data={languages}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="name" tick={AXIS} />
              <YAxis allowDecimals={false} tick={AXIS} width={32} />
              <Tooltip contentStyle={tooltipStyle()} />
              <Bar dataKey="count" name={t("an_signups")} fill={COLORS.wait} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
      <FeedbackPanel id={id} />
    </div>
  );
}
