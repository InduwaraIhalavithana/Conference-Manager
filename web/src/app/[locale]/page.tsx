import {
  ArrowRight,
  BarChart3,
  CalendarPlus,
  CalendarRange,
  Languages,
  ListChecks,
  MapPin,
  Mic,
  QrCode,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense, cache } from "react";

import { ConferenceCard, ConferenceCardSkeleton } from "@/components/conference/conference-card";
import { Countdown } from "@/components/conference/countdown";
import { Section, SectionHeading } from "@/components/site/section";
import { Button } from "@/components/ui/button";
import { graphql } from "@/graphql/generated";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { CATEGORIES, CATEGORY_ORDER } from "@/lib/categories";
import { formatDate, formatNumber, localized } from "@/lib/format";
import { query } from "@/lib/graphql/server";
import { alternates } from "@/lib/seo";

const HomeData = graphql(`
  query HomeData {
    platformStats {
      upcomingConferences
      heldConferences
      registeredAttendees
      checkedIn
      speakers
      organizers
      registrationsThisWeek
    }
    upcomingCategories { category count }
    upcomingCities(first: 10) { city count }
    conferences(first: 7) {
      edges { node { ...ConferenceCardFields } }
    }
  }
`);

// One request for the whole page, shared by every section below (React's per-request memoization).
const homeData = cache(() => query(HomeData));

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) as Locale;
  return { alternates: alternates(locale, "/") };
}

export default async function HomePage() {
  const t = await getTranslations();
  const locale = await getLocale();
  return (
    <>
      <section className="relative overflow-hidden border-b bg-hero">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.15fr_1fr] lg:py-20">
          <div className="animate-lift space-y-6">
            <Suspense fallback={<span className="inline-block h-7 w-56 animate-pulse rounded-full bg-muted" />}>
              <LiveBadge />
            </Suspense>
            <h1 className="text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
              {t("home_title_1")}{" "}
              <span className="bg-gradient-to-r from-brand to-brand-2 bg-clip-text text-transparent">{t("home_title_2")}</span>
            </h1>
            <p className="max-w-xl text-lg text-muted-foreground">{t("home_subtitle")}</p>
            <form action={`/${locale}/conferences`} method="get" role="search" className="flex max-w-xl gap-2 rounded-2xl border bg-card p-2 shadow-lg">
              <label htmlFor="home-search" className="sr-only">
                {t("search")}
              </label>
              <div className="flex flex-1 items-center gap-2 px-2">
                <Search className="size-5 text-muted-foreground" aria-hidden />
                <input
                  id="home-search"
                  name="q"
                  type="search"
                  placeholder={t("search_placeholder")}
                  className="h-11 w-full bg-transparent text-base outline-none placeholder:text-muted-foreground"
                />
              </div>
              <Button type="submit" size="lg" className="h-11 rounded-xl px-5">
                {t("search")}
              </Button>
            </form>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg" className="rounded-xl">
                <Link href="/conferences">
                  {t("browse_conferences")} <ArrowRight className="size-4" aria-hidden />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-xl">
                <Link href="/about">{t("start_organizing")}</Link>
              </Button>
            </div>
          </div>
          <Suspense fallback={<div className="h-80 animate-pulse rounded-3xl border bg-card" />}>
            <NextUp />
          </Suspense>
        </div>
      </section>

      <Section className="py-10">
        <Suspense fallback={<StatsSkeleton />}>
          <Stats />
        </Suspense>
      </Section>

      <Section>
        <SectionHeading
          eyebrow={t("home_upcoming_eyebrow")}
          title={t("home_upcoming_title")}
          action={
            <Button asChild variant="ghost">
              <Link href="/conferences">
                {t("browse_conferences")} <ArrowRight className="size-4" aria-hidden />
              </Link>
            </Button>
          }
        />
        <Suspense
          fallback={
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }, (_, i) => (
                <ConferenceCardSkeleton key={i} />
              ))}
            </div>
          }
        >
          <Upcoming />
        </Suspense>
      </Section>

      <Section band>
        <div className="grid gap-12 lg:grid-cols-2">
          <div>
            <SectionHeading eyebrow={t("home_topics_eyebrow")} title={t("home_topics_title")} />
            <Suspense fallback={<div className="h-40 animate-pulse rounded-2xl bg-muted" />}>
              <Topics />
            </Suspense>
          </div>
          <div>
            <SectionHeading eyebrow={t("home_cities_eyebrow")} title={t("home_cities_title")} />
            <Suspense fallback={<div className="h-40 animate-pulse rounded-2xl bg-muted" />}>
              <Cities />
            </Suspense>
          </div>
        </div>
      </Section>

      <Features />
      <Steps />
    </>
  );
}

