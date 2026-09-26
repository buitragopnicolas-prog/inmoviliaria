import test from 'node:test';
import assert from 'node:assert/strict';
import { publicManualPaymentConfig, resolveGateway, resolvePaymentMode } from './payment-config.js';

test('separa modo manual de la pasarela', () => {
  assert.equal(resolvePaymentMode({ PAYMENT_MODE: 'manual' }), 'manual');
  assert.equal(resolveGateway({ PAYMENT_GATEWAY: 'none' }), 'none');
});

test('mantiene compatibilidad temporal con PAYMENT_PROVIDER', () => {
  assert.equal(resolvePaymentMode({ PAYMENT_PROVIDER: 'mock' }), 'mock');
  assert.equal(resolvePaymentMode({ PAYMENT_PROVIDER: 'wompi' }), 'gateway');
  assert.equal(resolveGateway({ PAYMENT_PROVIDER: 'wompi' }), 'wompi');
});

test('no habilita medios sin información financiera autorizada', () => {
  const config = publicManualPaymentConfig({ PAYMENT_MODE: 'manual' });
  assert.equal(config.enabled, false);
  assert.ok(config.methods.every((method) => !method.enabled));
});

test('habilita transferencia con configuración pública completa', () => {
  const config = publicManualPaymentConfig({ PAYMENT_MODE: 'manual', MANUAL_PAYMENT_BANK_NAME: 'Banco', MANUAL_PAYMENT_ACCOUNT_HOLDER: 'Titular', MANUAL_PAYMENT_ACCOUNT_TYPE: 'Ahorros', MANUAL_PAYMENT_ACCOUNT_DISPLAY: '****1234' });
  assert.equal(config.methods.find((method) => method.code === 'BANK_TRANSFER')?.enabled, true);
  assert.equal(config.enabled, true);
});
