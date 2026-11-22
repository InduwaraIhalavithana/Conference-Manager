import { AlertTriangle, CalendarRange, ExternalLink, Globe, MapPin, Navigation, UserRound } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense, cache } from "react";

import { Agenda, Avatar } from "@/components/conference/agenda";
import { CategoryChip } from "@/components/conference/conference-card";
import { AddToCalendar, CopyLink, VenueMapLazy } from "@/components/conference/client-widgets";
import { RegisterPanel } from "@/components/conference/register-panel";
import { graphql } from "@/graphql/generated";
import type { Locale } from "@/i18n/routing";
import { CATEGORIES } from "@/lib/categories";
import { formatDate, formatRange, formatTime, localized } from "@/lib/format";
import { query } from "@/lib/graphql/server";
import { alternates } from "@/lib/seo";

const ConferencePageQuery = graphql(`
  query ConferencePage($slug: String!) {
    conference(slug: $slug) {
      id
      slug
      status
      title { en si ta }
      summary { en si ta }
      description { en si ta }
      category
      tags
      coverUrl
      venue { name address city location { latitude longitude } }
      onlineUrl
      timezone
      startsAt
      endsAt
      ended
      capacity
      seatsLeft
      waitlistEnabled
      counters { waitlisted }
      organizer { name organization }
      days { date label { en si ta } }
      speakers { id name jobTitle organization photoUrl bio { en si ta } links }
      sessions {
        id
        day
        kind
        title { en si ta }
        description { en si ta }
        startsAt
        endsAt
        room
        track { name { en si ta } color }
        speakers { id name photoUrl }
      }
    }
  }
`);

const load = cache((slug: string) => query(ConferencePageQuery, { slug }));

export async function generateMetadata({ params }: PageProps<"/[locale]/c/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const locale = (await getLocale()) as Locale;
  const { conference } = await load(slug);
  if (!conference) return {};
  const title = localized(conference.title, locale);
  const description = localized(conference.summary, locale) || title;
  return { title, description, alternates: alternates(locale, `/c/${slug}`), openGraph: { title, description, type: "website", siteName: "ConferenceHub" } };
}

export default function ConferencePage({ params }: PageProps<"/[locale]/c/[slug]">) {
  return (
    <Suspense fallback={<ConferenceSkeleton />}>
      <ConferenceView params={params} />
    </Suspense>
  );
}