async function LiveBadge() {
  const t = await getTranslations();
  const locale = (await getLocale()) as Locale;
  const { platformStats } = await homeData();
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-success/40 bg-success/10 px-3 py-1 text-sm font-semibold text-success">
      <span className="size-2 animate-pulse-dot rounded-full bg-success" aria-hidden />
      {t("home_live_week", { count: formatNumber(platformStats.registrationsThisWeek, locale) })}
    </span>
  );
}

async function NextUp() {
  const t = await getTranslations();
  const locale = (await getLocale()) as Locale;
  const { conferences } = await homeData();
  const next = conferences.edges[0]?.node;
  if (!next) {
    return (
      <div className="flex min-h-72 flex-col items-center justify-center gap-4 rounded-3xl border bg-card p-8 text-center shadow-xl">
        <CalendarPlus className="size-10 text-primary" aria-hidden />
        <p className="font-semibold">{t("home_no_upcoming")}</p>
      </div>
    );
  }
  const style = CATEGORIES[next.category];
  return (
    <Link
      href={`/c/${next.slug}`}
      className="group block animate-lift overflow-hidden rounded-3xl border bg-card shadow-2xl shadow-primary/10 transition hover:border-primary/50"
    >
      <div className={`relative h-36 bg-gradient-to-br ${style.cover}`}>
        {next.coverUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`/api${next.coverUrl}`} alt="" className="size-full object-cover" />
        )}
        <span className="absolute left-4 top-4 rounded-full bg-background/90 px-3 py-1 text-xs font-bold uppercase tracking-wide text-primary">
          {t("home_next_up")}
        </span>
      </div>
      <div className="space-y-4 p-6">
        <div>
          <h2 className="text-2xl font-extrabold leading-tight group-hover:text-primary">{localized(next.title, locale)}</h2>
          <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            <CalendarRange className="size-4 text-primary" aria-hidden />
            {formatDate(next.startsAt, locale, "long", next.timezone)}
            {next.city && (
              <>
                <MapPin className="ml-2 size-4 text-primary" aria-hidden /> {next.city}
              </>
            )}
          </p>
        </div>
        <Countdown startsAt={next.startsAt} />
      </div>
    </Link>
  );
}

const STAT_TILES = [
  { key: "upcomingConferences", label: "stat_upcoming", icon: CalendarRange, tone: "text-sky-500" },
  { key: "heldConferences", label: "stat_held", icon: CalendarPlus, tone: "text-indigo-500" },
  { key: "registeredAttendees", label: "stat_attendees", icon: Users, tone: "text-emerald-500" },
  { key: "checkedIn", label: "stat_checked_in", icon: QrCode, tone: "text-teal-500" },
  { key: "speakers", label: "stat_speakers", icon: Mic, tone: "text-pink-500" },
  { key: "organizers", label: "stat_organizers", icon: Sparkles, tone: "text-amber-500" },
] as const;

async function Stats() {
  const t = await getTranslations();
  const locale = (await getLocale()) as Locale;
  const { platformStats } = await homeData();
  return (
    <dl className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
      {STAT_TILES.map(({ key, label, icon: Icon, tone }, i) => (
        <div
          key={key}
          className="animate-rise rounded-2xl border bg-card p-5 shadow-sm"
          style={{ animationDelay: `${i * 60}ms` }}
        >
          <Icon className={`size-6 ${tone}`} aria-hidden />
          <dd className="mt-3 text-3xl font-extrabold tabular-nums">{formatNumber(platformStats[key], locale)}</dd>
          <dt className="text-sm text-muted-foreground">{t(label)}</dt>
        </div>
      ))}
    </dl>
  );
}

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
      {STAT_TILES.map((s) => (
        <div key={s.key} className="h-32 animate-pulse rounded-2xl border bg-card" />
      ))}
    </div>
  );
}

async function Upcoming() {
  const t = await getTranslations();
  const { conferences } = await homeData();
  const list = conferences.edges.slice(1).map((e) => e.node);
  if (list.length === 0) {
    return <p className="rounded-2xl border border-dashed p-10 text-center text-muted-foreground">{t("home_no_upcoming")}</p>;
  }
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {list.map((c, i) => (
        <ConferenceCard key={c.id} conference={c} index={i} />
      ))}
    </div>
  );
}

