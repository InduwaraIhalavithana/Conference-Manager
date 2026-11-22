"use client";

import { Eye, EyeOff, MoreHorizontal, RotateCcw, Search, Trash2, UserX } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useMutation, useQuery } from "urql";

import { PageHeader, Pager } from "@/components/admin/admin-shell";
import {
  AdminConferencesQuery,
  AdminOrganizersQuery,
  DeleteOrganizer,
  RestoreOrganizer,
  SetConferenceHidden,
  SuspendOrganizer,
} from "@/components/admin/admin-queries";
import { ConfirmDialog } from "@/components/organizer/editor-bits";
import { Avatar } from "@/components/site/account-menu";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import type { AdminConferenceFilter, AdminOrganizersQuery as OrgResult, OrganizerFilter } from "@/graphql/generated/graphql";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { errorMessage } from "@/lib/errors";
import { formatDate, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

const PAGE = 25;

function useDebounced(value: string, ms = 300): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value.trim()), ms);
    return () => window.clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

function Tabs<T extends string>({ value, options, onChange, label }: { value: T; options: { key: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="flex flex-wrap gap-1 rounded-xl bg-muted p-1" role="tablist" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.key}
          role="tab"
          aria-selected={value === o.key}
          onClick={() => onChange(o.key)}
          className={cn("rounded-lg px-3 py-1.5 text-sm font-medium transition", value === o.key ? "bg-background shadow" : "text-muted-foreground hover:text-foreground")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  const t = useTranslations();
  return (
    <div className="relative min-w-56 flex-1">
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={t("search")} className="h-10 pl-9" />
    </div>
  );
}

// ── Organizers ───────────────────────────────────────────────────────────────────────────────────────

type OrgItem = Extract<OrgResult["adminOrganizers"], { __typename: "AdminOrganizerPage" }>["items"][number];

export function AdminOrganizers() {
  const t = useTranslations();
  const [status, setStatus] = useState<OrganizerFilter>("ALL");
  const [typed, setTyped] = useState("");
  const q = useDebounced(typed);
  const [offset, setOffset] = useState(0);
  const [{ data, fetching }, refetch] = useQuery({
    query: AdminOrganizersQuery,
    variables: { q: q || null, status, first: PAGE, offset },
    requestPolicy: "cache-and-network",
  });
  const page = data?.adminOrganizers.__typename === "AdminOrganizerPage" ? data.adminOrganizers : null;
  const reload = () => refetch({ requestPolicy: "network-only" });

  return (
    <div>
      <PageHeader title={t("nav_organizers")} sub={t("admin_organizers_sub")} />
      <div className="mb-4 flex flex-wrap items-center gap-3" data-tour="ao-filters">
        <Tabs
          value={status}
          label={t("field_status")}
          onChange={(v) => {
            setStatus(v);
            setOffset(0);
          }}
          options={[
            { key: "ALL", label: t("filter_all_accounts") },
            { key: "ACTIVE", label: t("status_active") },
            { key: "SUSPENDED", label: t("status_suspended") },
            { key: "UNVERIFIED", label: t("status_unverified") },
          ]}
        />
        <SearchBox value={typed} onChange={(v) => { setTyped(v); setOffset(0); }} placeholder={t("search_organizers")} />
      </div>
      <div className="overflow-hidden rounded-2xl border bg-card">
        {fetching && !page ? (
          <div className="h-60 animate-pulse bg-muted" />
        ) : !page || page.items.length === 0 ? (
          <p className="p-10 text-center text-muted-foreground">{t("no_results_filtered")}</p>
        ) : (
          <ul className="divide-y">
            {page.items.map((item) => (
              <OrganizerRow key={item.organizer.id} item={item} onChanged={reload} />
            ))}
          </ul>
        )}
        {page && <Pager offset={offset} total={page.total} size={PAGE} onChange={setOffset} />}
      </div>
    </div>
  );
}

function OrganizerRow({ item, onChanged }: { item: OrgItem; onChanged: () => void }) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const [, suspend] = useMutation(SuspendOrganizer);
  const [, restore] = useMutation(RestoreOrganizer);
  const [, remove] = useMutation(DeleteOrganizer);
  const [confirm, setConfirm] = useState<"suspend" | "restore" | "delete" | null>(null);
  const o = item.organizer;
  const name = `${o.firstName} ${o.lastName}`;

  async function run(action: "suspend" | "restore" | "delete") {
    const result =
      action === "suspend"
        ? (await suspend({ id: o.id })).data?.suspendOrganizer
        : action === "restore"
          ? (await restore({ id: o.id })).data?.restoreOrganizer
          : (await remove({ id: o.id })).data?.deleteOrganizer;
    if (result && result.__typename !== "UserError") {
      toast.success(t(action === "suspend" ? "org_suspend_done" : action === "restore" ? "org_unsuspend_done" : "org_delete_done", { name }));
      onChanged();
    } else if (result?.__typename === "UserError") toast.error(errorMessage(t, result));
  }

  return (
    <li className="flex flex-wrap items-center gap-3 px-4 py-3">
      <Avatar name={name} url={o.avatarUrl} className="size-10 text-sm" />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 font-semibold">
          {name}
          {item.suspended && <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs font-semibold text-white">{t("status_suspended")}</span>}
          {!o.emailVerified && <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">{t("status_unverified")}</span>}
        </p>
        <p className="truncate text-sm text-muted-foreground">
          {o.email}
          {o.organization ? ` · ${o.organization}` : ""}
        </p>
      </div>
      <div className="text-right text-xs text-muted-foreground">
        <p className="font-semibold text-foreground">{t("n_conferences", { count: formatNumber(item.conferences, locale) })}</p>
        <p>{t("member_since", { date: formatDate(o.createdAt, locale) })}</p>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" data-tour="ao-actions" aria-label={`${t("actions")}: ${name}`}>
            <MoreHorizontal className="size-4" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {item.suspended ? (
            <DropdownMenuItem onSelect={() => setConfirm("restore")}>
              <RotateCcw className="size-4" aria-hidden /> {t("restore")}
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={() => setConfirm("suspend")}>
              <UserX className="size-4" aria-hidden /> {t("suspend")}
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setConfirm("delete")}>
            <Trash2 className="size-4" aria-hidden /> {t("delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={t(confirm === "suspend" ? "org_suspend_title" : confirm === "restore" ? "org_unsuspend_title" : "org_delete_title")}
        body={confirm === "delete" ? t("org_delete_body", { name, count: item.conferences }) : t(confirm === "restore" ? "org_unsuspend_body" : "org_suspend_body", { name })}
        confirmLabel={t(confirm === "suspend" ? "suspend" : confirm === "restore" ? "restore" : "delete")}
        onConfirm={() => run(confirm ?? "suspend")}
      />
    </li>
  );
}

// ── Conferences ──────────────────────────────────────────────────────────────────────────────────────

export function AdminConferences() {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const [status, setStatus] = useState<AdminConferenceFilter>("ALL");
  const [typed, setTyped] = useState("");
  const q = useDebounced(typed);
  const [offset, setOffset] = useState(0);
  const [{ data, fetching }, refetch] = useQuery({
    query: AdminConferencesQuery,
    variables: { q: q || null, status, first: PAGE, offset },
    requestPolicy: "cache-and-network",
  });
  const [, setHidden] = useMutation(SetConferenceHidden);
  const [hiding, setHiding] = useState<{ id: string; title: string } | null>(null);
  const page = data?.adminConferences.__typename === "AdminConferencePage" ? data.adminConferences : null;

  async function toggle(id: string, hidden: boolean) {
    const result = (await setHidden({ id, hidden })).data?.setConferenceHidden;
    if (result?.__typename === "AdminConference") {
      toast.success(t("saved"));
      refetch({ requestPolicy: "network-only" });
    } else if (result?.__typename === "UserError") toast.error(errorMessage(t, result));
  }

  // "archived" is in the data model but nothing sets it yet; it reads as ended.
  const statusLabel = (s: string) => t(s === "archived" ? "status_ended" : `status_${s}`);

  return (
    <div>
      <PageHeader title={t("nav_conferences")} sub={t("admin_conferences_sub")} />
      <div className="mb-4 flex flex-wrap items-center gap-3" data-tour="ac-filters">
        <Tabs
          value={status}
          label={t("field_status")}
          onChange={(v) => {
            setStatus(v);
            setOffset(0);
          }}
          options={[
            { key: "ALL", label: t("tab_all") },
            { key: "UPCOMING", label: t("tab_upcoming") },
            { key: "PAST", label: t("tab_past") },
            { key: "DRAFT", label: t("status_draft") },
            { key: "CANCELLED", label: t("status_cancelled") },
            { key: "HIDDEN", label: t("badge_hidden") },
          ]}
        />
        <SearchBox value={typed} onChange={(v) => { setTyped(v); setOffset(0); }} placeholder={t("search_admin_conferences")} />
      </div>
      <div className="overflow-hidden rounded-2xl border bg-card">
        {fetching && !page ? (
          <div className="h-60 animate-pulse bg-muted" />
        ) : !page || page.items.length === 0 ? (
          <p className="p-10 text-center text-muted-foreground">{t("no_results_filtered")}</p>
        ) : (
          <ul className="divide-y">
            {page.items.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-semibold">
                    {c.status === "draft" ? (
                      c.title
                    ) : (
                      <Link href={`/c/${c.slug}`} target="_blank" className="hover:text-primary">
                        {c.title}
                      </Link>
                    )}
                    <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">{statusLabel(c.status)}</span>
                    {c.hidden && (
                      <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs font-semibold text-white">
                        {c.hiddenReason === "suspended" ? t("badge_hidden_suspended") : t("badge_hidden")}
                      </span>
                    )}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">
                    {formatDate(c.startsAt, locale)}
                    {c.city ? ` · ${c.city}` : ""} · {c.organizerName ?? "–"}
                    {c.organizerEmail ? ` (${c.organizerEmail})` : ""}
                  </p>
                </div>
                <span className="text-sm tabular-nums text-muted-foreground">
                  {formatNumber(c.registered, locale)}
                  {c.capacity ? ` / ${formatNumber(c.capacity, locale)}` : ""}
                </span>
                {c.hidden ? (
                  <Button variant="outline" size="sm" className="rounded-lg" onClick={() => toggle(c.id, false)} disabled={c.hiddenReason === "suspended"}>
                    <Eye className="size-4" aria-hidden /> {t("show_conference")}
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" className="rounded-lg" onClick={() => setHiding({ id: c.id, title: c.title })} data-tour="ac-hide">
                    <EyeOff className="size-4" aria-hidden /> {t("hide_conference")}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
        {page && <Pager offset={offset} total={page.total} size={PAGE} onChange={setOffset} />}
      </div>
      <ConfirmDialog
        open={hiding !== null}
        onOpenChange={(open) => !open && setHiding(null)}
        title={t("conf_hide_title")}
        body={t("conf_hide_body", { title: hiding?.title ?? "" })}
        confirmLabel={t("hide_conference")}
        onConfirm={() => toggle(hiding?.id ?? "", true)}
      />
    </div>
  );
}
