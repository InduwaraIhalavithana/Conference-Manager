import { SearchX } from "lucide-react";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";

import { BrowseFilters } from "@/components/conference/browse-filters";
import { BrowseConferences, type BrowseItem } from "@/components/conference/browse-query";
import { BrowseResults } from "@/components/conference/browse-results";
import { ConferenceCardSkeleton } from "@/components/conference/conference-card";
import { graphql } from "@/graphql/generated";
import { hasFilters, parseBrowseParams, toFilter } from "@/lib/browse-params";
import { query } from "@/lib/graphql/server";
import type { Locale } from "@/i18n/routing";
import { alternates } from "@/lib/seo";

const Cities = graphql(`
  query BrowseCities {
    upcomingCities(first: 50) { city }
  }
`);

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  const locale = (await getLocale()) as Locale;
  return { title: t("conferences_title"), description: t("conferences_subtitle"), alternates: alternates(locale, "/conferences") };
}

export default async function ConferencesPage({ searchParams }: PageProps<"/[locale]/conferences">) {
  const t = await getTranslations();
  return (
    <>
      <section className="border-b bg-hero">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
          <h1 className="text-4xl font-extrabold tracking-tight">{t("conferences_title")}</h1>
          <p className="mt-2 max-w-2xl text-lg text-muted-foreground">{t("conferences_subtitle")}</p>
        </div>
      </section>
      <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6">
        <Suspense fallback={<div className="h-44 animate-pulse rounded-2xl border bg-card" />}>
          <Filters />
        </Suspense>
        <Suspense
          fallback={
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }, (_, i) => (
                <ConferenceCardSkeleton key={i} />
              ))}
            </div>
          }
        >
          <Results searchParams={searchParams} />
        </Suspense>
      </div>
    </>
  );
}

async function Filters() {
  const { upcomingCities } = await query(Cities);
  return <BrowseFilters cities={upcomingCities.map((c) => c.city)} />;
}

async function Results({ searchParams }: { searchParams: PageProps<"/[locale]/conferences">["searchParams"] }) {
  const t = await getTranslations();
  const params = parseBrowseParams(await searchParams);
  const filter = toFilter(params);
  const { conferences } = await query(BrowseConferences, { filter, first: params.view === "map" ? 50 : 12 });
  const items = conferences.edges.map((e) => e.node as BrowseItem);

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed px-6 py-16 text-center">
        <SearchX className="size-10 text-muted-foreground" aria-hidden />
        <h2 className="text-xl font-bold">{t("no_results_title")}</h2>
        <p className="text-muted-foreground">{hasFilters(params) ? t("no_results_filtered") : t("no_results_none")}</p>
      </div>
    );
  }
  return (
    <BrowseResults
      // A new filter is a new list: remount so loaded pages do not mix with the old results.
      key={JSON.stringify(filter) + params.view}
      initial={items}
      hasNext={conferences.pageInfo.hasNextPage}
      endCursor={conferences.pageInfo.endCursor}
      filter={filter}
      view={params.view}
    />
  );
}