async function Topics() {
  const t = await getTranslations();
  const locale = (await getLocale()) as Locale;
  const { upcomingCategories } = await homeData();
  const counts = new Map(upcomingCategories.map((c) => [c.category, c.count]));
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {CATEGORY_ORDER.map((category) => {
        const style = CATEGORIES[category];
        const Icon = style.icon;
        return (
          <Link
            key={category}
            href={{ pathname: "/conferences", query: { category: style.slug } }}
            className={`group flex flex-col gap-2 rounded-2xl border p-4 transition hover:-translate-y-0.5 hover:shadow-lg ${style.chip}`}
          >
            <Icon className="size-6" aria-hidden />
            <span className="font-semibold text-foreground">{t(style.label)}</span>
            <span className="text-sm text-muted-foreground">{formatNumber(counts.get(category) ?? 0, locale)}</span>
          </Link>
        );
      })}
    </div>
  );
}

async function Cities() {
  const t = await getTranslations();
  const locale = (await getLocale()) as Locale;
  const { upcomingCities } = await homeData();
  if (upcomingCities.length === 0) {
    return <p className="rounded-2xl border border-dashed p-8 text-center text-muted-foreground">{t("home_no_cities")}</p>;
  }
  const max = Math.max(...upcomingCities.map((c) => c.count));
  return (
    <ul className="space-y-2.5">
      {upcomingCities.map((c) => (
        <li key={c.city}>
          <Link
            href={{ pathname: "/conferences", query: { city: c.city } }}
            className="group flex items-center gap-3 rounded-xl border bg-card px-4 py-3 transition hover:border-primary/50"
          >
            <MapPin className="size-4 text-primary" aria-hidden />
            <span className="w-32 font-semibold group-hover:text-primary">{c.city}</span>
            <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
              <span
                className="block h-full rounded-full bg-gradient-to-r from-brand to-brand-2"
                style={{ width: `${Math.max(8, (c.count / max) * 100)}%` }}
              />
            </span>
            <span className="w-8 text-right text-sm tabular-nums text-muted-foreground">{formatNumber(c.count, locale)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

const FEATURES = [
  { title: "feat_tickets", body: "feat_tickets_body", icon: QrCode, tone: "bg-sky-500/15 text-sky-500" },
  { title: "feat_waitlist", body: "feat_waitlist_body", icon: ListChecks, tone: "bg-amber-500/15 text-amber-500" },
  { title: "feat_agenda", body: "feat_agenda_body", icon: Mic, tone: "bg-pink-500/15 text-pink-500" },
  { title: "feat_reminders", body: "feat_reminders_body", icon: CalendarPlus, tone: "bg-indigo-500/15 text-indigo-500" },
  { title: "feat_maps", body: "feat_maps_body", icon: MapPin, tone: "bg-emerald-500/15 text-emerald-500" },
  { title: "feat_analytics", body: "feat_analytics_body", icon: BarChart3, tone: "bg-violet-500/15 text-violet-500" },
  { title: "feat_languages", body: "feat_languages_body", icon: Languages, tone: "bg-teal-500/15 text-teal-500" },
  { title: "feat_secure", body: "feat_secure_body", icon: ShieldCheck, tone: "bg-rose-500/15 text-rose-500" },
] as const;

async function Features() {
  const t = await getTranslations();
  return (
    <Section>
      <SectionHeading eyebrow={t("home_features_eyebrow")} title={t("home_features_title")} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map(({ title, body, icon: Icon, tone }) => (
          <div key={title} className="rounded-2xl border bg-card p-5 transition hover:-translate-y-0.5 hover:shadow-lg">
            <span className={`inline-flex size-11 items-center justify-center rounded-xl ${tone}`}>
              <Icon className="size-5" aria-hidden />
            </span>
            <h3 className="mt-4 font-bold">{t(title)}</h3>
            <p className="mt-1.5 text-sm text-muted-foreground">{t(body)}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

async function Steps() {
  const t = await getTranslations();
  return (
    <Section band>
      <SectionHeading eyebrow={t("home_steps_eyebrow")} title={t("home_steps_title")} />
      <ol className="grid gap-4 md:grid-cols-4">
        {([1, 2, 3, 4] as const).map((n) => (
          <li key={n} className="relative rounded-2xl border bg-card p-5">
            <span className="inline-flex size-10 items-center justify-center rounded-full bg-gradient-to-br from-brand to-brand-2 text-lg font-extrabold text-white">
              {n}
            </span>
            <h3 className="mt-4 font-bold">{t(`step_${n}_title`)}</h3>
            <p className="mt-1.5 text-sm text-muted-foreground">{t(`step_${n}_body`)}</p>
          </li>
        ))}
      </ol>
    </Section>
  );
}
