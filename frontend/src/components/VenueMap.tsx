import { useEffect } from 'react';
import L from 'leaflet';
import { MapContainer, Marker, TileLayer, ZoomControl, useMap, useMapEvents } from 'react-leaflet';
import { useApp } from '../context/AppContext';
import 'leaflet/dist/leaflet.css';
import './VenueMap.css';

// A styled pin instead of Leaflet's image icons (those need extra bundler setup).
const pin = L.divIcon({
  className: 'venue-pin',
  html: '<span><i class="fas fa-location-dot"></i></span>',
  iconSize: [40, 48],
  iconAnchor: [20, 46],
});

const SRI_LANKA: [number, number] = [7.8731, 80.7718];
const TILES = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

function Recenter({ at, zoom }: { at: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => { map.setView(at, zoom); }, [map, at, zoom]);
  return null;
}

/** Zoom buttons with translated tooltips (Leaflet's own are English only). */
function Zoom() {
  const { t, lang } = useApp();
  // Remount on language change: Leaflet reads the titles only once.
  return <ZoomControl key={lang} position="topleft" zoomInTitle={t('map_zoom_in')} zoomOutTitle={t('map_zoom_out')} />;
}

/** Read-only map with the venue pin (OpenStreetMap tiles, no API key). */
export default function VenueMap({ lat, lng, height = 300 }: { lat: number; lng: number; height?: number }) {
  return (
    <div className="venue-map" style={{ height }}>
      <MapContainer center={[lat, lng]} zoom={15} scrollWheelZoom={false} zoomControl={false} style={{ height: '100%', width: '100%' }}>
        <TileLayer url={TILES} attribution={ATTRIBUTION} />
        <Zoom />
        <Marker position={[lat, lng]} icon={pin} />
      </MapContainer>
    </div>
  );
}

function ClickToPlace({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (e) => onPick(Number(e.latlng.lat.toFixed(6)), Number(e.latlng.lng.toFixed(6))) });
  return null;
}

/** Organizer picks the venue by clicking the map. */
export function MapPicker({ lat, lng, onPick, height = 320 }: {
  lat: number | null; lng: number | null; onPick: (lat: number, lng: number) => void; height?: number;
}) {
  const has = lat !== null && lng !== null;
  const center: [number, number] = has ? [lat!, lng!] : SRI_LANKA;
  return (
    <div className="venue-map venue-map--pick" style={{ height }}>
      <MapContainer center={center} zoom={has ? 15 : 7} scrollWheelZoom zoomControl={false} style={{ height: '100%', width: '100%' }}>
        <TileLayer url={TILES} attribution={ATTRIBUTION} />
        <Zoom />
        <ClickToPlace onPick={onPick} />
        {has && <Marker position={[lat!, lng!]} icon={pin} draggable eventHandlers={{
          dragend: (e) => {
            const p = (e.target as L.Marker).getLatLng();
            onPick(Number(p.lat.toFixed(6)), Number(p.lng.toFixed(6)));
          },
        }} />}
        {has && <Recenter at={[lat!, lng!]} zoom={15} />}
      </MapContainer>
    </div>
  );
}
