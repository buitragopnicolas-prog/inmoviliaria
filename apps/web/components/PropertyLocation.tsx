'use client';

import dynamic from 'next/dynamic';
import { useId, useState } from 'react';
import { savedPoint, type MapPoint, type PropertyLocation } from '@/lib/property-location';
import { StatusNotice } from './StatusNotice';
import styles from './PropertyLocation.module.css';

const MapCanvas = dynamic(() => import('./PropertyMapCanvas'), {
  ssr: false, loading: () => <output>Cargando mapa…</output>,
});

export function PropertyLocationField({ location = {} }: Readonly<{ location?: PropertyLocation }>) {
  const [latitude, setLatitude] = useState(String(location.latitude ?? ''));
  const [longitude, setLongitude] = useState(String(location.longitude ?? ''));
  const [open, setOpen] = useState(false);
  const panel = useId();
  const [notice, setNotice] = useState('');
  const point: MapPoint | null = latitude && longitude && Math.abs(Number(latitude)) <= 90 && Math.abs(Number(longitude)) <= 180
    ? [Number(latitude), Number(longitude)] : null;

  function pick([lat, lng]: MapPoint) {
    setLatitude(lat.toFixed(6));
    setLongitude(lng.toFixed(6));
    setNotice(`Pin colocado en ${lat.toFixed(6)}, ${lng.toFixed(6)}.`);
  }
  return <fieldset className={styles.field}>
    <legend>Ubicación en el mapa (opcional)</legend>
    <p>El pin será visible en la ficha cuando publiques el inmueble.</p>
    <div className={styles.actions}>
      <button type="button" className="button secondary" aria-expanded={open} aria-controls={panel}
        onClick={() => setOpen(!open)}>{open ? 'Cerrar mapa' : 'Elegir en el mapa'}</button>
      {(latitude || longitude) && <button type="button" className="textLink" onClick={() => {
        setLatitude(''); setLongitude(''); setNotice('Pin retirado.');
      }}>Quitar pin</button>}
    </div>
    <div id={panel}>{open && <>
      <p>Acerca el mapa y toca el lugar, o arrastra el pin. Con el teclado, mueve el mapa con las flechas y marca el centro.</p>
      <MapCanvas point={point} onPick={pick} />
    </>}</div>
    {notice && <StatusNotice message={notice} />}
    <div className="twoCols">
      <label>Latitud<input name="latitude" type="number" min="-90" max="90" step="any" value={latitude}
        required={longitude !== ''} onChange={e => { setLatitude(e.target.value); setNotice(''); }} /></label>
      <label>Longitud<input name="longitude" type="number" min="-180" max="180" step="any" value={longitude}
        required={latitude !== ''} onChange={e => { setLongitude(e.target.value); setNotice(''); }} /></label>
    </div>
  </fieldset>;
}

export function PublicPropertyLocation(location: Readonly<PropertyLocation & { addressText: string }>) {
  const point = savedPoint(location);
  const [open, setOpen] = useState(false);
  const panel = useId();
  const coordinates = point?.join(', ');
  const query = coordinates || (location.addressText && location.addressText + ', Colombia');
  const mapLabel = point ? 'Ver mapa' : 'Ver mapa de Colombia';
  return <section className={styles.publicMap} aria-label="Ubicación del inmueble">
    <h2>Ubicación del inmueble</h2>
    {!point && <p>El anunciante aún no ha marcado el pin.</p>}
    <div className={styles.actions}>
      <button type="button" className="button secondary" aria-expanded={open} aria-controls={panel}
        onClick={() => setOpen(!open)}>{open ? 'Cerrar mapa' : mapLabel}</button>
      {query && <a className="textLink" href={'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(query)}
        target="_blank" rel="noopener noreferrer">{point ? 'Abrir en Google Maps' : 'Buscar ' + location.addressText + ' en Google Maps'} ↗</a>}
    </div>
    <div id={panel}>{open && <MapCanvas point={point} />}</div>
    {coordinates && <small>Coordenadas: {coordinates}</small>}
  </section>;
}