async function ConferenceView({ params }: { params: PageProps<"/[locale]/c/[slug]">["params"] }) {
  const { slug } = await params;
  const t = await getTranslations();
  const locale = (await getLocale()) as Locale;
  const { conference: c } = await load(slug);
  if (!c) notFound();

  const title = localized(c.title, locale);
  const cancelled = c.status === "CANCELLED";
  const ended = c.ended;
  const location = c.venue.location;
  const place = [c.venue.name, c.venue.address, c.venue.city].filter(Boolean).join(", ");

  return (
    <article>
      <header className="relative overflow-hidden border-b">
        <div className={`absolute inset-0 bg-gradient-to-br ${CATEGORIES[c.category].cover}`} aria-hidden>
          {c.coverUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api${c.coverUrl}`} alt="" className="size-full object-cover" />
          )}
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/85 to-background/20" aria-hidden />
        <div className="relative mx-auto max-w-7xl px-4 pb-10 pt-28 sm:px-6 lg:pt-40">
          <div className="flex flex-wrap items-center gap-2">
            <CategoryChip category={c.category} className="bg-background/80" />
            {cancelled && <span className="rounded-full bg-destructive px-3 py-0.5 text-xs font-bold text-white">{t("badge_cancelled")}</span>}
            {c.tags.map((tag) => (
              <span key={tag} className="rounded-full bg-background/70 px-2.5 py-0.5 text-xs font-medium">
                #{tag}
              </span>
            ))}
          </div>
          <h1 className={`mt-4 max-w-4xl text-4xl font-extrabold tracking-tight sm:text-5xl ${cancelled ? "line-through decoration-destructive/70" : ""}`}>
            {title}
          </h1>
          {c.summary && <p className="mt-3 max-w-3xl text-lg text-muted-foreground">{localized(c.summary, locale)}</p>}
          <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-3 text-sm">
            <div className="flex items-center gap-2">
              <CalendarRange className="size-5 text-primary" aria-hidden />
              <dt className="sr-only">{t("field_date")}</dt>
              <dd className="font-semibold">
                {formatRange(c.startsAt, c.endsAt, locale, c.timezone)} · {formatTime(c.startsAt, locale, c.timezone)}
              </dd>
            </div>
            <div className="flex items-center gap-2">
              {c.venue.city ? <MapPin className="size-5 text-primary" aria-hidden /> : <Globe className="size-5 text-primary" aria-hidden />}
              <dt className="sr-only">{t("venue")}</dt>
              <dd className="font-semibold">{place || t("online_event")}</dd>
            </div>
            {c.organizer && (
              <div className="flex items-center gap-2">
                <UserRound className="size-5 text-primary" aria-hidden />
                <dt className="sr-only">{t("organized_by")}</dt>
                <dd className="font-semibold">
                  {c.organizer.name}
                  {c.organizer.organization && <span className="font-normal text-muted-foreground"> · {c.organizer.organization}</span>}
                </dd>
              </div>
            )}
          </dl>
        </div>
      </header>

      {cancelled && (
        <div role="status" className="border-b bg-destructive/10">
          <p className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-3 font-semibold text-destructive sm:px-6">
            <AlertTriangle className="size-5" aria-hidden /> {t("conference_cancelled_banner")}
          </p>
        </div>
      )}

      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-12">
          {c.description && (
            <section aria-labelledby="about">
              <h2 id="about" className="mb-4 text-2xl font-extrabold">
                {t("about_this_conference")}
              </h2>
              <p className="whitespace-pre-line leading-relaxed text-muted-foreground">{localized(c.description, locale)}</p>
            </section>
          )}

          <section aria-labelledby="agenda">
            <h2 id="agenda" className="mb-4 text-2xl font-extrabold">
              {t("agenda")}
            </h2>
            <Agenda data={{ timezone: c.timezone, days: c.days, sessions: c.sessions }} />
          </section>

          {c.speakers.length > 0 && (
            <section aria-labelledby="speakers">
              <h2 id="speakers" className="mb-4 text-2xl font-extrabold">
                {t("speakers")}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {c.speakers.map((s) => (
                  <div key={s.id} id={`speaker-${s.id}`} className="flex scroll-mt-24 gap-4 rounded-2xl border bg-card p-4">
                    <Avatar name={s.name} photoUrl={s.photoUrl} size="size-16" />
                    <div className="min-w-0">
                      <h3 className="font-bold">{s.name}</h3>
                      <p className="text-sm text-muted-foreground">{[s.jobTitle, s.organization].filter(Boolean).join(" · ")}</p>
                      {s.bio && <p className="mt-2 text-sm">{localized(s.bio, locale)}</p>}
                      {s.links.length > 0 && (
                        <ul className="mt-2 flex flex-wrap gap-2">
                          {s.links.map((link) => (
                            <li key={link}>
                              <a href={link} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 text-xs text-primary underline-offset-2 hover:underline">
                                <ExternalLink className="size-3" aria-hidden />
                                {new URL(link).hostname}
                              </a>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section aria-labelledby="venue">
            <h2 id="venue" className="mb-4 text-2xl font-extrabold">
              {t("venue")}
            </h2>
            <div className="overflow-hidden rounded-2xl border bg-card">
              {location ? <VenueMapLazy latitude={location.latitude} longitude={location.longitude} /> : null}
              <div className="flex flex-wrap items-center justify-between gap-3 p-4">
                <p className="flex items-center gap-2 font-semibold">
                  <MapPin className="size-5 text-primary" aria-hidden />
                  {place || (c.onlineUrl ? t("online_event") : t("venue_tba"))}
                </p>
                {location && (
                  <a
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
                    href={`https://www.openstreetmap.org/directions?to=${location.latitude},${location.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Navigation className="size-4" aria-hidden /> {t("directions")}
                  </a>
                )}
              </div>
              {!location && c.venue.city && <p className="border-t px-4 py-3 text-sm text-muted-foreground">{t("venue_no_map")}</p>}
            </div>
          </section>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="space-y-4 rounded-3xl border bg-card p-5 shadow-xl shadow-primary/5">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-primary">{t("register_to_attend")}</p>
              <p className="mt-1 text-lg font-bold">{formatDate(c.startsAt, locale, "long", c.timezone)}</p>
            </div>
            <RegisterPanel
              slug={c.slug}
              timezone={c.timezone}
              capacity={c.capacity}
              seatsLeft={c.seatsLeft}
              waitlisted={c.counters.waitlisted}
              waitlistEnabled={c.waitlistEnabled}
              closedReason={cancelled ? t("conference_cancelled_banner") : ended ? t("conference_ended") : null}
            />
            <div className="grid gap-2 border-t pt-4">
              <AddToCalendar
                slug={c.slug}
                title={title}
                details={localized(c.summary, locale)}
                location={place}
                startsAt={c.startsAt}
                endsAt={c.endsAt}
              />
              <CopyLink />
            </div>
          </div>
        </aside>
      </div>
    </article>
  );
}

function ConferenceSkeleton() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-28 sm:px-6">
      <div className="h-6 w-32 animate-pulse rounded-full bg-muted" />
      <div className="h-12 w-2/3 animate-pulse rounded-xl bg-muted" />
      <div className="h-5 w-1/2 animate-pulse rounded bg-muted" />
      <div className="grid gap-10 pt-10 lg:grid-cols-[1fr_380px]">
        <div className="h-96 animate-pulse rounded-2xl bg-muted" />
        <div className="h-96 animate-pulse rounded-3xl bg-muted" />
      </div>
    </div>
  );
}
