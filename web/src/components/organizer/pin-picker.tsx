"use client";

import "leaflet/dist/leaflet.css";

import L from "leaflet";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";

import { Button } from "@/components/ui/button";

export type Pin = { latitude: number; longitude: number } | null;

const SRI_LANKA: [number, number] = [7.87, 80.77];
const CITIES: { name: string; at: [number, number] }[] = [
  { name: "Colombo", at: [6.9271, 79.8612] },
  { name: "Kandy", at: [7.2906, 80.6337] },
  { name: "Galle", at: [6.0535, 80.221] },
  { name: "Jaffna", at: [9.6615, 80.0255] },
  { name: "Kurunegala", at: [7.4818, 80.3609] },
  { name: "Matara", at: [5.9549, 80.555] },
];

const icon = L.divIcon({
  className: "",
  html: '<span style="display:block;width:26px;height:26px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#0284c7;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,.4)"></span>',
  iconSize: [26, 26],
  iconAnchor: [13, 26],
});

function ClickToPlace({ onPick }: { onPick: (pin: Pin) => void }) {
  useMapEvents({ click: (e) => onPick({ latitude: e.latlng.lat, longitude: e.latlng.lng }) });
  return null;
}

function FollowPin({ pin }: { pin: Pin }) {
  const map = useMap();
  useEffect(() => {
    if (pin) map.setView([pin.latitude, pin.longitude], Math.max(map.getZoom(), 13));
  }, [pin, map]);
  return null;
}

/** Click the map to drop the venue pin, drag it to the exact building, or jump to a city. */
export default function PinPicker({ value, onChange }: { value: Pin; onChange: (pin: Pin) => void }) {
  const t = useTranslations();
  const round = (n: number) => Math.round(n * 1e6) / 1e6;
  const set = (pin: Pin) => onChange(pin && { latitude: round(pin.latitude), longitude: round(pin.longitude) });
  return (
    <div className="space-y-2">
      <div className="h-72 overflow-hidden rounded-2xl border">
        <MapContainer center={value ? [value.latitude, value.longitude] : SRI_LANKA} zoom={value ? 14 : 7} scrollWheelZoom={false} className="size-full">
          <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <ClickToPlace onPick={set} />
          <FollowPin pin={value} />
          {value && (
            <Marker
              position={[value.latitude, value.longitude]}
              icon={icon}
              draggable
              title={t("field_venue_lat")}
              alt={t("field_venue_lat")}
              eventHandlers={{ dragend: (e) => set({ latitude: e.target.getLatLng().lat, longitude: e.target.getLatLng().lng }) }}
            />
          )}
        </MapContainer>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-medium text-muted-foreground">{t("quick_pin")}</span>
        {CITIES.map((c) => (
          <button key={c.name} type="button" onClick={() => set({ latitude: c.at[0], longitude: c.at[1] })} className="rounded-full border px-2.5 py-1 hover:border-primary hover:text-primary">
            {c.name}
          </button>
        ))}
        {value && (
          <Button type="button" variant="ghost" size="sm" className="h-7 text-destructive" onClick={() => onChange(null)}>
            {t("remove_pin")}
          </Button>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        {value ? t("pin_set", { lat: value.latitude.toFixed(5), lng: value.longitude.toFixed(5) }) : t("pin_hint")}
      </p>
    </div>
  );
}
