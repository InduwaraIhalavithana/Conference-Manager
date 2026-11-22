import type { MetadataRoute } from "next";
import { cacheLife } from "next/cache";

import { graphql } from "@/graphql/generated";
import type { SitemapConferencesQuery } from "@/graphql/generated/graphql";
import { routing } from "@/i18n/routing";
import { query } from "@/lib/graphql/server";
import { SITE_URL } from "@/lib/site";

const SitemapConferences = graphql(`
  query SitemapConferences($after: String) {
    conferences(filter: { timeframe: ALL }, first: 100, after: $after) {
      edges { node { slug } }
      pageInfo { hasNextPage endCursor }
    }
  }
`);

const PAGES = ["", "/conferences", "/about", "/contact", "/privacy", "/terms"];

function entry(path: string): MetadataRoute.Sitemap[number] {
  const languages = Object.fromEntries(routing.locales.map((l) => [l, `${SITE_URL}/${l}${path}`]));
  return { url: `${SITE_URL}/${routing.defaultLocale}${path}`, alternates: { languages } };
}

/** Every public conference, re-read hourly. Without the API (a build on CI) it lists only the fixed pages. */
async function conferenceSlugs(): Promise<{ slug: string }[]> {
  "use cache";
  cacheLife("hours");
  const found: { slug: string }[] = [];
  try {
    let after: string | null = null;
    for (let page = 0; page < 50; page++) {
      const { conferences }: SitemapConferencesQuery = await query(SitemapConferences, { after });
      found.push(...conferences.edges.map((e) => e.node));
      if (!conferences.pageInfo.hasNextPage) break;
      after = conferences.pageInfo.endCursor ?? null;
    }
  } catch {
    // The API is not reachable: the fixed pages are still worth listing.
  }
  return found;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const conferences = await conferenceSlugs();
  return [...PAGES.map((p) => entry(p)), ...conferences.map((c) => entry(`/c/${c.slug}`))];
}
