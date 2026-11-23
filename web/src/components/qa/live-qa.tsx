"use client";

import { ArrowLeft, CheckCircle2, MessagesSquare, Send, ThumbsUp } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { type FormEvent, useId, useState } from "react";
import { toast } from "sonner";
import { useMutation, useQuery } from "urql";

import { ErrorNote, type FormError } from "@/components/auth/fields";
import { AskQuestion, LiveDot, LiveQuestionsQuery, VoteQuestion, useQaSignals } from "@/components/qa/qa-shared";
import { HelpButton } from "@/components/tour/tour";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { errorMessage } from "@/lib/errors";
import { formatTime, localized } from "@/lib/format";
import { cn } from "@/lib/utils";

const MAX = 300;
const SELECT =
  "h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

/** /ticket/[code]/qa: a ticket holder asks questions in a session and upvotes others, live. */
export function LiveQa({ ticketCode }: { ticketCode: string }) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const selectId = useId();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [{ data, fetching }, refetch] = useQuery({ query: LiveQuestionsQuery, variables: { ticketCode, sessionId }, requestPolicy: "cache-and-network" });
  const board = data?.liveQuestions.__typename === "QaBoard" ? data.liveQuestions : null;
  const error = data?.liveQuestions.__typename === "UserError" ? data.liveQuestions : null;
  const current = board?.sessionId ?? null;
  const live = useQaSignals(board?.conferenceId, current, () => refetch({ requestPolicy: "network-only" }));

  if (error) {
    return (
      <div className="mx-auto max-w-lg rounded-3xl border bg-card p-10 text-center">
        <MessagesSquare className="mx-auto size-12 text-muted-foreground" aria-hidden />
        <h1 className="mt-4 text-2xl font-extrabold">{t("nav_live_qa")}</h1>
        <p className="mt-2 text-muted-foreground">{errorMessage(t, error)}</p>
        <Button asChild variant="outline" className="mt-6 rounded-xl">
          <Link href={`/ticket/${ticketCode}`}>{t("qa_back_to_ticket")}</Link>
        </Button>
      </div>
    );
  }
  if (!board) return fetching ? <div className="h-96 animate-pulse rounded-3xl bg-muted" /> : null;

  const session = board.sessions.find((s) => s.id === current);
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href={`/ticket/${ticketCode}`} className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
            <ArrowLeft className="size-4" aria-hidden /> {t("qa_back_to_ticket")}
          </Link>
          <h1 className="mt-2 flex items-center gap-2 text-3xl font-extrabold tracking-tight">
            <MessagesSquare className="size-7 text-primary" aria-hidden /> {t("nav_live_qa")}
          </h1>
          <p className="mt-1 text-muted-foreground">{localized(board.conferenceTitle, locale)}</p>
        </div>
        <div className="flex items-center gap-2">
          <LiveDot live={live} label={live ? t("ci_live") : t("qa_connecting")} />
          <HelpButton tour="qa" />
        </div>
      </header>

      {board.sessions.length === 0 ? (
        <p className="rounded-2xl border bg-card p-6 text-center text-muted-foreground">{t("qa_no_sessions")}</p>
      ) : (
        // Wide screens: choose and ask on the left (stays in view), the questions on the right.
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
          <div className="space-y-4 lg:sticky lg:top-24">
            <div className="space-y-1.5" data-tour="qa-session">
              <label htmlFor={selectId} className="block text-sm font-medium">
                {t("qa_session")}
              </label>
              <select id={selectId} value={current ?? ""} onChange={(e) => setSessionId(e.target.value)} className={SELECT}>
                {board.sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {formatTime(s.startsAt, locale, board.timezone)} · {localized(s.title, locale)} ({s.questions})
                  </option>
                ))}
              </select>
            </div>
            {board.open ? (
              current && <AskForm ticketCode={ticketCode} sessionId={current} onAsked={() => refetch({ requestPolicy: "network-only" })} />
            ) : (
              <p className="rounded-2xl bg-muted p-4 text-sm">{t("qa_closed_note")}</p>
            )}
          </div>
          <section aria-labelledby="qa-list-h" data-tour="qa-list">
            <h2 id="qa-list-h" className="mb-3 text-lg font-bold">
              {session ? localized(session.title, locale) : t("qa_questions")}{" "}
              <span className="ml-1 text-sm font-normal text-muted-foreground">{t("qa_count", { count: board.questions.length })}</span>
            </h2>
            {board.questions.length === 0 ? (
              <p className="rounded-2xl border bg-card p-6 text-center text-sm text-muted-foreground">{t("qa_empty")}</p>
            ) : (
              <ul className="space-y-3">
                {board.questions.map((q) => (
                  <QuestionCard key={q.id} ticketCode={ticketCode} question={q} canVote={board.open} />
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function AskForm({ ticketCode, sessionId, onAsked }: { ticketCode: string; sessionId: string; onAsked: () => void }) {
  const t = useTranslations();
  const [{ fetching }, ask] = useMutation(AskQuestion);
  const [text, setText] = useState("");
  const [error, setError] = useState<FormError | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const result = (await ask({ ticketCode, sessionId, text })).data?.askQuestion;
    if (result?.__typename === "LiveQuestion") {
      setText("");
      toast.success(t("qa_asked"));
      onAsked();
    } else setError(result ? (result as FormError) : { code: "NETWORK" });
  }

  return (
    <form onSubmit={submit} className="space-y-2 rounded-2xl border bg-card p-4" data-tour="qa-ask">
      <label htmlFor="qa-text" className="text-sm font-medium">
        {t("qa_ask_label")}
      </label>
      <textarea
        id="qa-text"
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, MAX))}
        rows={3}
        aria-describedby="qa-text-hint"
        className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p id="qa-text-hint" className="text-xs text-muted-foreground">
          {t("qa_ask_hint", { count: MAX - text.length })}
        </p>
        <Button type="submit" className="rounded-xl" disabled={fetching || text.trim().length < 3}>
          <Send className="size-4" aria-hidden /> {t("qa_ask")}
        </Button>
      </div>
      <ErrorNote error={error} />
    </form>
  );
}

type Question = { id: string; text: string; authorName: string; votes: number; status: string; votedByMe: boolean; mine: boolean };

function QuestionCard({ ticketCode, question: q, canVote }: { ticketCode: string; question: Question; canVote: boolean }) {
  const t = useTranslations();
  const [{ fetching }, vote] = useMutation(VoteQuestion);
  const answered = q.status === "ANSWERED";

  async function toggle() {
    const result = (await vote({ ticketCode, questionId: q.id, voted: !q.votedByMe })).data?.voteQuestion;
    if (result?.__typename === "UserError") toast.error(errorMessage(t, result));
  }

  return (
    <li className={cn("flex gap-3 rounded-2xl border bg-card p-4", answered && "opacity-75")}>
      <Button
        type="button"
        variant={q.votedByMe ? "default" : "outline"}
        className="h-auto min-w-14 flex-col gap-0.5 rounded-xl px-2 py-2"
        aria-pressed={q.votedByMe}
        aria-label={`${q.votedByMe ? t("qa_unvote") : t("qa_vote")}: ${q.text}`}
        disabled={!canVote || q.mine || fetching}
        onClick={() => void toggle()}
      >
        <ThumbsUp className="size-4" aria-hidden />
        <span className="text-sm font-bold tabular-nums">{q.votes}</span>
      </Button>
      <div className="min-w-0 flex-1">
        <p className="whitespace-pre-line break-words font-medium">{q.text}</p>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>{q.mine ? t("qa_you") : q.authorName}</span>
          {answered && (
            <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 font-semibold text-success">
              <CheckCircle2 className="size-3" aria-hidden /> {t("qa_answered")}
            </span>
          )}
        </p>
      </div>
    </li>
  );
}
