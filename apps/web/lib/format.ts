export const publicApiUrl = () => process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export const assetUrl = (path?: string) => {
  if (!path || path === '/property-placeholder.svg') return '/property-placeholder.svg';
  return /^https?:\/\//i.test(path) ? path : `${publicApiUrl()}${path}`;
};

export const pesos = (amount: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(amount);
const formatoFechaLocal = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeZone: 'America/Bogota' });
const formatoFechaCalendario = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeZone: 'UTC' });

// Los movimientos tienen una hora real y se muestran en la zona de Colombia,
// independientemente de la zona del servidor o del navegador.
export const fecha = (value: string) => formatoFechaLocal.format(new Date(value));

// La API serializa las fechas civiles (periodos, vencimientos y vigencias) en UTC.
// Convertirlas a Bogotá restaría un día cuando están guardadas a medianoche.
export const fechaCalendario = (value: string) => formatoFechaCalendario.format(new Date(value));
export const tamanoArchivo = (size: number) => {
  if (size < 1024) return `${size} B`;
  if (size < 1024 ** 2) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 ** 2).toFixed(1)} MB`;
};
