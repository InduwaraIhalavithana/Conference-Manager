"use client";

import { CheckCircle2, Mail, MessageSquareReply, RotateCcw, Send, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { useMutation, useQuery } from "urql";

import { ErrorNote, type FormError, SubmitButton } from "@/components/auth/fields";
import { PageHeader, Pager } from "@/components/admin/admin-shell";
import {
  ActivityLogQuery,
  AdminFeedbackQuery,
  CloseFeedback,
  ContactMessagesQuery,
  ReplyToContact,
  ReplyToFeedback,
  SetContactResolved,
} from "@/components/admin/admin-queries";
import { Button } from "@/components/ui/button";
import type { ContactStatus, FeedbackStatus } from "@/graphql/generated/graphql";
import type { Locale } from "@/i18n/routing";
import { errorMessage } from "@/lib/errors";
import { formatDate, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const PAGE = 20;
const TEXTAREA =
  "w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30";

function useWhen() {
  const locale = useLocale() as Locale;
  return (iso: string) => `${formatDate(iso, locale, "short")}, ${formatTime(iso, locale)}`;
}

function Pills<T extends string>({ value, options, onChange, label, tour }: { value: T; options: { key: T; label: string }[]; onChange: (v: T) => void; label: string; tour?: string }) {
  return (
    <div className="flex flex-wrap gap-1 rounded-xl bg-muted p-1" role="tablist" aria-label={label} data-tour={tour}>
      {options.map((o) => (
        <button key={o.key} role="tab" aria-selected={value === o.key} onClick={() => onChange(o.key)} className={cn("rounded-lg px-3 py-1.5 text-sm font-medium transition", value === o.key ? "bg-background shadow" : "text-muted-foreground hover:text-foreground")}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** A reply box: sends, then calls `onDone`. */
function ReplyBox({ hint, placeholder, onSend, onCancel }: { hint: string; placeholder?: string; onSend: (text: string) => Promise<FormError | null>; onCancel: () => void }) {
  const t = useTranslations();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<FormError | null>(null);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(await onSend(text));
    setBusy(false);
  }
  return (
    <form onSubmit={submit} className="mt-3 space-y-2 rounded-xl bg-muted/50 p-3">
      <label className="text-sm font-medium" htmlFor="reply-text">
        {t("field_reply")}
      </label>
      <textarea id="reply-text" value={text} onChange={(e) => setText(e.target.value)} rows={4} maxLength={5000} required aria-describedby="reply-hint" className={TEXTAREA} placeholder={placeholder} autoFocus />
      <p id="reply-hint" className="text-xs text-muted-foreground">
        {hint}
      </p>
      <ErrorNote error={error} />
      <div className="flex gap-2">
        <SubmitButton busy={busy} disabled={text.trim().length < 2} className="h-10 w-auto px-4 text-sm">
          <Send className="size-4" aria-hidden /> {t("send_reply")}
        </SubmitButton>
        <Button type="button" variant="ghost" onClick={onCancel}>
          <X className="size-4" aria-hidden /> {t("close")}
        </Button>
      </div>
    </form>
  );
}

export function AdminInbox() {
  const t = useTranslations();
  const [tab, setTab] = useState<"contacts" | "feedback">("contacts");
  return (
    <div>
      <PageHeader title={t("nav_inbox")} sub={t("admin_feedback_sub")} />
      <div className="mb-4">
        <Pills
          value={tab}
          onChange={setTab}
          label={t("nav_inbox")}
          tour="ai-tabs"
          options={[
            { key: "contacts", label: t("tab_contact_messages") },
            { key: "feedback", label: t("tab_organizer_feedback") },
          ]}
        />
      </div>
      {tab === "contacts" ? <Contacts /> : <FeedbackList />}
    </div>
  );
}

function Contacts() {
  const t = useTranslations();
  const when = useWhen();
  const [status, setStatus] = useState<ContactStatus | "ALL">("OPEN");
  const [offset, setOffset] = useState(0);
  const [replying, setReplying] = useState<string | null>(null);
  const [{ data }, refetch] = useQuery({
    query: ContactMessagesQuery,
    variables: { status: status === "ALL" ? null : status, first: PAGE, offset },
    requestPolicy: "cache-and-network",
  });
  const [, reply] = useMutation(ReplyToContact);
  const [, resolve] = useMutation(SetContactResolved);
  const page = data?.contactMessages.__typename === "ContactPage" ? data.contactMessages : null;
  const reload = () => refetch({ requestPolicy: "network-only" });

  return (
    <div className="space-y-4">
      <Pills
        value={status}
        label={t("field_status")}
        tour="ai-status"
        onChange={(v) => {
          setStatus(v);
          setOffset(0);
        }}
        options={[
          { key: "OPEN", label: t("filter_open") },
          { key: "RESOLVED", label: t("status_resolved") },
          { key: "ALL", label: t("filter_all") },
        ]}
      />
      <div className="overflow-hidden rounded-2xl border bg-card">
        {!page ? (
          <div className="h-48 animate-pulse bg-muted" />
        ) : page.items.length === 0 ? (
          <div className="p-10 text-center">
            <CheckCircle2 className="mx-auto size-10 text-success" aria-hidden />
            <p className="mt-2 font-semibold">{t("inbox_empty_title")}</p>
            <p className="text-sm text-muted-foreground">{t("inbox_empty_body")}</p>
          </div>
        ) : (
          <ul className="divide-y">
            {page.items.map((m) => (
              <li key={m.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">
                      {m.name} <span className="font-normal text-muted-foreground">· {m.email}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t(`topic_${m.topic}`)} · {when(m.createdAt)}
                    </p>
                  </div>
                  <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", m.status === "OPEN" ? "bg-amber-400 text-black" : "bg-success/15 text-success")}>
                    {m.status === "OPEN" ? t("status_open") : t("status_resolved")}
                  </span>
                </div>
                <p className="mt-2 whitespace-pre-line text-sm">{m.message}</p>
                {replying === m.id ? (
                  <ReplyBox
                    hint={t("reply_by_email_hint", { email: m.email })}
                    onCancel={() => setReplying(null)}
                    onSend={async (text) => {
                      const result = (await reply({ id: m.id, message: text })).data?.replyToContact;
                      if (result?.__typename === "ContactMessage") {
                        toast.success(t("reply_sent"));
                        setReplying(null);
                        reload();
                        return null;
                      }
                      return result ? (result as FormError) : { code: "NETWORK" };
                    }}
                  />
                ) : (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" className="rounded-lg" data-tour="ai-reply" onClick={() => setReplying(m.id)}>
                      <MessageSquareReply className="size-4" aria-hidden /> {t("reply")}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-lg"
                      onClick={async () => {
                        const result = (await resolve({ id: m.id, resolved: m.status === "OPEN" })).data?.setContactResolved;
                        if (result?.__typename === "UserError") toast.error(errorMessage(t, result));
                        else reload();
                      }}
                    >
                      {m.status === "OPEN" ? <CheckCircle2 className="size-4" aria-hidden /> : <RotateCcw className="size-4" aria-hidden />}
                      {m.status === "OPEN" ? t("mark_resolved") : t("reopen")}
                    </Button>
                    <Button asChild size="sm" variant="ghost" className="rounded-lg">
                      <a href={`mailto:${m.email}`}>
                        <Mail className="size-4" aria-hidden /> {m.email}
                      </a>
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        {page && <Pager offset={offset} total={page.total} size={PAGE} onChange={setOffset} />}
      </div>
    </div>
  );
}

function FeedbackList() {
  const t = useTranslations();
  const when = useWhen();
  const [status, setStatus] = useState<FeedbackStatus | "ALL">("OPEN");
  const [offset, setOffset] = useState(0);
  const [replying, setReplying] = useState<string | null>(null);
  const [{ data }, refetch] = useQuery({
    query: AdminFeedbackQuery,
    variables: { status: status === "ALL" ? null : status, first: PAGE, offset },
    requestPolicy: "cache-and-network",
  });
  const [, reply] = useMutation(ReplyToFeedback);
  const [, close] = useMutation(CloseFeedback);
  const page = data?.adminFeedback.__typename === "FeedbackPage" ? data.adminFeedback : null;
  const reload = () => refetch({ requestPolicy: "network-only" });
  const label = { OPEN: t("status_open"), REPLIED: t("status_replied"), CLOSED: t("status_closed") };

  return (
    <div className="space-y-4">
      <Pills
        value={status}
        label={t("field_status")}
        tour="ai-status"
        onChange={(v) => {
          setStatus(v);
          setOffset(0);
        }}
        options={[
          { key: "OPEN", label: t("filter_open") },
          { key: "REPLIED", label: t("status_replied") },
          { key: "CLOSED", label: t("status_closed") },
          { key: "ALL", label: t("filter_all") },
        ]}
      />
      <div className="overflow-hidden rounded-2xl border bg-card">
        {!page ? (
          <div className="h-48 animate-pulse bg-muted" />
        ) : page.items.length === 0 ? (
          <div className="p-10 text-center">
            <CheckCircle2 className="mx-auto size-10 text-success" aria-hidden />
            <p className="mt-2 font-semibold">{t("inbox_empty_title")}</p>
          </div>
        ) : (
          <ul className="divide-y">
            {page.items.map((f) => (
              <li key={f.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{f.subject}</p>
                    <p className="text-xs text-muted-foreground">
                      {f.organizerName ?? "–"} · {f.organizerEmail ?? ""} · {when(f.createdAt)}
                    </p>
                  </div>
                  <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", f.status === "OPEN" ? "bg-amber-400 text-black" : "bg-muted text-muted-foreground")}>{label[f.status]}</span>
                </div>
                <p className="mt-2 whitespace-pre-line text-sm">{f.message}</p>
                {f.reply && (
                  <blockquote className="mt-3 rounded-xl border-l-4 border-primary bg-primary/8 p-3 text-sm">
                    <p className="mb-1 text-xs font-semibold text-primary">{t("admin_reply")}</p>
                    <p className="whitespace-pre-line">{f.reply}</p>
                  </blockquote>
                )}
                {replying === f.id ? (
                  <ReplyBox
                    hint={t("reply_by_email_hint", { email: f.organizerEmail ?? "" })}
                    placeholder={t("reply_placeholder")}
                    onCancel={() => setReplying(null)}
                    onSend={async (text) => {
                      const result = (await reply({ id: f.id, reply: text })).data?.replyToFeedback;
                      if (result?.__typename === "FeedbackItem") {
                        toast.success(t("reply_sent"));
                        setReplying(null);
                        reload();
                        return null;
                      }
                      return result ? (result as FormError) : { code: "NETWORK" };
                    }}
                  />
                ) : (
                  f.status !== "CLOSED" && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button size="sm" className="rounded-lg" data-tour="ai-reply" onClick={() => setReplying(f.id)}>
                        <MessageSquareReply className="size-4" aria-hidden /> {t("reply")}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-lg"
                        onClick={async () => {
                          const result = (await close({ id: f.id })).data?.closeFeedback;
                          if (result?.__typename === "UserError") toast.error(errorMessage(t, result));
                          else reload();
                        }}
                      >
                        <X className="size-4" aria-hidden /> {t("close_feedback")}
                      </Button>
                    </div>
                  )
                )}
              </li>
            ))}
          </ul>
        )}
        {page && <Pager offset={offset} total={page.total} size={PAGE} onChange={setOffset} />}
      </div>
    </div>
  );
}

export function AdminActivity() {
  const t = useTranslations();
  const when = useWhen();
  const [actorType, setActorType] = useState<"" | "organizer" | "admin">("");
  const [action, setAction] = useState("");
  const [offset, setOffset] = useState(0);
  const [{ data }] = useQuery({
    query: ActivityLogQuery,
    variables: { actorType: actorType || null, action: action || null, first: 50, offset },
    requestPolicy: "cache-and-network",
  });
  const page = data?.activityLog.__typename === "ActivityPage" ? data.activityLog : null;
  const actionLabel = (a: string) => (t.has(`act_${a}`) ? t(`act_${a}`) : a.replaceAll("_", " "));

  return (
    <div>
      <PageHeader title={t("nav_activity")} sub={t("admin_activity_sub")} />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Pills
          value={actorType}
          label={t("field_who")}
          onChange={(v) => {
            setActorType(v);
            setOffset(0);
          }}
          options={[
            { key: "", label: t("activity_all_actors") },
            { key: "organizer", label: t("activity_organizers") },
            { key: "admin", label: t("activity_admins") },
          ]}
        />
        <label className="sr-only" htmlFor="activity-action">
          {t("filter_action")}
        </label>
        <select
          id="activity-action"
          value={action}
          onChange={(e) => {
            setAction(e.target.value);
            setOffset(0);
          }}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">{t("all_actions")}</option>
          {page?.actions.map((a) => (
            <option key={a} value={a}>
              {actionLabel(a)}
            </option>
          ))}
        </select>
      </div>
      <div className="overflow-hidden rounded-2xl border bg-card">
        {!page ? (
          <div className="h-48 animate-pulse bg-muted" />
        ) : page.items.length === 0 ? (
          <p className="p-10 text-center text-muted-foreground">{t("activity_empty")}</p>
        ) : (
          <div className="relative overflow-x-auto" tabIndex={0} role="region" aria-label={t("nav_activity")}>
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-2.5">{t("field_when")}</th>
                  <th scope="col" className="px-4 py-2.5">{t("field_who")}</th>
                  <th scope="col" className="px-4 py-2.5">{t("field_action")}</th>
                  <th scope="col" className="px-4 py-2.5">{t("field_target")}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {page.items.map((e) => (
                  <tr key={e.id}>
                    <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-muted-foreground">{when(e.createdAt)}</td>
                    <td className="px-4 py-2.5">
                      <span className={cn("mr-1.5 rounded-full px-1.5 py-0.5 text-xs font-semibold", e.actorType === "admin" ? "bg-slate-700 text-white" : "bg-primary/12 text-primary")}>
                        {e.actorType === "admin" ? t("role_admin") : t("role_organizer")}
                      </span>{" "}
                      {e.actorName ?? "–"}
                    </td>
                    <td className="px-4 py-2.5 font-medium">{actionLabel(e.action)}</td>
                    <td className="max-w-64 truncate px-4 py-2.5 text-muted-foreground">{e.target ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {page && <Pager offset={offset} total={page.total} size={50} onChange={setOffset} />}
      </div>
    </div>
  );
}
