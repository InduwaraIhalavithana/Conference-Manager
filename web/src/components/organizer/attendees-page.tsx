"use client";

import { ArrowLeft, BellRing, Download, Loader2, MoreHorizontal, ScanLine, Search, Trash2, Undo2, UserCheck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useMutation, useQuery } from "urql";

import { AttendeesQuery, MyConferenceQuery, RemoveAttendee, SendReminders, UndoCheckIn } from "@/components/organizer/conference-queries";
import { ConfirmDialog } from "@/components/organizer/editor-bits";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import type { AttendeesQuery as Result, RegistrationStatus } from "@/graphql/generated/graphql";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { errorMessage } from "@/lib/errors";
import { formatDate, formatNumber, formatTime, localized } from "@/lib/format";
import { cn } from "@/lib/utils";

type Attendee = Extract<Result["attendees"], { __typename: "AttendeeConnection" }>["edges"][number]["node"];
type Filter = "all" | "registered" | "waitlisted" | "held" | "checked" | "gone";

const FILTERS: Record<Filter, { statuses: RegistrationStatus[] | null; checkedIn: boolean | null }> = {
  all: { statuses: ["HELD", "REGISTERED", "WAITLISTED"], checkedIn: null },
  registered: { statuses: ["REGISTERED"], checkedIn: null },
  waitlisted: { statuses: ["WAITLISTED"], checkedIn: null },
  held: { statuses: ["HELD"], checkedIn: null },
  checked: { statuses: null, checkedIn: true },
  gone: { statuses: ["CANCELLED", "RELEASED"], checkedIn: null },
};

const STATUS_STYLE: Record<RegistrationStatus, string> = {
  REGISTERED: "bg-success/15 text-success",
  WAITLISTED: "bg-warning/15 text-warning",
  HELD: "bg-muted text-muted-foreground",
  CANCELLED: "bg-destructive/12 text-destructive",
  RELEASED: "bg-destructive/12 text-destructive",
};

const PAGE = 50;

