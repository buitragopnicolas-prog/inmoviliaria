import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const baseUrl = new URL(process.env.E2E_BASE_URL ?? 'http://localhost:4000/api');
if (!['localhost', '127.0.0.1', '::1'].includes(baseUrl.hostname)) {
  throw new Error('El E2E financiero solo puede ejecutarse contra LOCAL.');
}

const customerEmail = required('E2E_CUSTOMER_EMAIL');
const customerPassword = required('E2E_CUSTOMER_PASSWORD');
const adminEmail = required('E2E_ADMIN_EMAIL');
const adminPassword = required('E2E_ADMIN_PASSWORD');

const customer = await login(customerEmail, customerPassword);
const admin = await login(adminEmail, adminPassword);
const [catalog, adminInvoices] = await Promise.all([
  api('/admin/invoices/catalog', { token: admin.accessToken }),
  api('/admin/invoices', { token: admin.accessToken }),
]);
const sourceInvoice = adminInvoices.find((item) => item.user?.email?.toLowerCase() === customerEmail.toLowerCase());
const service = catalog.services?.[0];
assert.ok(sourceInvoice?.leaseId && service?.id, 'Se requiere un contrato y un servicio seed para crear la factura E2E.');
const now = new Date();
const dueDate = new Date(now.getTime() + 7 * 24 * 60 * 60_000);
const invoice = await api('/admin/invoices', {
  method: 'POST',
  token: admin.accessToken,
  json: {
    leaseId: sourceInvoice.leaseId,
    period: now.toISOString(),
    dueDate: dueDate.toISOString(),
    services: [{ itemId: service.id, quantity: 1 }],
    products: [],
  },
});
assert.ok(invoice.balance > 0, 'La factura E2E debe iniciar con saldo.');

const manualConfig = await api('/payments/manual/config', { token: customer.accessToken });
const method = manualConfig.methods?.find((item) => item.enabled);
assert.ok(manualConfig.enabled && method, 'Se requiere un medio manual local habilitado.');

await expectStatus('/payments/manual/pending', { token: customer.accessToken }, 403);

const invalidFiles = [
  { name: 'html-como-jpg.jpg', type: 'image/jpeg', bytes: Buffer.from('<html>ataque</html>'), statuses: [400] },
  { name: 'exe-como-pdf.pdf', type: 'application/pdf', bytes: Buffer.from('MZ\0\0programa'), statuses: [400] },
  { name: 'mime-incorrecto.jpg', type: 'text/plain', bytes: Buffer.from([0xff, 0xd8, 0xff, 0x00, 0xff, 0xd9]), statuses: [400] },
  { name: 'vacio.pdf', type: 'application/pdf', bytes: Buffer.alloc(0), statuses: [400] },
  { name: 'corrupto.png', type: 'image/png', bytes: Buffer.from('PNG corrupto'), statuses: [400] },
  { name: 'comprobante.pdf.exe', type: 'application/pdf', bytes: Buffer.from('%PDF-1.4\n%%EOF'), statuses: [400] },
  { name: 'demasiado-grande.jpg', type: 'image/jpeg', bytes: Buffer.alloc(8_000_001, 0xff), statuses: [400, 413] },
];
for (const invalid of invalidFiles) {
  const response = await rawManualReport({
    invoiceId: invoice.id,
    amount: invoice.balance,
    method: method.code,
    bankReference: `INVALID-${randomUUID()}`,
    idempotencyKey: `invalid-${randomUUID()}`,
    token: customer.accessToken,
    file: invalid,
  });
  assert.ok(invalid.statuses.includes(response.status), `${invalid.name} respondió ${response.status}; se esperaba ${invalid.statuses.join(' o ')}.`);
}

const idempotencyKey = `e2e-${randomUUID()}`;
const bankReference = `E2E-${randomUUID()}`;
const reports = await Promise.all(Array.from({ length: 10 }, () => reportPayment({
  invoiceId: invoice.id,
  amount: invoice.balance,
  method: method.code,
  bankReference,
  idempotencyKey,
  token: customer.accessToken,
})));
assert.equal(new Set(reports.map((item) => item.id)).size, 1, 'La idempotencia produjo más de un pago.');
const payment = reports[0];
assert.equal(payment.status, 'AWAITING_VERIFICATION');
assert.ok(payment.receiptFileId, 'El comprobante no quedó asociado.');

