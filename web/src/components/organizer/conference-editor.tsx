"use client";

import { AlertTriangle, ArrowLeft, Ban, BarChart3, CheckCircle2, ScanLine, Copy, ExternalLink, Rocket, Undo2, Users } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { useMutation, useQuery } from "urql";

import { AgendaEditor } from "@/components/organizer/agenda-editor";
import { CancelConference, DuplicateConference, MyConferenceQuery, PublishConference, UnpublishConference } from "@/components/organizer/conference-queries";
import { DetailsForm } from "@/components/organizer/details-form";
import { ConfirmDialog, StatusBadge } from "@/components/organizer/editor-bits";
import { SpeakersEditor } from "@/components/organizer/speakers-editor";
import { Button } from "@/components/ui/button";
import type { EditorConferenceFieldsFragment } from "@/graphql/generated/graphql";
import { Link, useRouter } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { errorMessage } from "@/lib/errors";
import { formatNumber, formatRange, localized } from "@/lib/format";
import { cn } from "@/lib/utils";

type Tab = "details" | "agenda" | "speakers" | "publish";

export function ConferenceEditor({ id }: { id: string }) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const [{ data, fetching }, refetch] = useQuery({ query: MyConferenceQuery, variables: { id }, requestPolicy: "cache-and-network" });
  const [tab, setTab] = useState<Tab>("details");
  const reload = () => refetch({ requestPolicy: "network-only" });
  const result = data?.myConference;

  if (!result) {
    return fetching ? <div className="h-96 animate-pulse rounded-3xl bg-muted" /> : null;
  }
  if (result.__typename === "UserError") {
    return (
      <div className="rounded-3xl border p-10 text-center">
        <h1 className="text-2xl font-bold">{t("conf_not_found")}</h1>
        <p className="mt-1 text-muted-foreground">{t("conf_not_yours")}</p>
        <Button asChild variant="outline" className="mt-5 rounded-xl">
          <Link href="/dashboard/conferences">
            <ArrowLeft className="size-4" aria-hidden /> {t("nav_my_conferences")}
          </Link>
        </Button>
      </div>
    );
  }

  const c = result;
  const editable = c.status === "DRAFT" || c.status === "PUBLISHED";
  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "details", label: t("tab_details") },
    { key: "agenda", label: t("tab_agenda"), count: c.sessions.length },
    { key: "speakers", label: t("tab_speakers"), count: c.speakers.length },
    { key: "publish", label: t("tab_publish"), count: c.status === "DRAFT" ? c.publishProblems.length || undefined : undefined },
  ];

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <Link href="/dashboard/conferences" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden /> {t("nav_my_conferences")}
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={c.status} ended={c.ended} />
              <span className="text-sm text-muted-foreground">{formatRange(c.startsAt, c.endsAt, locale, c.timezone)}</span>
            </div>
            <h1 className="mt-1 text-3xl font-extrabold tracking-tight">{localized(c.title, locale)}</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" className="rounded-xl">
              <Link href={`/dashboard/conferences/${c.id}/attendees`}>
                <Users className="size-4" aria-hidden /> {t("attendees")} · {formatNumber(c.counters.registered + c.counters.waitlisted, locale)}
              </Link>
            </Button>
            {c.status === "PUBLISHED" && !c.ended && (
              <Button asChild className="rounded-xl">
                <Link href={`/dashboard/conferences/${c.id}/check-in`}>
                  <ScanLine className="size-4" aria-hidden /> {t("ci_open_desk")}
                </Link>
              </Button>
            )}
            <Button asChild variant="outline" className="rounded-xl">
              <Link href={`/dashboard/analytics?conference=${c.id}`}>
                <BarChart3 className="size-4" aria-hidden /> {t("nav_analytics")}
              </Link>
            </Button>
            {c.status !== "DRAFT" && (
              <Button asChild variant="outline" className="rounded-xl">
                <Link href={`/c/${c.slug}`} target="_blank">
                  <ExternalLink className="size-4" aria-hidden /> {t("view_public")}
                </Link>
              </Button>
            )}
          </div>
        </div>
      </header>

      {c.status === "CANCELLED" && (
        <p role="status" className="flex items-center gap-2 rounded-2xl bg-destructive/10 p-4 font-semibold text-destructive">
          <AlertTriangle className="size-5" aria-hidden /> {t("conference_cancelled_banner")}
        </p>
      )}

      <div className="flex gap-1 overflow-x-auto rounded-xl bg-muted p-1" role="tablist" aria-label={t("edit_conference")}>
        {tabs.map((item) => (
          <button
            key={item.key}
            role="tab"
            id={`tab-${item.key}`}
            aria-selected={tab === item.key}
            aria-controls={`panel-${item.key}`}
            onClick={() => setTab(item.key)}
            className={cn("shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition", tab === item.key ? "bg-background shadow" : "text-muted-foreground hover:text-foreground")}
          >
            {item.label}
            {item.count !== undefined && <span className="ml-1.5 rounded-full bg-primary/12 px-1.5 text-xs tabular-nums text-primary">{item.count}</span>}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === "details" &&
          (editable ? <DetailsForm key={c.id} conference={c} onSaved={reload} /> : <ReadOnly />)}
        {tab === "agenda" && (editable ? <AgendaEditor conference={c} reload={reload} /> : <ReadOnly />)}
        {tab === "speakers" && (editable ? <SpeakersEditor conference={c} reload={reload} /> : <ReadOnly />)}
        {tab === "publish" && <PublishPanel conference={c} reload={reload} />}
      </div>
    </div>
  );
}