export function AttendeesPage({ id }: { id: string }) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const [filter, setFilter] = useState<Filter>("all");
  const [typed, setTyped] = useState("");
  const [q, setQ] = useState("");
  // Cursors of the pages after the first ("Show more"); a new filter or search clears them.
  const [more, setMore] = useState<string[]>([]);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQ(typed.trim());
      setMore([]);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [typed]);

  const [{ data: confData }, refetchConf] = useQuery({ query: MyConferenceQuery, variables: { id }, requestPolicy: "cache-and-network" });
  const variables = { conferenceId: id, filter: { ...FILTERS[filter], q: q || null }, first: PAGE };
  const [{ data, fetching }, refetch] = useQuery({ query: AttendeesQuery, variables: { ...variables, after: null }, requestPolicy: "network-only" });
  const [, sendReminders] = useMutation(SendReminders);
  const [sending, setSending] = useState(false);

  const page = data?.attendees.__typename === "AttendeeConnection" ? data.attendees : null;
  const rows = page?.edges.map((e) => e.node) ?? [];

  function choose(next: Filter) {
    setFilter(next);
    setMore([]);
  }

  const conf = confData?.myConference.__typename === "Conference" ? confData.myConference : null;
  const reloadAll = () => {
    setMore([]);
    setVersion((v) => v + 1);
    refetch({ requestPolicy: "network-only" });
    refetchConf({ requestPolicy: "network-only" });
  };

  const counters = conf?.counters;
  const filters: { key: Filter; label: string; count?: number }[] = [
    { key: "all", label: t("tab_all"), count: counters ? counters.registered + counters.waitlisted : undefined },
    { key: "registered", label: t("status_registered"), count: counters?.confirmed },
    { key: "waitlisted", label: t("status_waitlisted"), count: counters?.waitlisted },
    { key: "held", label: t("status_held") },
    { key: "checked", label: t("checked_in"), count: counters?.checkedIn },
    { key: "gone", label: t("status_cancelled") },
  ];

  if (confData?.myConference.__typename === "UserError") {
    return (
      <div className="rounded-3xl border p-10 text-center">
        <h1 className="text-2xl font-bold">{t("conf_not_found")}</h1>
        <p className="mt-1 text-muted-foreground">{t("conf_not_yours")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <Link href={`/dashboard/conferences/${id}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden /> {conf ? localized(conf.title, locale) : t("edit_conference")}
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">{t("attendees")}</h1>
            {conf && <p className="mt-1 text-muted-foreground">{localized(conf.title, locale)}</p>}
          </div>
          <div className="flex flex-wrap gap-2" data-tour="at-tools">
            {conf?.status === "PUBLISHED" && !conf.ended && (
              <Button asChild variant="outline" className="rounded-xl">
                <Link href={`/dashboard/conferences/${id}/check-in`}>
                  <ScanLine className="size-4" aria-hidden /> {t("ci_open_desk")}
                </Link>
              </Button>
            )}
            <Button asChild variant="outline" className="rounded-xl">
              <a href={`/api/conferences/${id}/attendees.csv`} download>
                <Download className="size-4" aria-hidden /> {t("export_csv")}
              </a>
            </Button>
            <Button
              className="rounded-xl"
              disabled={sending || !conf || conf.status !== "PUBLISHED" || conf.ended}
              aria-describedby="reminders-hint"
              onClick={async () => {
                setSending(true);
                const result = (await sendReminders({ conferenceId: id })).data?.sendRemindersNow;
                setSending(false);
                if (result?.__typename === "RemindersSent") {
                  if (result.count === 0) toast.message(t("reminders_none"));
                  else toast.success(t("reminders_sent", { count: result.count }));
                } else if (result?.__typename === "UserError") toast.error(errorMessage(t, result));
              }}
            >
              {sending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <BellRing className="size-4" aria-hidden />} {t("send_reminders")}
            </Button>
          </div>
        </div>
        <p id="reminders-hint" className="text-right text-xs text-muted-foreground">
          {t("reminders_body")}
        </p>
      </header>

      {counters && (
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4" data-tour="at-stats">
          {[
            { label: t("stat_seats_taken"), value: counters.registered, tone: "text-sky-500" },
            { label: t("stat_confirmed"), value: counters.confirmed, tone: "text-success" },
            { label: t("stat_waitlisted"), value: counters.waitlisted, tone: "text-warning" },
            { label: t("stat_checked_in"), value: counters.checkedIn, tone: "text-violet-500" },
          ].map((s) => (
            <div key={s.label} className="flex flex-col-reverse rounded-2xl border bg-card p-4">
              <dt className="text-sm text-muted-foreground">{s.label}</dt>
              <dd className={cn("text-2xl font-extrabold tabular-nums", s.tone)}>{formatNumber(s.value, locale)}</dd>
            </div>
          ))}
        </dl>
      )}

      <div className="flex flex-wrap items-center gap-3" data-tour="at-filters">
        <div className="flex flex-wrap gap-1 rounded-xl bg-muted p-1" role="tablist" aria-label={t("field_status")}>
          {filters.map((f) => (
            <button
              key={f.key}
              role="tab"
              aria-selected={filter === f.key}
              onClick={() => choose(f.key)}
              className={cn("rounded-lg px-3 py-1.5 text-sm font-medium transition", filter === f.key ? "bg-background shadow" : "text-muted-foreground hover:text-foreground")}
            >
              {f.label}
              {f.count !== undefined && <span className="ml-1 text-xs tabular-nums text-muted-foreground">{f.count}</span>}
            </button>
          ))}
        </div>
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={t("search_attendees")} aria-label={t("search")} className="h-10 pl-9" />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card">
        {page && (
          <p className="border-b px-4 py-2 text-xs text-muted-foreground" aria-live="polite">
            {t("shown_of_total", { shown: formatNumber(Math.min(page.totalCount, rows.length + more.length * PAGE), locale), total: formatNumber(page.totalCount, locale) })}
          </p>
        )}
        {fetching && rows.length === 0 ? (
          <div className="space-y-2 p-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="p-10 text-center text-muted-foreground">{q ? t("no_results_filtered") : t("attendees_empty")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-2.5">{t("field_name")}</th>
                  <th scope="col" className="px-4 py-2.5">{t("field_status")}</th>
                  <th scope="col" className="hidden px-4 py-2.5 md:table-cell">{t("field_code")}</th>
                  <th scope="col" className="hidden px-4 py-2.5 sm:table-cell">{t("registered_on")}</th>
                  <th scope="col" className="px-4 py-2.5">
                    <span className="sr-only">{t("actions")}</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((a) => (
                  <AttendeeRow key={a.id} attendee={a} conferenceId={id} timezone={conf?.timezone} onChanged={reloadAll} />
                ))}
                {more.map((cursor, i) => (
                  <MoreRows
                    key={`${version}-${cursor}`}
                    variables={{ ...variables, after: cursor }}
                    timezone={conf?.timezone}
                    onChanged={reloadAll}
                    onNext={i === more.length - 1 ? (next) => setMore([...more, next]) : undefined}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
        {page?.pageInfo.hasNextPage && more.length === 0 && page.pageInfo.endCursor && (
          <LoadMore onClick={() => setMore([page.pageInfo.endCursor as string])} />
        )}
      </div>
    </div>
  );
}

function LoadMore({ onClick, busy = false }: { onClick: () => void; busy?: boolean }) {
  const t = useTranslations();
  return (
    <div className="border-t p-3 text-center">
      <Button variant="outline" className="rounded-xl" disabled={busy} onClick={onClick}>
        {busy && <Loader2 className="size-4 animate-spin" aria-hidden />} {t("load_more")}
      </Button>
    </div>
  );
}

/** One "Show more" page of rows; the last one offers the next page. */
function MoreRows({
  variables,
  timezone,
  onChanged,
  onNext,
}: {
  variables: { conferenceId: string; filter: { statuses: RegistrationStatus[] | null; checkedIn: boolean | null; q: string | null }; first: number; after: string };
  timezone?: string;
  onChanged: () => void;
  onNext?: (cursor: string) => void;
}) {
  const [{ data, fetching }] = useQuery({ query: AttendeesQuery, variables, requestPolicy: "network-only" });
  const page = data?.attendees.__typename === "AttendeeConnection" ? data.attendees : null;
  return (
    <>
      {page?.edges.map((e) => (
        <AttendeeRow key={e.node.id} attendee={e.node} conferenceId={variables.conferenceId} timezone={timezone} onChanged={onChanged} />
      ))}
      {onNext && page?.pageInfo.hasNextPage && page.pageInfo.endCursor && (
        <tr>
          <td colSpan={5} className="p-0">
            <LoadMore busy={fetching} onClick={() => onNext(page.pageInfo.endCursor as string)} />
          </td>
        </tr>
      )}
    </>
  );
}

function AttendeeRow({ attendee: a, conferenceId, timezone, onChanged }: { attendee: Attendee; conferenceId: string; timezone?: string; onChanged: () => void }) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const [, remove] = useMutation(RemoveAttendee);
  const [, undo] = useMutation(UndoCheckIn);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const active = a.status === "HELD" || a.status === "REGISTERED" || a.status === "WAITLISTED";
  const statusLabel = { REGISTERED: t("status_registered"), WAITLISTED: t("status_waitlisted"), HELD: t("status_held"), CANCELLED: t("status_cancelled"), RELEASED: t("status_released") }[a.status];

  return (
    <tr className="hover:bg-accent/40">
      <td className="px-4 py-3">
        <p className="font-semibold">{a.name}</p>
        <p className="text-xs text-muted-foreground">{a.email}</p>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", STATUS_STYLE[a.status])}>{statusLabel}</span>
          {a.checkedInAt && (
            <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/15 px-2 py-0.5 text-xs font-semibold text-violet-600 dark:text-violet-300">
              <UserCheck className="size-3" aria-hidden /> {t("checked_in")}
            </span>
          )}
          {a.promotedAt && <span className="text-xs text-muted-foreground">{t("promoted_badge")}</span>}
        </div>
      </td>
      <td className="hidden px-4 py-3 font-mono text-xs md:table-cell">{a.ticketCode}</td>
      <td className="hidden px-4 py-3 text-xs text-muted-foreground sm:table-cell">
        {formatDate(a.createdAt, locale, "short", timezone)}, {formatTime(a.createdAt, locale, timezone)}
      </td>
      <td className="px-2 py-3 text-right">
        {(active || a.checkedInAt) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" data-tour="at-actions" aria-label={`${t("actions")}: ${a.name}`}>
                <MoreHorizontal className="size-4" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {a.checkedInAt && (
                <DropdownMenuItem
                  onSelect={async () => {
                    const result = (await undo({ conferenceId, attendeeId: a.id })).data?.undoCheckIn;
                    if (result?.__typename === "Attendee") onChanged();
                    else if (result?.__typename === "UserError") toast.error(errorMessage(t, result));
                  }}
                >
                  <Undo2 className="size-4" aria-hidden /> {t("undo_check_in")}
                </DropdownMenuItem>
              )}
              {active && !a.checkedInAt && (
                <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setConfirmRemove(true)}>
                  <Trash2 className="size-4" aria-hidden /> {t("remove_attendee")}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <ConfirmDialog
          open={confirmRemove}
          onOpenChange={setConfirmRemove}
          title={t("remove_attendee_title")}
          body={a.status === "REGISTERED" ? t("cancel_attendee_body_promote", { name: a.name }) : t("cancel_attendee_body", { name: a.name })}
          confirmLabel={t("remove_attendee")}
          onConfirm={async () => {
            const result = (await remove({ conferenceId, attendeeId: a.id })).data?.removeAttendee;
            if (result?.__typename === "Attendee") {
              toast.success(t("attendee_cancelled", { name: a.name }));
              onChanged();
            } else if (result?.__typename === "UserError") toast.error(errorMessage(t, result));
          }}
        />
      </td>
    </tr>
  );
}
