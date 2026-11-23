import { CalendarDays, MapPin, Navigation, Users, Wifi } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { graphql } from "@/graphql/generated";
import type { ConferenceCardFieldsFragment } from "@/graphql/generated/graphql";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { CATEGORIES } from "@/lib/categories";
import { dateBadge, formatNumber, formatRange, localized } from "@/lib/format";
import { cn } from "@/lib/utils";

export const ConferenceCardFields = graphql(`
  fragment ConferenceCardFields on Conference {
    id
    slug
    status
    title { en si ta }
    summary { en si ta }
    category
    coverUrl
    city
    onlineUrl
    timezone
    startsAt
    endsAt
    live
    capacity
    seatsLeft
    distanceKm
    venue { name }
  }
`);

export function CategoryChip({ category, className }: { category: ConferenceCardFieldsFragment["category"]; className?: string }) {
  const t = useTranslations();
  const style = CATEGORIES[category];
  const Icon = style.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold", style.chip, className)}>
      <Icon className="size-3.5" aria-hidden />
      {t(style.label)}
    </span>
  );
}

/** A pulsing "happening now" pill. */
export function LiveBadge({ className }: { className?: string }) {
  const t = useTranslations();
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full bg-red-700 px-2.5 py-1 text-xs font-bold text-white shadow-lg shadow-red-700/30", className)}>
      <span className="relative flex size-2" aria-hidden>
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-white opacity-75" />
        <span className="relative inline-flex size-2 rounded-full bg-white" />
      </span>
      {t("badge_live")}
    </span>
  );
}

export function SeatsBadge({ capacity, seatsLeft }: { capacity: number | null; seatsLeft: number | null }) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  if (capacity === null || seatsLeft === null) return null;
  const share = capacity ? 1 - seatsLeft / capacity : 0;
  if (seatsLeft === 0) {
    return <span className="rounded-full bg-warning/15 px-2.5 py-0.5 text-xs font-semibold text-warning">{t("seats_full")}</span>;
  }
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold",
        share > 0.8 ? "bg-warning/15 text-warning" : "bg-success/15 text-success",
      )}
    >
      <Users className="size-3.5" aria-hidden />
      {t("seats_left", { count: formatNumber(seatsLeft, locale) })}
    </span>
  );
}

export function ConferenceCard({
  conference,
  index = 0,
  headingLevel = 3,
}: {
  conference: ConferenceCardFieldsFragment;
  index?: number;
  /** h3 under a section heading (home); h2 straight under the page's h1 (browse). */
  headingLevel?: 2 | 3;
}) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const c = conference;
  const badge = dateBadge(c.startsAt, locale, c.timezone);
  const cancelled = c.status === "CANCELLED";
  const title = localized(c.title, locale);

  return (
    <Link
      href={`/c/${c.slug}`}
      className="card-sheen group flex animate-rise flex-col overflow-hidden rounded-2xl border bg-card shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:border-primary/50 hover:shadow-xl hover:shadow-primary/10 focus-visible:ring-2 focus-visible:ring-ring"
      style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}
    >
      <div className={cn("relative aspect-[16/8] overflow-hidden bg-gradient-to-br", CATEGORIES[c.category].cover)}>
        {c.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api${c.coverUrl}`}
            alt=""
            loading="lazy"
            className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="absolute inset-0 opacity-30 [background:radial-gradient(circle_at_20%_20%,white,transparent_45%)]" />
        )}
        <div className="absolute left-3 top-3 flex flex-col items-center rounded-xl bg-background/90 px-2.5 py-1.5 text-center shadow backdrop-blur">
          <span className="text-[0.65rem] font-bold uppercase tracking-wide text-primary">{badge.month}</span>
          <span className="text-xl font-extrabold leading-none">{badge.day}</span>
        </div>
        {c.live && <LiveBadge className="absolute right-3 top-3" />}
        {cancelled && (
          <span className="absolute right-3 top-3 rounded-full bg-destructive px-2.5 py-1 text-xs font-bold text-white">
            {t("badge_cancelled")}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <CategoryChip category={c.category} />
          {!cancelled && <SeatsBadge capacity={c.capacity} seatsLeft={c.seatsLeft} />}
        </div>
        <Heading className={cn("text-lg font-bold leading-snug group-hover:text-primary", cancelled && "line-through opacity-70")}>{title}</Heading>
        {c.summary && <p className="line-clamp-2 text-sm text-muted-foreground">{localized(c.summary, locale)}</p>}
        <div className="mt-auto space-y-1.5 text-sm text-muted-foreground">
          <p className="flex items-center gap-2">
            <CalendarDays className="size-4 shrink-0 text-primary" aria-hidden />
            {formatRange(c.startsAt, c.endsAt, locale, c.timezone)}
          </p>
          <p className="flex items-center gap-2">
            {c.city ? <MapPin className="size-4 shrink-0 text-primary" aria-hidden /> : <Wifi className="size-4 shrink-0 text-primary" aria-hidden />}
            <span className="truncate">{c.city ? [c.venue.name, c.city].filter(Boolean).join(", ") : t("online_event")}</span>
          </p>
          {c.distanceKm !== null && (
            <p className="flex items-center gap-2 font-medium text-foreground">
              <Navigation className="size-4 shrink-0 text-primary" aria-hidden />
              {t("distance_km", { km: formatNumber(c.distanceKm, locale) })}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}

export function ConferenceCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border bg-card">
      <div className="aspect-[16/8] animate-pulse bg-muted" />
      <div className="space-y-3 p-4">
        <div className="h-5 w-24 animate-pulse rounded-full bg-muted" />
        <div className="h-6 w-4/5 animate-pulse rounded bg-muted" />
        <div className="h-4 w-3/5 animate-pulse rounded bg-muted" />
      </div>
    </div>
  );
}
