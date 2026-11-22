"use client";

import { CircleHelp, MessageSquare, Search, Send } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { useMutation, useQuery } from "urql";

import { MyFeedbackQuery, SendFeedback } from "@/components/admin/admin-queries";
import { ErrorNote, Field, type FormError, SubmitButton } from "@/components/auth/fields";
import { Input } from "@/components/ui/input";
import type { Locale } from "@/i18n/routing";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

const FAQ_COUNT = 8;

export function HelpPage() {
  const t = useTranslations();
  const [q, setQ] = useState("");
  const faqs = Array.from({ length: FAQ_COUNT }, (_, i) => ({ q: t(`faq_${i + 1}_q`), a: t(`faq_${i + 1}_a`) }));
  const needle = q.trim().toLowerCase();
  const shown = needle ? faqs.filter((f) => `${f.q} ${f.a}`.toLowerCase().includes(needle)) : faqs;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-3xl font-extrabold tracking-tight">
          <CircleHelp className="size-7 text-primary" aria-hidden /> {t("nav_help")}
        </h1>
        <p className="mt-1 text-muted-foreground">{t("help_sub")}</p>
      </header>
      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <section aria-labelledby="faq-h" className="rounded-2xl border bg-card p-5">
          <h2 id="faq-h" className="text-lg font-bold">
            {t("tab_faq")}
          </h2>
          <div className="relative mt-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("search_help")} aria-label={t("search")} className="h-10 pl-9" />
          </div>
          {shown.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">{t("no_results_filtered")}</p>
          ) : (
            <div className="mt-3 divide-y">
              {shown.map((f, i) => (
                <details key={f.q} open={i === 0 && !needle} className="group py-3">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold marker:hidden">
                    {f.q}
                    <span className="text-primary transition group-open:rotate-45" aria-hidden>
                      +
                    </span>
                  </summary>
                  <p className="mt-2 text-sm text-muted-foreground">{f.a}</p>
                </details>
              ))}
            </div>
          )}
        </section>
        <div className="space-y-6">
          <FeedbackForm />
          <MyMessages />
        </div>
      </div>
    </div>
  );
}

function FeedbackForm() {
  const t = useTranslations();
  const [, send] = useMutation(SendFeedback);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<FormError | null>(null);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const subject = String(new FormData(form).get("subject") ?? "");
    setBusy(true);
    setError(null);
    const result = (await send({ subject, message })).data?.sendFeedback;
    setBusy(false);
    if (result?.__typename === "FeedbackItem") {
      toast.success(t("feedback_sent"));
      form.reset();
      setMessage("");
    } else setError(result ? (result as FormError) : { code: "NETWORK" });
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-2xl border bg-card p-5" noValidate>
      <div>
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <Send className="size-5 text-primary" aria-hidden /> {t("tab_send_feedback")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("feedback_help")}</p>
      </div>
      <Field label={t("field_subject")}>{(id) => <Input id={id} name="subject" required maxLength={150} className="h-11" />}</Field>
      <Field label={t("field_message")} hint={t("chars_left", { count: 5000 - message.length })}>
        {(id, hint) => (
          <textarea
            id={id}
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, 5000))}
            rows={5}
            required
            aria-describedby={hint}
            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
          />
        )}
      </Field>
      <ErrorNote error={error} />
      <SubmitButton busy={busy} className="w-auto px-6">
        <Send className="size-4" aria-hidden /> {t("contact_send")}
      </SubmitButton>
    </form>
  );
}

function MyMessages() {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const [{ data }] = useQuery({ query: MyFeedbackQuery, requestPolicy: "cache-and-network" });
  const items = data?.myFeedback.__typename === "FeedbackList" ? data.myFeedback.items : [];
  const label = { OPEN: t("status_open"), REPLIED: t("status_replied"), CLOSED: t("status_closed") };
  return (
    <section aria-labelledby="mine-h" className="rounded-2xl border bg-card">
      <h2 id="mine-h" className="flex items-center gap-2 border-b px-5 py-3 text-lg font-bold">
        <MessageSquare className="size-5 text-primary" aria-hidden /> {t("tab_my_feedback")}
      </h2>
      {items.length === 0 ? (
        <div className="p-6 text-center">
          <p className="font-semibold">{t("feedback_empty_title")}</p>
          <p className="text-sm text-muted-foreground">{t("feedback_empty_body")}</p>
        </div>
      ) : (
        <ul className="divide-y">
          {items.map((f) => (
            <li key={f.id} className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">{f.subject}</p>
                <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", f.status === "REPLIED" ? "bg-success/15 text-success" : "bg-muted text-muted-foreground")}>{label[f.status]}</span>
              </div>
              <p className="text-xs text-muted-foreground">{formatDate(f.createdAt, locale)}</p>
              <p className="mt-1 whitespace-pre-line text-sm">{f.message}</p>
              {f.reply && (
                <blockquote className="mt-3 rounded-xl border-l-4 border-primary bg-primary/8 p-3 text-sm">
                  <p className="mb-1 text-xs font-semibold text-primary">{t("admin_reply")}</p>
                  <p className="whitespace-pre-line">{f.reply}</p>
                </blockquote>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
