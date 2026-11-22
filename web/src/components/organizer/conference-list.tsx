"use client";

import { CalendarDays, Copy, ExternalLink, MapPin, MoreHorizontal, Pencil, Plus, Search, Trash2, Users } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useMutation, useQuery } from "urql";

import { CategoryChip } from "@/components/conference/conference-card";
import { DeleteConference, DuplicateConference, MyConferencesQuery } from "@/components/organizer/conference-queries";
import { ConfirmDialog, StatusBadge } from "@/components/organizer/editor-bits";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import type { MyConferencesQuery as Result } from "@/graphql/generated/graphql";
import { Link, useRouter } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { CATEGORIES } from "@/lib/categories";
import { errorMessage } from "@/lib/errors";
import { formatNumber, formatRange, localized } from "@/lib/format";
import { cn } from "@/lib/utils";

type Item = Extract<Result["myConferences"], { __typename: "ConferenceList" }>["items"][number];
type Tab = "all" | "drafts" | "upcoming" | "past";

function inTab(c: Item, tab: Tab): boolean {
  if (tab === "drafts") return c.status === "DRAFT";
  if (tab === "upcoming") return c.status === "PUBLISHED" && !c.ended;
  if (tab === "past") return c.ended || c.status === "CANCELLED";
  return true;
}

