"use client";

import { Bookmark, BookmarkCheck, MessageSquareHeart, Star } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { useMutation } from "urql";

import { ErrorNote, type FormError } from "@/components/auth/fields";
import { AddToCalendar } from "@/components/conference/client-widgets";
import { Button } from "@/components/ui/button";
import { graphql } from "@/graphql/generated";
import type { Locale } from "@/i18n/routing";
import { errorMessage } from "@/lib/errors";
import { formatDate, formatTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const SetBookmark = graphql(`
  mutation SetBookmark($ticketCode: String!, $sessionId: ID!, $bookmarked: Boolean!) {
    setBookmark(ticketCode: $ticketCode, sessionId: $sessionId, bookmarked: $bookmarked) {
      __typename
      ... on Ticket { bookmarkedSessionIds }
      ... on UserError { code message field }
    }
  }
`);

const RateSession = graphql(`
  mutation RateSession($ticketCode: String!, $sessionId: ID, $score: Int!, $comment: String) {
    rateSession(ticketCode: $ticketCode, sessionId: $sessionId, score: $score, comment: $comment) {
      __typename
      ... on MyRating { sessionId score comment updatedAt }
      ... on UserError { code message field }
    }
  }
`);

export type ExtraSession = { id: string; title: string; startsAt: string; endsAt: string; room: string | null; speakers: string[] };
type Rating = { sessionId: string | null; score: number; comment: string | null };

/** Calendar file for one session, made in the browser (no server round trip). */
function sessionIcs(s: ExtraSession, conferenceTitle: string, location: string): string {
  const stamp = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const escape = (v: string) => v.replace(/[\\;,]/g, (m) => `\\${m}`).replace(/\n/g, "\\n");
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//ConferenceHub//EN", "BEGIN:VEVENT",
    `UID:${s.id}@conferencehub`, `DTSTAMP:${stamp(new Date().toISOString())}`,
    `DTSTART:${stamp(s.startsAt)}`, `DTEND:${stamp(s.endsAt)}`,
    `SUMMARY:${escape(`${s.title} (${conferenceTitle})`)}`,
    `LOCATION:${escape([s.room, location].filter(Boolean).join(", "))}`,
    "END:VEVENT", "END:VCALENDAR",
  ]; // prettier-ignore
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(lines.join("\r\n"))}`;
}

export function TicketExtras({
  ticketCode,
  timezone,
  conferenceTitle,
  location,
  sessions,
  bookmarked: initialBookmarks,
  ratings: initialRatings,
  attended,
  conferenceEndsAt,
  closesAt,
  now,
}: {
  ticketCode: string;
  timezone: string;
  conferenceTitle: string;
  location: string;
  sessions: ExtraSession[];
  bookmarked: string[];
  ratings: Rating[];
  attended: boolean;
  conferenceEndsAt: string;
  closesAt: string;
  /** Server time when the page was made, so server and browser agree on what is open. */
  now: string;
}) {
  const [bookmarked, setBookmarked] = useState(initialBookmarks);
  const [ratings, setRatings] = useState(initialRatings);
  const at = new Date(now).getTime();
  const closed = at > new Date(closesAt).getTime();
  const rateable = sessions.filter((s) => new Date(s.endsAt).getTime() <= at);
  const overallOpen = new Date(conferenceEndsAt).getTime() <= at;

  return (
    <div className="mt-6 grid gap-6 print:hidden lg:grid-cols-2">
      {sessions.length > 0 && (
        <MyAgenda ticketCode={ticketCode} timezone={timezone} conferenceTitle={conferenceTitle} location={location} sessions={sessions} bookmarked={bookmarked} onChange={setBookmarked} className={attended ? undefined : "lg:col-span-2"} />
      )}
      {attended && (
        <Feedback
          ticketCode={ticketCode}
          timezone={timezone}
          sessions={rateable}
          overallOpen={overallOpen}
          closed={closed}
          closesAt={closesAt}
          ratings={ratings}
          onSaved={(r) => setRatings((all) => [...all.filter((x) => x.sessionId !== r.sessionId), r])}
          className={sessions.length === 0 ? "lg:col-span-2" : undefined}
        />
      )}
    </div>
  );
}

function MyAgenda({
  ticketCode,
  timezone,
  conferenceTitle,
  location,
  sessions,
  bookmarked,
  onChange,
  className,
}: {
  ticketCode: string;
  timezone: string;
  conferenceTitle: string;
  location: string;
  sessions: ExtraSession[];
  bookmarked: string[];
  onChange: (ids: string[]) => void;
  className?: string;
}) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const [{ fetching }, setBookmark] = useMutation(SetBookmark);
  const [onlySaved, setOnlySaved] = useState(bookmarked.length > 0);
  const saved = new Set(bookmarked);
  const shown = onlySaved ? sessions.filter((s) => saved.has(s.id)) : sessions;

  async function toggle(id: string) {
    const result = (await setBookmark({ ticketCode, sessionId: id, bookmarked: !saved.has(id) })).data?.setBookmark;
    if (result?.__typename === "Ticket") onChange(result.bookmarkedSessionIds);
    else toast.error(result ? errorMessage(t, result) : t("err_network"));
  }

  const dayOf = (iso: string) => formatDate(iso, locale, "long", timezone);
  return (
    <section aria-labelledby="agenda-h" className={cn("rounded-3xl border bg-card", className)} data-tour="tk-agenda">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
        <h2 id="agenda-h" className="flex items-center gap-2 text-lg font-bold">
          <BookmarkCheck className="size-5 text-primary" aria-hidden /> {t("my_agenda")}
        </h2>
        <div className="flex gap-1 rounded-xl bg-muted p-1" role="group" aria-label={t("my_agenda")}>
          {[
            { on: false, label: t("agenda_all") },
            { on: true, label: t("agenda_saved", { count: bookmarked.length }) },
          ].map((o) => (
            <button
              key={o.label}
              type="button"
              aria-pressed={onlySaved === o.on}
              onClick={() => setOnlySaved(o.on)}
              className={cn("rounded-lg px-3 py-1.5 text-sm font-medium transition", onlySaved === o.on ? "bg-background shadow" : "text-muted-foreground hover:text-foreground")}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>
      {shown.length === 0 ? (
        <p className="p-6 text-center text-sm text-muted-foreground">{t("agenda_saved_empty")}</p>
      ) : (
        <ul className="divide-y">
          {shown.map((s, i) => {
            const day = dayOf(s.startsAt);
            const header = i === 0 || dayOf(shown[i - 1].startsAt) !== day ? day : null;
            const isSaved = saved.has(s.id);
            return (
              <li key={s.id} className="px-5 py-3">
                {header && <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary">{header}</p>}
                <div className="flex items-start gap-3">
                  <Button
                    type="button"
                    variant={isSaved ? "default" : "outline"}
                    size="icon"
                    className="shrink-0 rounded-xl"
                    aria-pressed={isSaved}
                    aria-label={`${isSaved ? t("agenda_unsave") : t("agenda_save")}: ${s.title}`}
                    disabled={fetching}
                    onClick={() => void toggle(s.id)}
                  >
                    {isSaved ? <BookmarkCheck className="size-4" aria-hidden /> : <Bookmark className="size-4" aria-hidden />}
                  </Button>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{s.title}</p>
                    <p className="text-sm text-muted-foreground tabular-nums">
                      {formatTime(s.startsAt, locale, timezone)} – {formatTime(s.endsAt, locale, timezone)}
                      {s.room ? ` · ${s.room}` : ""}
                      {s.speakers.length ? ` · ${s.speakers.join(", ")}` : ""}
                    </p>
                    {isSaved && (
                      <div className="mt-2">
                        <AddToCalendar
                          icsHref={sessionIcs(s, conferenceTitle, location)}
                          title={`${s.title} (${conferenceTitle})`}
                          details={conferenceTitle}
                          location={[s.room, location].filter(Boolean).join(", ")}
                          startsAt={s.startsAt}
                          endsAt={s.endsAt}
                          label={`${t("add_to_calendar")}: ${s.title}`}
                          className="h-8 rounded-lg px-3 text-xs"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function Feedback({
  ticketCode,
  timezone,
  sessions,
  overallOpen,
  closed,
  closesAt,
  ratings,
  onSaved,
  className,
}: {
  ticketCode: string;
  timezone: string;
  sessions: ExtraSession[];
  overallOpen: boolean;
  closed: boolean;
  closesAt: string;
  ratings: Rating[];
  onSaved: (r: Rating) => void;
  className?: string;
}) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const items: { id: string | null; title: string }[] = [
    ...(overallOpen ? [{ id: null, title: t("feedback_overall") }] : []),
    ...sessions.map((s) => ({ id: s.id, title: s.title })),
  ];

  return (
    <section aria-labelledby="fb-h" className={cn("rounded-3xl border bg-card", className)} data-tour="tk-feedback">
      <div className="border-b px-5 py-4">
        <h2 id="fb-h" className="flex items-center gap-2 text-lg font-bold">
          <MessageSquareHeart className="size-5 text-primary" aria-hidden /> {t("feedback_title")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {closed ? t("feedback_closed_note") : t("feedback_note", { date: formatDate(closesAt, locale, "long", timezone) })}
        </p>
      </div>
      {closed ? null : items.length === 0 ? (
        <p className="p-6 text-center text-sm text-muted-foreground">{t("feedback_not_yet_note")}</p>
      ) : (
        <ul className="divide-y">
          {items.map((item) => (
            <li key={item.id ?? "overall"} className="px-5 py-4">
              <RatingForm ticketCode={ticketCode} sessionId={item.id} title={item.title} existing={ratings.find((r) => r.sessionId === item.id)} onSaved={onSaved} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function RatingForm({
  ticketCode,
  sessionId,
  title,
  existing,
  onSaved,
}: {
  ticketCode: string;
  sessionId: string | null;
  title: string;
  existing: Rating | undefined;
  onSaved: (r: Rating) => void;
}) {
  const t = useTranslations();
  const [{ fetching }, rate] = useMutation(RateSession);
  const [score, setScore] = useState(existing?.score ?? 0);
  const [comment, setComment] = useState(existing?.comment ?? "");
  const [error, setError] = useState<FormError | null>(null);
  const name = `score-${sessionId ?? "overall"}`;
  const changed = score !== (existing?.score ?? 0) || comment.trim() !== (existing?.comment ?? "");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const result = (await rate({ ticketCode, sessionId, score, comment: comment.trim() || null })).data?.rateSession;
    if (result?.__typename === "MyRating") {
      onSaved({ sessionId: result.sessionId ?? null, score: result.score, comment: result.comment ?? null });
      toast.success(t("feedback_saved"));
    } else setError(result ? (result as FormError) : { code: "NETWORK" });
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <fieldset>
        <legend className="font-semibold">
          {title}
          {existing && <span className="ml-2 rounded-full bg-success/15 px-2 py-0.5 text-xs font-semibold text-success">{t("feedback_given")}</span>}
        </legend>
        <div className="mt-1 flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="cursor-pointer rounded-md p-0.5 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring">
              <input type="radio" name={name} value={n} checked={score === n} onChange={() => setScore(n)} className="sr-only" />
              <Star className={cn("size-7 transition", n <= score ? "fill-amber-400 text-amber-500" : "text-muted-foreground/50 hover:text-amber-500")} aria-hidden />
              <span className="sr-only">{t("stars", { count: n })}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <label className="sr-only" htmlFor={`${name}-c`}>
        {t("feedback_comment")}
      </label>
      <textarea
        id={`${name}-c`}
        value={comment}
        onChange={(e) => setComment(e.target.value.slice(0, 1000))}
        rows={2}
        placeholder={t("feedback_comment")}
        className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30"
      />
      <ErrorNote error={error} />
      <Button type="submit" size="sm" className="rounded-lg" disabled={score === 0 || fetching || !changed}>
        {existing ? t("feedback_update") : t("feedback_send")}
      </Button>
    </form>
  );
}
