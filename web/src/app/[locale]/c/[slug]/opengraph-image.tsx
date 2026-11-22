import { ImageResponse } from "next/og";

import { graphql } from "@/graphql/generated";
import type { Category } from "@/graphql/generated/graphql";
import { CATEGORIES } from "@/lib/categories";
import { DEFAULT_TZ, formatRange } from "@/lib/format";
import { query } from "@/lib/graphql/server";

export const alt = "ConferenceHub";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const OgConference = graphql(`
  query OgConference($slug: String!) {
    conference(slug: $slug) {
      title { en }
      category
      timezone
      startsAt
      endsAt
      venue { city }
    }
  }
`);

/** The same colours as each topic's cover on the site (Tailwind 500 to 600/700). */
const GRADIENT: Record<Category, [string, string]> = {
  TECH: ["#0ea5e9", "#4f46e5"],
  HEALTH: ["#10b981", "#0d9488"],
  EDUCATION: ["#8b5cf6", "#7e22ce"],
  BUSINESS: ["#f97316", "#e11d48"],
  SCIENCE: ["#14b8a6", "#0e7490"],
  ARTS: ["#ec4899", "#a21caf"],
  OTHER: ["#64748b", "#334155"],
};

/**
 * The picture shown when a conference link is shared. It is always in English: the image renderer
 * only ships Latin glyphs, and the page's own title and description carry the reader's language.
 */
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { conference: c } = await query(OgConference, { slug }).catch(() => ({ conference: null }));
  const [from, to] = GRADIENT[c?.category ?? "OTHER"];
  const when = c ? formatRange(c.startsAt, c.endsAt, "en", c.timezone ?? DEFAULT_TZ) : "";
  const topic = c ? CATEGORIES[c.category].label.replace(/^cat_/, "") : "";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          color: "white",
          background: `linear-gradient(135deg, ${from}, ${to})`,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 34, fontWeight: 700 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: "rgba(255,255,255,.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            CH
          </div>
          ConferenceHub
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {topic && (
            <div style={{ display: "flex" }}>
              <span style={{ fontSize: 26, padding: "6px 20px", borderRadius: 999, background: "rgba(255,255,255,.2)" }}>{topic}</span>
            </div>
          )}
          <div style={{ fontSize: 68, fontWeight: 800, lineHeight: 1.1, maxWidth: 1050 }}>{c?.title.en ?? "Conferences across Sri Lanka"}</div>
          <div style={{ fontSize: 32, opacity: 0.9 }}>{[when, c?.venue.city].filter(Boolean).join("  ·  ")}</div>
        </div>
      </div>
    ),
    size,
  );
}