export function ConferenceList() {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const [{ data, fetching }, refetch] = useQuery({ query: MyConferencesQuery, requestPolicy: "cache-and-network" });
  const [tab, setTab] = useState<Tab>("all");
  const [q, setQ] = useState("");
  const items = useMemo(() => (data?.myConferences.__typename === "ConferenceList" ? data.myConferences.items : []), [data]);
  const shown = items
    .filter((c) => inTab(c, tab))
    .filter((c) => !q.trim() || [c.title.en, c.title.si, c.title.ta, c.venue.city].some((v) => v?.toLowerCase().includes(q.trim().toLowerCase())));
  const tabs: { key: Tab; label: string }[] = [
    { key: "all", label: t("tab_all") },
    { key: "drafts", label: t("tab_drafts") },
    { key: "upcoming", label: t("tab_upcoming") },
    { key: "past", label: t("tab_past") },
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">{t("nav_my_conferences")}</h1>
          <p className="mt-1 text-muted-foreground">{t("my_conferences_sub")}</p>
        </div>
        <Button asChild className="rounded-xl" data-tour="mc-create">
          <Link href="/dashboard/conferences/new">
            <Plus className="size-4" aria-hidden /> {t("new_conference")}
          </Link>
        </Button>
      </header>

      <div className="flex flex-wrap items-center gap-3" data-tour="mc-filters">
        <div className="flex gap-1 rounded-xl bg-muted p-1" role="tablist" aria-label={t("nav_my_conferences")}>
          {tabs.map((item) => (
            <button
              key={item.key}
              role="tab"
              aria-selected={tab === item.key}
              onClick={() => setTab(item.key)}
              className={cn("rounded-lg px-3 py-1.5 text-sm font-medium transition", tab === item.key ? "bg-background shadow" : "text-muted-foreground hover:text-foreground")}
            >
              {item.label} <span className="ml-1 text-xs tabular-nums text-muted-foreground">{items.filter((c) => inTab(c, item.key)).length}</span>
            </button>
          ))}
        </div>
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("search_my_conferences")} aria-label={t("search")} className="h-10 pl-9" />
        </div>
      </div>

      {fetching && !data ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-44 animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-3xl border border-dashed p-12 text-center">
          <CalendarDays className="mx-auto size-10 text-primary" aria-hidden />
          <h2 className="mt-3 text-xl font-bold">{t("no_conferences_yet")}</h2>
          <p className="mx-auto mt-1 max-w-md text-muted-foreground">{t("no_conferences_yet_body")}</p>
          <Button asChild className="mt-5 rounded-xl">
            <Link href="/dashboard/conferences/new">
              <Plus className="size-4" aria-hidden /> {t("new_conference")}
            </Link>
          </Button>
        </div>
      ) : shown.length === 0 ? (
        <p className="rounded-2xl border p-8 text-center text-muted-foreground">{t("no_results_filtered")}</p>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {shown.map((c) => (
            <ConferenceRow key={c.id} conference={c} locale={locale} onChanged={() => refetch({ requestPolicy: "network-only" })} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ConferenceRow({ conference: c, locale, onChanged }: { conference: Item; locale: Locale; onChanged: () => void }) {
  const t = useTranslations();
  const router = useRouter();
  const [, duplicate] = useMutation(DuplicateConference);
  const [, remove] = useMutation(DeleteConference);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const title = localized(c.title, locale);
  const pct = c.capacity ? Math.min(100, (c.counters.registered / c.capacity) * 100) : 0;
  const canDelete = c.status === "DRAFT" && c.counters.registered === 0 && c.counters.waitlisted === 0;

  async function copy() {
    const result = (await duplicate({ id: c.id })).data?.duplicateConference;
    if (result?.__typename === "Conference") {
      toast.success(t("duplicated"));
      router.push(`/dashboard/conferences/${result.id}`);
    } else if (result?.__typename === "UserError") toast.error(errorMessage(t, result));
  }

  return (
    <li className="group flex animate-rise flex-col overflow-hidden rounded-2xl border bg-card shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
      <div className={cn("relative h-24 bg-gradient-to-br", CATEGORIES[c.category].cover)}>
        {c.coverUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/api${c.coverUrl}`} alt="" className="size-full object-cover" />
        )}
        <div className="absolute left-3 top-3 flex gap-2">
          <StatusBadge status={c.status} ended={c.ended} />
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Link href={`/dashboard/conferences/${c.id}`} className="line-clamp-2 text-lg font-bold hover:text-primary">
              {title}
            </Link>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="size-3.5" aria-hidden /> {formatRange(c.startsAt, c.endsAt, locale, c.timezone)}
              </span>
              {c.venue.city && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-3.5" aria-hidden /> {c.venue.city}
                </span>
              )}
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" data-tour="mc-actions" aria-label={`${t("actions")}: ${title}`}>
                <MoreHorizontal className="size-4" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link href={`/dashboard/conferences/${c.id}`}>
                  <Pencil className="size-4" aria-hidden /> {t("edit")}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/dashboard/conferences/${c.id}/attendees`}>
                  <Users className="size-4" aria-hidden /> {t("attendees")}
                </Link>
              </DropdownMenuItem>
              {c.status !== "DRAFT" && (
                <DropdownMenuItem asChild>
                  <Link href={`/c/${c.slug}`} target="_blank">
                    <ExternalLink className="size-4" aria-hidden /> {t("view_public")}
                  </Link>
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onSelect={copy}>
                <Copy className="size-4" aria-hidden /> {t("duplicate")}
              </DropdownMenuItem>
              {canDelete && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setConfirmDelete(true)}>
                    <Trash2 className="size-4" aria-hidden /> {t("delete")}
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="flex items-center justify-between gap-3">
          <CategoryChip category={c.category} />
          <Link href={`/dashboard/conferences/${c.id}/attendees`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
            <Users className="size-4" aria-hidden /> {t("n_registered", { count: formatNumber(c.counters.registered, locale) })}
          </Link>
        </div>
        {c.capacity !== null && (
          <div className="mt-auto flex items-center gap-3 text-xs">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden>
              <div className="h-full rounded-full bg-gradient-to-r from-brand to-brand-2" style={{ width: `${pct}%` }} />
            </div>
            <span className="tabular-nums text-muted-foreground">
              {t("seats_of", { taken: formatNumber(c.counters.registered, locale), capacity: formatNumber(c.capacity, locale) })}
            </span>
          </div>
        )}
      </div>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t("delete_conf_title")}
        body={t("delete_conf_body", { title, count: 0 })}
        confirmLabel={t("delete")}
        onConfirm={async () => {
          const result = (await remove({ id: c.id })).data?.deleteConference;
          if (result?.__typename === "Done") {
            toast.success(t("conf_deleted"));
            onChanged();
          } else if (result?.__typename === "UserError") toast.error(errorMessage(t, result));
        }}
      />
    </li>
  );
}
