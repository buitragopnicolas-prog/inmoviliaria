import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

export function validateProductionPaymentConfig(config) {
  const mode = String(config.PAYMENT_MODE ?? '').trim().toLowerCase();
  const legacyProvider = String(config.PAYMENT_PROVIDER ?? '').trim().toLowerCase();
  if (!mode && ['mock', 'test', 'sandbox'].includes(legacyProvider)) return { safe: false, reason: 'Producción sigue configurada con pagos simulados.' };
  if (['mock', 'test', 'sandbox'].includes(mode)) return { safe: false, reason: 'PAYMENT_MODE simulado está bloqueado en producción.' };
  if (mode === 'gateway') {
    const gateway = String(config.PAYMENT_GATEWAY ?? legacyProvider).trim().toLowerCase();
    if (!gateway || ['none', 'mock', 'test', 'sandbox'].includes(gateway)) return { safe: false, reason: 'El modo gateway requiere una pasarela real configurada.' };
    return { safe: true };
  }
  if (mode === 'manual') {
    const bank = value(config.MANUAL_PAYMENT_BANK_NAME);
    const holder = value(config.MANUAL_PAYMENT_ACCOUNT_HOLDER);
    const hasQr = value(config.MANUAL_PAYMENT_QR_IMAGE_URL);
    const hasBreb = value(config.MANUAL_PAYMENT_BREB_KEY_TYPE) && value(config.MANUAL_PAYMENT_BREB_KEY_DISPLAY);
    const hasAccount = value(config.MANUAL_PAYMENT_ACCOUNT_TYPE) && value(config.MANUAL_PAYMENT_ACCOUNT_DISPLAY);
    if (!bank || !holder || (!hasQr && !hasBreb && !hasAccount)) return { safe: false, reason: 'El modo manual requiere datos autorizados para al menos un medio de pago.' };
    return { safe: true };
  }
  return { safe: false, reason: 'Producción requiere PAYMENT_MODE=manual o PAYMENT_MODE=gateway.' };
}

export function readConfigMap(text) {
  const config = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s{2,}([A-Z][A-Z0-9_]*):\s*["']?(.*?)["']?\s*$/);
    if (match) config[match[1]] = match[2];
  }
  return config;
}

function value(input) {
  return String(input ?? '').trim();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const path = process.argv[2];
  if (!path) {
    console.error('Uso: node scripts/payment-config-policy.mjs MANIFEST');
    process.exit(2);
  }
  const result = validateProductionPaymentConfig(readConfigMap(fs.readFileSync(path, 'utf8')));
  if (!result.safe) {
    console.error(result.reason);
    process.exit(1);
  }
}
