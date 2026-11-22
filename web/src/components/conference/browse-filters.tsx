"use client";

import { List, LocateFixed, Map as MapIcon, Search, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePathname, useRouter } from "@/i18n/navigation";
import { CATEGORIES, CATEGORY_ORDER } from "@/lib/categories";
import { cn } from "@/lib/utils";

export function BrowseFilters({ cities }: { cities: string[] }) {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [q, setQ] = useState(params.get("q") ?? "");

  function update(changes: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    startTransition(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  }

  // Search as you type, after a short pause.
  useEffect(() => {
    if (q === (params.get("q") ?? "")) return;
    const id = window.setTimeout(() => update({ q: q.trim() || null }), 350);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  function nearMe() {
    if (!navigator.geolocation) return toast.error(t("near_me_denied"));
    navigator.geolocation.getCurrentPosition(
      (pos) => update({ lat: pos.coords.latitude.toFixed(4), lng: pos.coords.longitude.toFixed(4) }),
      () => toast.error(t("near_me_denied")),
      { timeout: 10_000 },
    );
  }

  const when = params.get("when") ?? "upcoming";
  const category = params.get("category") ?? "";
  const view = params.get("view") ?? "list";
  const near = params.get("lat") && params.get("lng");
  const filtered = [...params.keys()].some((k) => k !== "view");

  return (
    <div className={cn("space-y-4 rounded-2xl border bg-card p-4 shadow-sm transition-opacity", pending && "opacity-70")}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <label htmlFor="browse-q" className="sr-only">
            {t("search")}
          </label>
          <Input
            id="browse-q"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("search_placeholder")}
            className="h-11 pl-9"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="browse-city" className="sr-only">
            {t("filter_city")}
          </label>
          <select
            id="browse-city"
            value={params.get("city") ?? ""}
            onChange={(e) => update({ city: e.target.value || null })}
            className="h-11 rounded-md border bg-background px-3 text-sm"
          >
            <option value="">{t("filter_city")}</option>
            {cities.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <span className="sr-only sm:not-sr-only">{t("filter_from")}</span>
            <Input type="date" value={params.get("from") ?? ""} onChange={(e) => update({ from: e.target.value || null })} className="h-11 w-auto" />
          </label>
          <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <span className="sr-only sm:not-sr-only">{t("filter_to")}</span>
            <Input type="date" value={params.get("to") ?? ""} onChange={(e) => update({ to: e.target.value || null })} className="h-11 w-auto" />
          </label>
        </div>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label={t("filter_category")}>
        <button
          type="button"
          aria-pressed={!category}
          onClick={() => update({ category: null })}
          className={cn(
            "rounded-full border px-3 py-1.5 text-sm font-semibold transition",
            !category ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent",
          )}
        >
          {t("all_topics")}
        </button>
        {CATEGORY_ORDER.map((c) => {
          const style = CATEGORIES[c];
          const Icon = style.icon;
          const active = category === style.slug;
          return (
            <button
              key={c}
              type="button"
              aria-pressed={active}
              onClick={() => update({ category: active ? null : style.slug })}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold transition",
                active ? `${style.chip} ring-2 ring-current` : "hover:bg-accent",
              )}
            >
              <Icon className="size-4" aria-hidden />
              {t(style.label)}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
        <div className="inline-flex rounded-xl border p-1" role="group" aria-label={t("tab_upcoming")}>
          {(["upcoming", "past", "all"] as const).map((w) => (
            <button
              key={w}
              type="button"
              aria-pressed={when === w}
              onClick={() => update({ when: w === "upcoming" ? null : w })}
              className={cn(
                "rounded-lg px-3 py-1.5 text-sm font-semibold transition",
                when === w ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t(`tab_${w}`)}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant={near ? "default" : "outline"}
            size="sm"
            onClick={() => (near ? update({ lat: null, lng: null }) : nearMe())}
          >
            <LocateFixed className="size-4" aria-hidden />
            {t("near_me")}
          </Button>
          <div className="inline-flex rounded-xl border p-1" role="group">
            <button
              type="button"
              aria-pressed={view !== "map"}
              onClick={() => update({ view: null })}
              className={cn("inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold", view !== "map" ? "bg-accent text-accent-foreground" : "text-muted-foreground")}
            >
              <List className="size-4" aria-hidden /> {t("view_list")}
            </button>
            <button
              type="button"
              aria-pressed={view === "map"}
              onClick={() => update({ view: "map" })}
              className={cn("inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold", view === "map" ? "bg-accent text-accent-foreground" : "text-muted-foreground")}
            >
              <MapIcon className="size-4" aria-hidden /> {t("view_map")}
            </button>
          </div>
          {filtered && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setQ("");
                startTransition(() => router.replace(view === "map" ? `${pathname}?view=map` : pathname, { scroll: false }));
              }}
            >
              <X className="size-4" aria-hidden /> {t("clear_filters")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
