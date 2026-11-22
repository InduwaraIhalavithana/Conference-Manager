// The browse page's filters live in the URL (?q=&category=&city=&when=&from=&to=&view=&lat=&lng=), so a
// filtered list can be bookmarked and shared, and the server renders it directly.
import type { ConferenceFilter, Timeframe } from "@/graphql/generated/graphql";
import { categoryFromSlug } from "@/lib/categories";

export type BrowseParams = {
  q: string;
  category: string;
  city: string;
  when: "upcoming" | "past" | "all";
  from: string;
  to: string;
  view: "list" | "map";
  lat: string;
  lng: string;
};

type Raw = Record<string, string | string[] | undefined>;

function one(raw: Raw, key: string): string {
  const value = raw[key];
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

export function parseBrowseParams(raw: Raw): BrowseParams {
  const when = one(raw, "when");
  return {
    q: one(raw, "q").slice(0, 100),
    category: categoryFromSlug(one(raw, "category")) ? one(raw, "category") : "",
    city: one(raw, "city").slice(0, 80),
    when: when === "past" || when === "all" ? when : "upcoming",
    from: /^\d{4}-\d{2}-\d{2}$/.test(one(raw, "from")) ? one(raw, "from") : "",
    to: /^\d{4}-\d{2}-\d{2}$/.test(one(raw, "to")) ? one(raw, "to") : "",
    view: one(raw, "view") === "map" ? "map" : "list",
    lat: /^-?\d+(\.\d+)?$/.test(one(raw, "lat")) ? one(raw, "lat") : "",
    lng: /^-?\d+(\.\d+)?$/.test(one(raw, "lng")) ? one(raw, "lng") : "",
  };
}

const TIMEFRAME: Record<BrowseParams["when"], Timeframe> = { upcoming: "UPCOMING", past: "PAST", all: "ALL" };

/** Dates are whole days in Sri Lanka time. */
export function toFilter(p: BrowseParams): ConferenceFilter {
  return {
    q: p.q || undefined,
    category: categoryFromSlug(p.category),
    city: p.city || undefined,
    timeframe: TIMEFRAME[p.when],
    startsFrom: p.from ? `${p.from}T00:00:00+05:30` : undefined,
    startsTo: p.to ? `${p.to}T23:59:59+05:30` : undefined,
    near: p.lat && p.lng ? { latitude: Number(p.lat), longitude: Number(p.lng), radiusKm: 100 } : undefined,
  };
}

export function hasFilters(p: BrowseParams): boolean {
  return Boolean(p.q || p.category || p.city || p.from || p.to || p.lat || p.when !== "upcoming");
}