await api(`/payments/receipts/${payment.receiptFileId}`, { token: customer.accessToken, parse: 'response' });
const outsider = await api('/auth/register', {
  method: 'POST',
  json: { name: 'Usuario IDOR E2E', email: `idor-${randomUUID()}@example.test`, phone: '+57 300 000 0000', password: `E2e-${randomUUID()}-Aa1!` },
});
await expectStatus(`/invoices/me/${invoice.id}`, { token: outsider.accessToken }, 404);
await expectStatus(`/payments/receipts/${payment.receiptFileId}`, { token: outsider.accessToken }, 404);
const pending = await api('/payments/manual/pending', { token: admin.accessToken });
assert.ok(pending.some((item) => item.id === payment.id), 'El reporte no aparece en la bandeja administrativa.');

const decisions = await Promise.all([
  raw(`/payments/manual/${payment.id}/review`, { method: 'PATCH', token: admin.accessToken, json: { decision: 'CONFIRM' } }),
  raw(`/payments/manual/${payment.id}/review`, { method: 'PATCH', token: admin.accessToken, json: { decision: 'CONFIRM' } }),
]);
const statuses = decisions.map((response) => response.status).sort((a, b) => a - b);
assert.equal(statuses.filter((status) => status >= 200 && status < 300).length, 1, `Se esperaba una sola confirmación: ${statuses.join(', ')}`);
assert.equal(statuses.filter((status) => status === 409).length, 1, `Se esperaba un conflicto concurrente: ${statuses.join(', ')}`);

const updated = await api(`/invoices/me/${invoice.id}`, { token: customer.accessToken });
assert.equal(updated.status, 'PAID');
await api(`/admin/invoices/${invoice.id}`, {
  method: 'DELETE',
  token: admin.accessToken,
  json: { reason: 'Limpieza posterior a E2E local de pagos manuales.' },
});
console.log(`E2E LOCAL correcto: pago ${payment.id}, idempotencia x10 y confirmación concurrente protegida.`);

async function login(email, password) {
  return api('/auth/login', { method: 'POST', json: { email, password } });
}

async function reportPayment({ invoiceId, amount, method, bankReference, idempotencyKey, token }) {
  const response = await rawManualReport({
    invoiceId, amount, method, bankReference, idempotencyKey, token,
    file: { name: 'comprobante-e2e.jpg', type: 'image/jpeg', bytes: Buffer.from([0xff, 0xd8, 0xff, 0x00, 0xff, 0xd9]) },
  });
  if (!response.ok) throw new Error(`POST manual-report: HTTP ${response.status} ${await response.text()}`);
  return response.json();
}

function rawManualReport({ invoiceId, amount, method, bankReference, idempotencyKey, token, file }) {
  const form = new FormData();
  form.set('method', method);
  form.set('amount', String(amount));
  form.set('paidAt', new Date(Date.now() - 60_000).toISOString());
  form.set('bankReference', bankReference);
  form.set('idempotencyKey', idempotencyKey);
  form.set('receipt', new Blob([file.bytes], { type: file.type }), file.name);
  return raw(`/payments/invoices/${invoiceId}/manual-report`, { method: 'POST', token, body: form });
}

async function expectStatus(path, options, expected) {
  const response = await raw(path, options);
  assert.equal(response.status, expected, `${path} respondió ${response.status}; se esperaba ${expected}.`);
}

async function api(path, options = {}) {
  const response = await raw(path, options);
  if (!response.ok) throw new Error(`${options.method ?? 'GET'} ${path}: HTTP ${response.status} ${await response.text()}`);
  if (options.parse === 'response') return response;
  return response.json();
}

function raw(path, { method = 'GET', token, json, body } = {}) {
  const headers = new Headers();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (json !== undefined) headers.set('Content-Type', 'application/json');
  return fetch(new URL(`${baseUrl.pathname.replace(/\/$/, '')}${path}`, baseUrl), {
    method,
    headers,
    body: json === undefined ? body : JSON.stringify(json),
  });
}

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} es obligatoria para el E2E local.`);
  return value;
}
