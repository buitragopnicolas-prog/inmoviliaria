import { publicManualPaymentConfig, resolveGateway, resolvePaymentMode } from '../payments/payment-config.js';

export function validateRuntimeConfiguration(environment: NodeJS.ProcessEnv = process.env): void {
  const runtime = (environment.APP_ENV ?? (environment.NODE_ENV === 'production' ? '' : 'local')).trim().toLowerCase();
  if (!['local', 'development', 'production'].includes(runtime)) {
    throw new Error('APP_ENV debe ser local, development o production.');
  }
  if (environment.NODE_ENV === 'production' && !environment.APP_ENV) {
    throw new Error('APP_ENV es obligatoria cuando NODE_ENV=production.');
  }
  if (!environment.DATABASE_URL) throw new Error('DATABASE_URL no está configurada.');
  if (runtime !== 'production') return;

  if (!environment.JWT_SECRET || environment.JWT_SECRET.length < 32 || environment.JWT_SECRET === 'insecure-development-secret-change-it') {
    throw new Error('JWT_SECRET debe tener al menos 32 caracteres seguros en producción.');
  }
  if (!environment.WEB_ORIGIN?.startsWith('https://')) throw new Error('WEB_ORIGIN debe usar HTTPS en producción.');
  if (!environment.STORAGE_ACCESS_KEY || environment.STORAGE_ACCESS_KEY === 'minioadmin') throw new Error('STORAGE_ACCESS_KEY segura es obligatoria en producción.');
  if (!environment.STORAGE_SECRET_KEY || environment.STORAGE_SECRET_KEY === 'minioadmin' || environment.STORAGE_SECRET_KEY.length < 16) throw new Error('STORAGE_SECRET_KEY segura es obligatoria en producción.');
  if ((environment.STORAGE_AUTO_CREATE_BUCKET ?? '').toLowerCase() !== 'false') throw new Error('STORAGE_AUTO_CREATE_BUCKET debe ser false en producción.');

  const mode = resolvePaymentMode(environment);
  if (mode === 'mock') throw new Error('PAYMENT_MODE=mock está bloqueado en producción.');
  if (mode === 'manual' && !publicManualPaymentConfig(environment).enabled) throw new Error('El modo manual requiere al menos un medio autorizado completo.');
  if (mode === 'gateway') {
    const gateway = resolveGateway(environment);
    if (gateway === 'none') throw new Error('PAYMENT_GATEWAY debe identificar una pasarela real.');
    if (gateway === 'wompi' && (!environment.WOMPI_PUBLIC_KEY || !environment.WOMPI_INTEGRITY_SECRET || !environment.WOMPI_EVENTS_SECRET)) throw new Error('La configuración Wompi está incompleta.');
  }
}
