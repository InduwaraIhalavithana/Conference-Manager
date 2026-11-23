"use client";

import { MessageSquareHeart, Star } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useQuery } from "urql";

import { graphql } from "@/graphql/generated";
import type { Locale } from "@/i18n/routing";
import { formatDate, formatNumber, localized } from "@/lib/format";

const ConferenceFeedbackQuery = graphql(`
  query ConferenceFeedback($conferenceId: ID!) {
    conferenceFeedback(conferenceId: $conferenceId) {
      __typename
      ... on ConferenceFeedback {
        respondents
        attended
        closesAt
        scores { sessionId sessionTitle { en si ta } average count }
        comments { sessionId sessionTitle { en si ta } score comment updatedAt }
      }
      ... on UserError { code }
    }
  }
`);

function Stars({ value, label }: { value: number; label: string }) {
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={label}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={n <= Math.round(value) ? "size-4 fill-amber-400 text-amber-500" : "size-4 text-muted-foreground/40"} aria-hidden />
      ))}
    </span>
  );
}

/** Attendee ratings for one conference: overall, per session, and the comments (anonymous). */
export function FeedbackPanel({ id }: { id: string }) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const [{ data }] = useQuery({ query: ConferenceFeedbackQuery, variables: { conferenceId: id }, requestPolicy: "cache-and-network" });
  const f = data?.conferenceFeedback.__typename === "ConferenceFeedback" ? data.conferenceFeedback : null;
  if (!f) return null;

  const overall = f.scores.find((s) => !s.sessionId);
  const sessions = f.scores.filter((s) => s.sessionId).sort((a, b) => b.average - a.average);
  const avg = (v: number) => formatNumber(v, locale, { maximumFractionDigits: 1 });
  const titleOf = (title: { en: string; si?: string | null; ta?: string | null } | null | undefined) => (title ? localized(title, locale) : t("feedback_overall"));

  return (
    <section aria-labelledby="an-fb-h" className="rounded-2xl border bg-card" data-tour="an-feedback">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b px-5 py-4">
        <div>
          <h2 id="an-fb-h" className="flex items-center gap-2 font-bold">
            <MessageSquareHeart className="size-5 text-primary" aria-hidden /> {t("an_feedback")}
          </h2>
          <p className="text-xs text-muted-foreground">{t("an_feedback_sub", { date: formatDate(f.closesAt, locale, "long") })}</p>
        </div>
        <p className="text-sm text-muted-foreground tabular-nums">{t("an_feedback_count", { given: f.respondents, attended: f.attended })}</p>
      </div>
      {f.scores.length === 0 ? (
        <p className="p-6 text-center text-sm text-muted-foreground">{t("an_feedback_none")}</p>
      ) : (
        <div className="grid gap-0 lg:grid-cols-2">
          <div className="border-b p-5 lg:border-b-0 lg:border-r">
            {overall && (
              <div className="mb-4 flex items-center gap-3 rounded-xl bg-amber-400/10 p-3">
                <span className="text-3xl font-extrabold tabular-nums">{avg(overall.average)}</span>
                <div>
                  <p className="text-sm font-semibold">{t("feedback_overall")}</p>
                  <Stars value={overall.average} label={t("an_stars_label", { value: avg(overall.average), count: overall.count })} />
                </div>
              </div>
            )}
            <ul className="space-y-2">
              {sessions.map((s) => (
                <li key={s.sessionId} className="flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate font-medium">{titleOf(s.sessionTitle)}</span>
                  <span className="flex shrink-0 items-center gap-2 tabular-nums">
                    <Stars value={s.average} label={t("an_stars_label", { value: avg(s.average), count: s.count })} />
                    <span className="w-16 text-right text-muted-foreground">
                      {avg(s.average)} · {s.count}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="p-5">
            <h3 className="mb-2 text-sm font-semibold">{t("an_comments")}</h3>
            {f.comments.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("an_comments_none")}</p>
            ) : (
              <ul className="max-h-80 space-y-3 overflow-y-auto pr-1">
                {f.comments.map((c, i) => (
                  <li key={i} className="rounded-xl bg-muted/60 p-3 text-sm">
                    <div className="mb-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span className="truncate font-semibold">{titleOf(c.sessionTitle)}</span>
                      <Stars value={c.score} label={t("stars", { count: c.score })} />
                    </div>
                    <p className="whitespace-pre-line">{c.comment}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
