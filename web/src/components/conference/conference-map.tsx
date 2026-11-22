"use client";

import "leaflet/dist/leaflet.css";

import L from "leaflet";
import { useLocale, useTranslations } from "next-intl";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";

import type { BrowseItem } from "@/components/conference/browse-query";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { formatRange, localized } from "@/lib/format";

// Sri Lanka, when no conference has a location yet.
const SRI_LANKA: [number, number] = [7.8731, 80.7718];

// A CSS pin instead of Leaflet's image icons (their default paths break under bundlers).
const pin = L.divIcon({
  className: "",
  html: '<span style="display:block;width:22px;height:22px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:linear-gradient(135deg,#0ea5e9,#4f46e5);border:3px solid white;box-shadow:0 4px 12px rgba(0,0,0,.35)"></span>',
  iconSize: [22, 22],
  iconAnchor: [11, 22],
  popupAnchor: [0, -20],
});

export default function ConferenceMap({ conferences }: { conferences: BrowseItem[] }) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const placed = conferences.filter((c) => c.venue.location);
  const bounds = placed.length
    ? L.latLngBounds(placed.map((c) => [c.venue.location!.latitude, c.venue.location!.longitude] as [number, number]))
    : null;

  return (
    <div className="overflow-hidden rounded-2xl border shadow-sm">
      <MapContainer
        center={SRI_LANKA}
        zoom={7}
        bounds={bounds?.pad(0.2) ?? undefined}
        scrollWheelZoom={false}
        className="h-[32rem] w-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {placed.map((c) => (
          <Marker key={c.id} position={[c.venue.location!.latitude, c.venue.location!.longitude]} icon={pin} title={localized(c.title, locale)} alt={localized(c.title, locale)}>
            <Popup>
              <div className="space-y-1">
                <Link href={`/c/${c.slug}`} className="font-bold">
                  {localized(c.title, locale)}
                </Link>
                <div>{formatRange(c.startsAt, c.endsAt, locale, c.timezone)}</div>
                <div>{c.city}</div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
      {placed.length < conferences.length && (
        <p className="border-t bg-card px-4 py-2 text-sm text-muted-foreground">{t("venue_no_map")}</p>
      )}
    </div>
  );
}
