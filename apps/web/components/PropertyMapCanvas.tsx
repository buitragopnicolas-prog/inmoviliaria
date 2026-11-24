'use client';

import { useEffect, useState } from 'react';
import { divIcon, type Map as LeafletMap } from 'leaflet';
import { MapContainer, Marker, TileLayer, ZoomControl, useMapEvents } from 'react-leaflet';
import type { MapPoint } from '@/lib/property-location';
import 'leaflet/dist/leaflet.css';
import styles from './PropertyLocation.module.css';

const countryCenter: MapPoint = [4.7, -74.5];
const pinIcon = divIcon({ className: styles.pin, iconSize: [24, 32], iconAnchor: [12, 32] });
type CanvasProps = Readonly<{ point: MapPoint | null; onPick?: (point: MapPoint) => void }>;

function PinControls({ point, onPick }: CanvasProps) {
  const map = useMapEvents({
    click(event) {
      const { lat, lng } = event.latlng.wrap();
      onPick?.([lat, lng]);
    },
  });
  const lat = point?.[0], lng = point?.[1];
  useEffect(() => {
    if (lat !== undefined && lng !== undefined && !map.getBounds().contains([lat, lng])) {
      map.setView([lat, lng], 16, { animate: false });
    }
  }, [lat, lng, map]);
  if (!point) return null;
  return <Marker position={point} icon={pinIcon} draggable={Boolean(onPick)} title="Ubicación del inmueble" alt="Ubicación del inmueble"
      eventHandlers={{ dragend(event) {
        const position = event.target.getLatLng().wrap();
        onPick?.([position.lat, position.lng]);
      } }} />;
}

export default function PropertyMapCanvas({ point, onPick }: CanvasProps) {
  const [map, setMap] = useState<LeafletMap | null>(null);
  const [tileError, setTileError] = useState(false);
  return <div className={styles.frame}>
    <MapContainer ref={setMap} center={point ?? countryCenter} zoom={point ? 16 : 5} minZoom={3} maxZoom={19}
      zoomControl={false} scrollWheelZoom={false} zoomAnimation={false} fadeAnimation={false}
      markerZoomAnimation={false} inertia={false} className={styles.map}>
      <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19}
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        eventHandlers={{ tileerror: () => setTileError(true), loading: () => setTileError(false) }} />
      <ZoomControl zoomInTitle="Acercar mapa" zoomOutTitle="Alejar mapa" />
      <PinControls point={point} onPick={onPick} />
    </MapContainer>
    {onPick && map && <button type="button" className={styles.centerButton} onClick={() => {
      const center = map.getCenter().wrap();
      onPick([center.lat, center.lng]);
    }}>Marcar el centro del mapa</button>}
    {tileError && <p role="status">No se pudo cargar parte del mapa. Las coordenadas siguen disponibles.</p>}
  </div>;
}
