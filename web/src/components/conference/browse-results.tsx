"use client";

import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import { useState } from "react";
import { useClient } from "urql";

import { ConferenceCard } from "@/components/conference/conference-card";
import { Button } from "@/components/ui/button";
import { BrowseConferences, type BrowseItem } from "@/components/conference/browse-query";
import type { ConferenceFilter } from "@/graphql/generated/graphql";

// Leaflet needs the browser (window), so the map is only ever rendered there.
const ConferenceMap = dynamic(() => import("@/components/conference/conference-map"), {
  ssr: false,
  loading: () => <div className="h-[32rem] animate-pulse rounded-2xl border bg-card" />,
});

export function BrowseResults({
  initial,
  hasNext: initialHasNext,
  endCursor: initialCursor,
  filter,
  view,
}: {
  initial: BrowseItem[];
  hasNext: boolean;
  endCursor: string | null;
  filter: ConferenceFilter;
  view: "list" | "map";
}) {
  const t = useTranslations();
  const client = useClient();
  const [items, setItems] = useState(initial);
  const [cursor, setCursor] = useState(initialCursor);
  const [hasNext, setHasNext] = useState(initialHasNext);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  async function loadMore() {
    setLoading(true);
    setFailed(false);
    const result = await client.query(BrowseConferences, { filter, first: 12, after: cursor }).toPromise();
    setLoading(false);
    if (!result.data) return setFailed(true);
    const page = result.data.conferences;
    setItems((current) => [...current, ...page.edges.map((e) => e.node as BrowseItem)]);
    setCursor(page.pageInfo.endCursor);
    setHasNext(page.pageInfo.hasNextPage);
  }

  return (
    <div className="space-y-6">
      {view === "map" ? (
        <ConferenceMap conferences={items} />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((c, i) => (
            <ConferenceCard key={c.id} conference={c} index={i % 12} />
          ))}
        </div>
      )}
      {hasNext && (
        <div className="flex justify-center">
          <Button size="lg" variant="outline" onClick={loadMore} disabled={loading} className="min-w-44 rounded-xl">
            {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {t("load_more")}
          </Button>
        </div>
      )}
      {failed && (
        <p role="alert" className="text-center text-sm text-destructive">
          {t("err_network")}
        </p>
      )}
    </div>
  );
}
