"use client";

import { ArrowLeft, CheckCircle2, Eye, EyeOff, MessagesSquare, RotateCcw, ThumbsUp } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useId, useState } from "react";
import { toast } from "sonner";
import { useMutation, useQuery } from "urql";

import { MyConferenceQuery } from "@/components/organizer/conference-queries";
import { LiveDot, SessionQuestionsQuery, SetQuestionStatus, useQaSignals } from "@/components/qa/qa-shared";
import { Button } from "@/components/ui/button";
import type { QuestionStatus } from "@/graphql/generated/graphql";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { errorMessage } from "@/lib/errors";
import { formatTime, localized } from "@/lib/format";
import { cn } from "@/lib/utils";

const SELECT =
  "h-11 w-full max-w-xl rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

/** /dashboard/conferences/[id]/qa: the organizer watches a session's questions live, answers and hides them. */
export function QaModeration({ id }: { id: string }) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const selectId = useId();
  const [{ data: confData }] = useQuery({ query: MyConferenceQuery, variables: { id } });
  const conf = confData?.myConference.__typename === "Conference" ? confData.myConference : null;
  const sessions = conf ? [...conf.sessions].sort((a, b) => a.startsAt.localeCompare(b.startsAt)) : [];
  const now = new Date().toISOString();
  const fallback = sessions.find((s) => s.endsAt >= now)?.id ?? sessions.at(-1)?.id ?? null;
  const [picked, setPicked] = useState<string | null>(null);
  const sessionId = picked ?? fallback;

  const [{ data }, refetch] = useQuery({
    query: SessionQuestionsQuery,
    variables: { conferenceId: id, sessionId: sessionId ?? "" },
    pause: !sessionId,
    requestPolicy: "cache-and-network",
  });
  const page = data?.sessionQuestions.__typename === "SessionQuestions" ? data.sessionQuestions : null;
  const live = useQaSignals(conf?.status === "PUBLISHED" ? id : null, sessionId, () => refetch({ requestPolicy: "network-only" }));
  const counts = new Map(page?.sessions.map((s) => [s.id, s.questions]) ?? []);
  const open = page?.questions.filter((q) => q.status === "OPEN") ?? [];
  const done = page?.questions.filter((q) => q.status !== "OPEN") ?? [];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href={`/dashboard/conferences/${id}/attendees`} className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
            <ArrowLeft className="size-4" aria-hidden /> {t("attendees")}
          </Link>
          <h1 className="mt-2 flex items-center gap-2 text-3xl font-extrabold tracking-tight">
            <MessagesSquare className="size-7 text-primary" aria-hidden /> {t("nav_live_qa")}
          </h1>
          {conf && <p className="mt-1 text-muted-foreground">{localized(conf.title, locale)}</p>}
        </div>
        {conf?.status === "PUBLISHED" && <LiveDot live={live} label={live ? t("ci_live") : t("qa_connecting")} />}
      </header>

      {conf && sessions.length === 0 ? (
        <p className="rounded-2xl border bg-card p-6 text-center text-muted-foreground">{t("qa_no_sessions_organizer")}</p>
      ) : (
        <>
          <div className="space-y-1.5" data-tour="qm-session">
            <label htmlFor={selectId} className="block text-sm font-medium">
              {t("qa_session")}
            </label>
            <select id={selectId} value={sessionId ?? ""} onChange={(e) => setPicked(e.target.value)} className={SELECT}>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {formatTime(s.startsAt, locale, conf?.timezone)} · {localized(s.title, locale)} ({counts.get(s.id) ?? 0})
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">{t("qa_moderation_hint")}</p>
          </div>
          <section aria-labelledby="qm-open-h" data-tour="qm-list">
            <h2 id="qm-open-h" className="mb-3 text-lg font-bold">
              {t("qa_waiting")}{" "}<span className="text-sm font-normal text-muted-foreground">({open.length})</span>
            </h2>
            {open.length === 0 ? (
              <p className="rounded-2xl border bg-card p-6 text-center text-sm text-muted-foreground">{t("qa_empty_organizer")}</p>
            ) : (
              <ul className="space-y-3">
                {open.map((q) => (
                  <ModeratedCard key={q.id} question={q} />
                ))}
              </ul>
            )}
          </section>
          {done.length > 0 && (
            <section aria-labelledby="qm-done-h">
              <h2 id="qm-done-h" className="mb-3 text-lg font-bold">
                {t("qa_done")}{" "}<span className="text-sm font-normal text-muted-foreground">({done.length})</span>
              </h2>
              <ul className="space-y-3">
                {done.map((q) => (
                  <ModeratedCard key={q.id} question={q} />
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}

type Moderated = { id: string; text: string; authorName: string; votes: number; status: QuestionStatus };

function ModeratedCard({ question: q }: { question: Moderated }) {
  const t = useTranslations();
  const [{ fetching }, setStatus] = useMutation(SetQuestionStatus);

  async function change(status: QuestionStatus) {
    const result = (await setStatus({ questionId: q.id, status })).data?.setQuestionStatus;
    if (result?.__typename === "UserError") toast.error(errorMessage(t, result));
  }

  return (
    <li className={cn("flex flex-wrap items-start gap-3 rounded-2xl border bg-card p-4", q.status === "HIDDEN" && "border-dashed opacity-70")}>
      <span className="inline-flex min-w-12 flex-col items-center rounded-xl bg-muted px-2 py-1.5 text-sm font-bold tabular-nums" aria-label={t("qa_votes", { count: q.votes })}>
        <ThumbsUp className="size-4 text-primary" aria-hidden />
        {q.votes}
      </span>
      <div className="min-w-0 flex-1">
        <p className="whitespace-pre-line break-words font-medium">{q.text}</p>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {q.authorName}
          {q.status === "ANSWERED" && <span className="rounded-full bg-success/15 px-2 py-0.5 font-semibold text-success">{t("qa_answered")}</span>}
          {q.status === "HIDDEN" && <span className="rounded-full bg-muted px-2 py-0.5 font-semibold">{t("qa_hidden")}</span>}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {q.status === "OPEN" ? (
          <>
            <Button size="sm" className="rounded-lg" disabled={fetching} onClick={() => void change("ANSWERED")} aria-label={`${t("qa_mark_answered")}: ${q.text}`}>
              <CheckCircle2 className="size-4" aria-hidden /> {t("qa_mark_answered")}
            </Button>
            <Button size="sm" variant="outline" className="rounded-lg" disabled={fetching} onClick={() => void change("HIDDEN")} aria-label={`${t("qa_hide")}: ${q.text}`}>
              <EyeOff className="size-4" aria-hidden /> {t("qa_hide")}
            </Button>
          </>
        ) : (
          <Button size="sm" variant="outline" className="rounded-lg" disabled={fetching} onClick={() => void change("OPEN")} aria-label={`${q.status === "HIDDEN" ? t("qa_show") : t("qa_reopen")}: ${q.text}`}>
            {q.status === "HIDDEN" ? <Eye className="size-4" aria-hidden /> : <RotateCcw className="size-4" aria-hidden />}
            {q.status === "HIDDEN" ? t("qa_show") : t("qa_reopen")}
          </Button>
        )}
      </div>
    </li>
  );
}
