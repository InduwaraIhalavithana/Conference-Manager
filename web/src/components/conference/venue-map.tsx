"use client";

import "leaflet/dist/leaflet.css";

import L from "leaflet";
import { MapContainer, Marker, TileLayer } from "react-leaflet";

const pin = L.divIcon({
  className: "",
  html: '<span style="display:block;width:26px;height:26px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:linear-gradient(135deg,#0ea5e9,#4f46e5);border:3px solid white;box-shadow:0 4px 12px rgba(0,0,0,.35)"></span>',
  iconSize: [26, 26],
  iconAnchor: [13, 26],
});

/** One pin on the venue. Loaded only in the browser (see VenueMapLazy). */
export default function VenueMap({ latitude, longitude }: { latitude: number; longitude: number }) {
  return (
    <MapContainer center={[latitude, longitude]} zoom={15} scrollWheelZoom={false} className="h-72 w-full">
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Marker position={[latitude, longitude]} icon={pin} interactive={false} keyboard={false} />
    </MapContainer>
  );
}
