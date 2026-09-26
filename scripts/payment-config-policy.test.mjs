import test from 'node:test';
import assert from 'node:assert/strict';
import { readConfigMap, validateProductionPaymentConfig } from './payment-config-policy.mjs';

test('bloquea el proveedor mock heredado', () => {
  assert.equal(validateProductionPaymentConfig({ PAYMENT_PROVIDER: 'mock' }).safe, false);
});

test('bloquea PAYMENT_MODE mock', () => {
  assert.equal(validateProductionPaymentConfig({ PAYMENT_MODE: 'mock' }).safe, false);
});

test('permite manual solo con un medio autorizado completo', () => {
  assert.equal(validateProductionPaymentConfig({ PAYMENT_MODE: 'manual', MANUAL_PAYMENT_BANK_NAME: 'Banco', MANUAL_PAYMENT_ACCOUNT_HOLDER: 'Titular', MANUAL_PAYMENT_ACCOUNT_TYPE: 'Ahorros', MANUAL_PAYMENT_ACCOUNT_DISPLAY: '****1234' }).safe, true);
});

test('bloquea manual sin datos bancarios', () => {
  assert.equal(validateProductionPaymentConfig({ PAYMENT_MODE: 'manual' }).safe, false);
});

test('permite una pasarela real y bloquea gateway none', () => {
  assert.equal(validateProductionPaymentConfig({ PAYMENT_MODE: 'gateway', PAYMENT_GATEWAY: 'wompi' }).safe, true);
  assert.equal(validateProductionPaymentConfig({ PAYMENT_MODE: 'gateway', PAYMENT_GATEWAY: 'none' }).safe, false);
});

test('lee las variables del ConfigMap renderizado', () => {
  const config = readConfigMap('data:\n  PAYMENT_MODE: "manual"\n  MANUAL_PAYMENT_BANK_NAME: Banco');
  assert.deepEqual(config, { PAYMENT_MODE: 'manual', MANUAL_PAYMENT_BANK_NAME: 'Banco' });
});