function ReadOnly() {
  const t = useTranslations();
  return <p className="rounded-2xl border p-6 text-muted-foreground">{t("conference_cancelled_banner")}</p>;
}

function PublishPanel({ conference: c, reload }: { conference: EditorConferenceFieldsFragment; reload: () => void }) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [, publish] = useMutation(PublishConference);
  const [, unpublish] = useMutation(UnpublishConference);
  const [, cancel] = useMutation(CancelConference);
  const [, duplicate] = useMutation(DuplicateConference);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [busy, setBusy] = useState(false);
  const title = localized(c.title, locale);

  async function run<T extends { __typename: string } | undefined>(action: () => Promise<T>, done: string) {
    setBusy(true);
    const result = await action();
    setBusy(false);
    if (result?.__typename === "Conference") {
      toast.success(done);
      reload();
    } else if (result?.__typename === "UserError") toast.error(errorMessage(t, result as never));
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
      <section className="space-y-4 rounded-2xl border bg-card p-5" aria-labelledby="publish-h">
        <h2 id="publish-h" className="text-lg font-bold">
          {c.status === "DRAFT" ? t("publish_checklist") : t("publish_status")}
        </h2>
        {c.status === "DRAFT" ? (
          <>
            <p className="text-sm text-muted-foreground">{t("draft_hint")}</p>
            {c.publishProblems.length === 0 ? (
              <p className="flex items-center gap-2 rounded-xl bg-success/10 p-3 text-sm font-medium text-success">
                <CheckCircle2 className="size-5" aria-hidden /> {t("ready_to_publish")}
              </p>
            ) : (
              <ul className="space-y-2">
                {c.publishProblems.map((p) => (
                  <li key={p} className="flex items-center gap-2 rounded-xl bg-warning/12 p-3 text-sm">
                    <AlertTriangle className="size-4 shrink-0 text-warning" aria-hidden /> {t(`pub_problem_${p.toLowerCase()}`)}
                  </li>
                ))}
              </ul>
            )}
            <Button size="lg" className="rounded-xl" disabled={busy || c.publishProblems.length > 0} onClick={() => run(async () => (await publish({ id: c.id })).data?.publishConference, t("published_done"))}>
              <Rocket className="size-4" aria-hidden /> {t("publish")}
            </Button>
          </>
        ) : c.status === "PUBLISHED" ? (
          <>
            <p className="text-sm text-muted-foreground">{t("published_hint")}</p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" className="rounded-xl" disabled={busy} onClick={() => run(async () => (await unpublish({ id: c.id })).data?.unpublishConference, t("unpublished_done"))}>
                <Undo2 className="size-4" aria-hidden /> {t("unpublish")}
              </Button>
              {!c.ended && (
                <Button variant="destructive" className="rounded-xl" disabled={busy} onClick={() => setConfirmCancel(true)}>
                  <Ban className="size-4" aria-hidden /> {t("cancel_conference")}
                </Button>
              )}
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">{t("conference_cancelled_banner")}</p>
        )}
      </section>
      <section className="space-y-3 rounded-2xl border bg-card p-5">
        <h2 className="text-lg font-bold">{t("duplicate")}</h2>
        <p className="text-sm text-muted-foreground">{t("duplicate_help")}</p>
        <Button
          variant="outline"
          className="rounded-xl"
          onClick={async () => {
            const result = (await duplicate({ id: c.id })).data?.duplicateConference;
            if (result?.__typename === "Conference") {
              toast.success(t("duplicated"));
              router.push(`/dashboard/conferences/${result.id}`);
            } else if (result?.__typename === "UserError") toast.error(errorMessage(t, result));
          }}
        >
          <Copy className="size-4" aria-hidden /> {t("duplicate")}
        </Button>
      </section>
      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title={`${t("cancel_conference")}: ${title}`}
        body={t("cancel_conf_body")}
        confirmLabel={t("cancel_conference")}
        onConfirm={() => run(async () => (await cancel({ id: c.id })).data?.cancelConference, t("conf_cancelled_done"))}
      />
    </div>
  );
}
