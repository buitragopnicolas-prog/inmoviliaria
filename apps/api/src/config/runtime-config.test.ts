import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRuntimeConfiguration } from './runtime-config.js';

test('permite configuración local mínima', () => {
  assert.doesNotThrow(() => validateRuntimeConfiguration({ APP_ENV: 'local', DATABASE_URL: 'postgresql://localhost/test' }));
});

test('producción exige APP_ENV explícita', () => {
  assert.throws(() => validateRuntimeConfiguration({ NODE_ENV: 'production', DATABASE_URL: 'postgresql://localhost/test' }), /APP_ENV/);
});

test('producción bloquea secretos por defecto y pagos mock', () => {
  const base = {
    NODE_ENV: 'production', APP_ENV: 'production', DATABASE_URL: 'postgresql://db/app', WEB_ORIGIN: 'https://example.com',
    JWT_SECRET: 'x'.repeat(48), STORAGE_ACCESS_KEY: 'storage-user', STORAGE_SECRET_KEY: 'x'.repeat(24), STORAGE_AUTO_CREATE_BUCKET: 'false',
  };
  assert.throws(() => validateRuntimeConfiguration({ ...base, PAYMENT_MODE: 'mock' }), /mock/);
  assert.throws(() => validateRuntimeConfiguration({ ...base, PAYMENT_MODE: 'manual' }), /medio autorizado/);
});

test('producción acepta manual completo', () => {
  assert.doesNotThrow(() => validateRuntimeConfiguration({
    NODE_ENV: 'production', APP_ENV: 'production', DATABASE_URL: 'postgresql://db/app', WEB_ORIGIN: 'https://example.com',
    JWT_SECRET: 'x'.repeat(48), STORAGE_ACCESS_KEY: 'storage-user', STORAGE_SECRET_KEY: 'x'.repeat(24), STORAGE_AUTO_CREATE_BUCKET: 'false',
    PAYMENT_MODE: 'manual', MANUAL_PAYMENT_BANK_NAME: 'Banco', MANUAL_PAYMENT_ACCOUNT_HOLDER: 'Titular',
    MANUAL_PAYMENT_ACCOUNT_TYPE: 'Ahorros', MANUAL_PAYMENT_ACCOUNT_DISPLAY: '****1234',
  }));
});
