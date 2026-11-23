import { consentFor } from './portal-privacy-test-data.mjs';
import { syntheticPdf } from './synthetic-pdf.mjs';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { JSDOM } from 'jsdom';
import bcrypt from 'bcryptjs';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../apps/api/dist/generated/prisma/client.js';

// Only the disposable CI database is allowed, never the VPS or a forwarded production DB.
assert.equal(process.env.CI, 'true', 'Este E2E requiere un entorno CI aislado.');
function loopback(value) {
  const url = new URL(value);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname));
  assert.equal(url.protocol, 'http:');
  assert.ok(!url.username && !url.password && !url.search && !url.hash);
  return url;
}
const apiBase = loopback(required('E2E_BASE_URL'));
const webBase = loopback(required('E2E_WEB_URL'));
assert.equal(apiBase.pathname, '/api');
assert.equal(webBase.pathname, '/');
const database = new URL(required('DATABASE_URL'));
assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(database.hostname));
assert.equal(database.pathname, '/inmobiliaria_ci');
assert.equal(process.env.ANTIMALWARE_ENABLED, 'true');
assert.equal(process.env.PUBLIC_REGISTRATION_ENABLED, 'false');
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: database.href }) });
const run = `E2E-CI-${randomUUID().slice(0, 8).toUpperCase()}`;
const results = { run, passed: false, cases: [], security: [] };
let admin, customer, outsider, source, service;
const policyText='Política sintética del entorno aislado de integración.';
const policy=consentFor({policyText});

try {
  await prisma.siteSection.upsert({where:{id:'contacto'},create:{id:'contacto',values:{policyText}},update:{values:{policyText}}});
  admin = await login(required('E2E_ADMIN_EMAIL'), required('E2E_ADMIN_PASSWORD'));
  customer = await login(required('E2E_CUSTOMER_EMAIL'), required('E2E_CUSTOMER_PASSWORD'));
  assert.equal(admin.user.role, 'ADMIN');
  assert.equal(customer.user.role, 'USER');
  const outsiderPassword = `Ci-only-${randomUUID()}!`;
  const outsiderUser = await prisma.user.create({ data: {
    name: 'Cliente ajeno de prueba CI', email: `outsider-${randomUUID()}@example.test`,
    passwordHash: await bcrypt.hash(outsiderPassword, 12), role: 'USER',
  } });
  outsider = await login(outsiderUser.email, outsiderPassword);
  const catalog = await api('/admin/invoices/catalog', { token: admin.accessToken });
  service = catalog.services.reduce((a, b) => a.unitPrice < b.unitPrice ? a : b);
  source = (await api('/admin/invoices', { token: admin.accessToken }))
    .find(item => item.user?.email.toLowerCase() === required('E2E_CUSTOMER_EMAIL').toLowerCase());
  assert.ok(source?.leaseId && service.id);
  const config = await api('/payments/manual/config', { token: customer.accessToken });
  assert.equal(config.mode, 'manual');
  assert.equal(config.enabled, true);
  for (const code of ['QR', 'BREB', 'BANK_TRANSFER', 'BANK_DEPOSIT']) {
    assert.equal(config.methods.find(method => method.code === code)?.enabled, true);
    await apiCase(code);
  }
  // One invalid receipt + nine reports exhaust the real limit of ten per minute.
  await expectStatus(`/payments/invoices/${results.cases.at(-1).invoiceId}/manual-report`, {
    method: 'POST', token: customer.accessToken, body: formWithReceipt({ method: 'QR' }, receiptPdf(run)),
  }, 429);
  results.security.push('Límite real de diez reportes por minuto verificado');
  await delay(61000);
  await webCase();
  assert.ok(!await prisma.paymentAuditEvent.count({ where: {
    payment: { bankReference: { startsWith: run } }, actorId: null,
  } }));
  results.passed = true;
  console.log('E2E obligatorio: cuatro medios por API y formularios web reales, PDF privado, ClamAV, auditoría, saldo y permisos: OK');
} catch (error) {
  results.error = error.message;
  throw error;
} finally {
  await mkdir('coverage', { recursive: true });
  await writeFile('coverage/manual-payments-e2e.json', JSON.stringify(results, null, 2));
  await prisma.$disconnect();
}

async function newInvoice(label) {
  const now = new Date();
  const invoice = await api('/admin/invoices', { token: admin.accessToken, method: 'POST', json: {
    leaseId: source.leaseId, period: now.toISOString(),
    dueDate: new Date(now.getTime() + 7 * 86400000).toISOString(),
    services: [{ itemId: service.id, quantity: 1 }], products: [],
  } });
  assert.ok(invoice.balance > 0);
  await api(`/admin/invoices/${invoice.id}`, { token: admin.accessToken, method: 'PATCH',
    json: { note: `${run} ${label}: prueba sintética CI; no corresponde a un pago real.` } });
  return invoice;
}

async function apiCase(method) {
  const invoice = await newInvoice(method);
  const pdf = receiptPdf(`${run} ${method}`);
  const fields = { ...policy, method, amount: String(invoice.balance),
    paidAt: new Date(Date.now() - 60000).toISOString(),
    bankReference: `${run}-${method}`, idempotencyKey: randomUUID() };
  const path = `/payments/invoices/${invoice.id}/manual-report`;
  if (method === 'QR') {
    const bad = formWithReceipt(fields, Buffer.from('<html>no es un PDF</html>'));
    await expectStatus(path, { method: 'POST', token: customer.accessToken, body: bad }, 400);
    const eicar = String.raw`X5O!P%@AP[4\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*`;
    const eicarName = `ci-eicar-${randomUUID()}.com`;
    const infected = new FormData();
    infected.set('files', new Blob([eicar], { type: 'application/octet-stream' }), eicarName);
    await expectStatus('/admin/files', { method: 'POST', token: admin.accessToken, body: infected }, 400);
    const quarantined = await prisma.storedFile.findFirstOrThrow({ where: { originalName: eicarName } });
    assert.equal(quarantined.scanStatus, 'INFECTED');
    assert.equal(await prisma.payment.count({ where: { invoiceId: invoice.id } }), 0);
    results.security.push('PDF falso y EICAR rechazados sin crear pagos');
  }
  const payment = await api(path, { method: 'POST', token: customer.accessToken, body: formWithReceipt(fields, pdf) });
  assert.equal(payment.status, 'AWAITING_VERIFICATION');
  assert.ok(payment.receiptFileId);
  const duplicate = await api(path, { method: 'POST', token: customer.accessToken, body: formWithReceipt(fields, pdf) });
  assert.equal(duplicate.id, payment.id);
  if (method === 'QR') {
    const third = await api(path, { method: 'POST', token: customer.accessToken, body: formWithReceipt(fields, pdf) });
    assert.equal(third.id, payment.id);
  }
  await checkPending(invoice, payment, pdf);
  const decisions = await Promise.all([1, 2].map(() => raw(`/payments/manual/${payment.id}/review`, {
    method: 'PATCH', token: admin.accessToken, json: { decision: 'CONFIRM', note: `${run}: aprobación de prueba.` },
  })));
  assert.deepEqual(decisions.map(response => response.status).sort((a, b) => a - b), [200, 409]);
  await checkApproved(invoice, payment);
  results.cases.push({ method, invoiceId: invoice.id, invoice: invoice.code, payment: payment.id, status: 'PAID', balance: 0 });
  console.log(`${method}: PDF limpio privado, reporte pendiente, aprobación concurrente protegida y saldo 0: OK`);
}

async function checkPending(invoice, payment, pdf) {
  const before = await api(`/invoices/me/${invoice.id}`, { token: customer.accessToken });
  assert.equal(before.balance, invoice.balance);
  assert.equal(before.approvedAmount, 0);
  assert.notEqual(before.status, 'PAID');
  const pending = await api('/payments/manual/pending', { token: admin.accessToken });
  const item = pending.find(item => item.id === payment.id);
  assert.equal(item.receiptFile.mimeType, 'application/pdf');
  for (const token of [customer.accessToken, admin.accessToken]) {
    const response = await raw(`/payments/receipts/${payment.receiptFileId}`, { token });
    assert.equal(response.status, 200);
    assert.match(response.headers.get('cache-control'), /private.*no-store/);
    assert.equal(createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex'), createHash('sha256').update(pdf).digest('hex'));
  }
  await expectStatus(`/payments/receipts/${payment.receiptFileId}`, {}, 401);
  await expectStatus(`/files/${payment.receiptFileId}/content`, {}, 404);
  await expectStatus(`/payments/receipts/${payment.receiptFileId}`, { token: outsider.accessToken }, 404);
  await expectStatus(`/invoices/me/${invoice.id}`, { token: outsider.accessToken }, 404);
  await expectStatus('/payments/manual/pending', { token: customer.accessToken }, 403);
  await expectStatus(`/payments/manual/${payment.id}/review`, {
    method: 'PATCH', token: customer.accessToken, json: { decision: 'CONFIRM' },
  }, 403);
}

async function checkApproved(invoice, payment) {
  const after = await api(`/invoices/me/${invoice.id}`, { token: customer.accessToken });
  assert.equal(after.status, 'PAID');
  assert.equal(after.balance, 0);
  assert.equal(after.approvedAmount, invoice.balance);
  assert.equal(after.payments.filter(item => item.status === 'APPROVED').length, 1);
  const stored = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id },
    include: { receiptFile: true, auditEvents: { orderBy: { createdAt: 'asc' } } } });
  assert.equal(stored.reviewedById, admin.user.sub);
  assert.equal(stored.receiptFile.scanStatus, 'CLEAN');
  assert.equal(stored.receiptFile.scanEngine, 'ClamAV');
  assert.equal(stored.receiptFile.purpose, 'PAYMENT_RECEIPT');
  assert.deepEqual(stored.auditEvents.map(event => [event.fromStatus, event.toStatus, event.actorId]), [
    [null, 'AWAITING_VERIFICATION', customer.user.sub],
    ['AWAITING_VERIFICATION', 'APPROVED', admin.user.sub],
  ]);
  assert.ok(!(await api('/payments/manual/pending', { token: admin.accessToken })).some(item => item.id === payment.id));
  await expectStatus(`/payments/manual/${payment.id}/review`, {
    method: 'PATCH', token: admin.accessToken, json: { decision: 'CONFIRM' },
  }, 409);
}

async function webCase() {
  const invoice = await newInvoice('WEB');
  const payPath = `/mi-cuenta/facturas/${invoice.id}/pagar`;
  const html = await webPage(payPath, customer.accessToken);
  const qr = await web('/ci-qr.svg');
  assert.equal(qr.status, 200);
  assert.deepEqual(Buffer.from(await qr.arrayBuffer()), await readFile('scripts/fixtures/manual-payment-qr.svg'));
  const form = findForm(html, 'invoiceId', invoice.id);
  form.set('authorized','true'); form.set('policyVersion',policy.policyVersion);
  form.set('bankReference', `${run}-WEB`);
  form.set('paidAt', new Date(Date.now() - 60000).toISOString());
  const pdf = receiptPdf(`${run} WEB`);
  form.set('receipt', new Blob([pdf], { type: 'application/pdf' }), 'comprobante-ci.pdf');
  const submitted = await web(payPath, { method: 'POST', token: customer.accessToken, body: form });
  assert.equal(submitted.status, 200);
  assert.match(await webPage(payPath, customer.accessToken), /PENDIENTE DE VERIFICACIÓN/);
  const payment = (await api('/payments/manual/pending', { token: admin.accessToken }))
    .find(item => item.invoiceId === invoice.id);
  assert.ok(payment?.receiptFileId);
  await checkPending(invoice, payment, pdf);
  const accountPath = `/mi-cuenta?referencia=${encodeURIComponent(payment.reference)}`;
  const pendingNotice = await accountNotice(accountPath, customer.accessToken);
  assert.ok(pendingNotice?.startsWith('Pendiente de verificación.'));
  assert.ok(pendingNotice.includes(invoice.code) && pendingNotice.includes(payment.reference));
  assert.equal(await accountNotice('/mi-cuenta?pago=aprobado', customer.accessToken), null);
  assert.equal(await accountNotice(accountPath, outsider.accessToken), null);
  for (const token of [customer.accessToken, admin.accessToken]) {
    const response = await web(`/documentos/pagos/${payment.receiptFileId}`, { token });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'application/pdf');
    assert.match(response.headers.get('cache-control'), /private.*no-store/);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), pdf);
  }
  assert.equal((await web(`/documentos/pagos/${payment.receiptFileId}`)).status, 401);
  assert.equal((await web(`/documentos/pagos/${payment.receiptFileId}`, { token: outsider.accessToken })).status, 404);
  const review = findForm(await webPage('/admin/conciliacion', admin.accessToken), 'paymentId', payment.id);
  review.set('decision', 'CONFIRM');
  review.set('note', `${run}: aprobación desde formulario web de prueba.`);
  assert.equal((await web('/admin/conciliacion', { method: 'POST', token: admin.accessToken, body: review })).status, 200);
  await checkApproved(invoice, payment);
  assert.ok((await accountNotice(accountPath, customer.accessToken))?.startsWith('Pago aprobado.'));
  assert.match(await webPage(payPath, customer.accessToken), /Esta factura no tiene saldo pendiente/);
  results.cases.push({ method: 'WEB_FORMS', invoice: invoice.code, payment: payment.id, status: 'PAID', balance: 0 });
  console.log('Formularios web: reporte con PDF, visor privado, confirmación ADMIN y factura pagada: OK');
}

async function accountNotice(path, token) {
  const dom = new JSDOM(await webPage(path, token));
  try {
    return dom.window.document.querySelector('.accountPage [role="status"]')?.textContent ?? null;
  } finally { dom.window.close(); }
}

function findForm(html, name, value) {
  const dom = new JSDOM(html);
  try {
    const form = [...dom.window.document.forms].find(form => form.querySelector(`input[name="${name}"]`)?.value === value);
    assert.ok(form, `Falta el formulario ${name}`);
    const data = new FormData();
    for (const input of form.querySelectorAll('input[type="hidden"][name]')) data.append(input.name, input.value);
    return data;
  } finally { dom.window.close(); }
}

function receiptPdf(label) {
  return syntheticPdf(label, 'COMPROBANTE SINTETICO CI - NO ES UN PAGO REAL');
}

function formWithReceipt(fields, pdf) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  form.set('receipt', new Blob([pdf], { type: 'application/pdf' }), 'comprobante-ci.pdf');
  return form;
}
async function login(email, password) { return api('/auth/login', { method: 'POST', json: { email, password } }); }
async function api(path, options = {}) {
  const response = await raw(path, options);
  assert.ok(response.ok, `${options.method ?? 'GET'} ${path}: HTTP ${response.status} ${await response.clone().text()}`);
  return response.json();
}
function raw(path, { method = 'GET', token, json, body } = {}) {
  const headers = new Headers();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (json !== undefined) headers.set('Content-Type', 'application/json');
  return fetch(`${apiBase.origin}/api${path}`, { method, headers, body: json === undefined ? body : JSON.stringify(json),
    redirect: 'manual', signal: AbortSignal.timeout(30000) });
}
async function expectStatus(path, options, expected) {
  const response = await raw(path, options);
  assert.equal(response.status, expected, `${path}: HTTP ${response.status}, esperado ${expected}`);
  await response.body?.cancel();
}
function web(path, { method = 'GET', token, body } = {}) {
  const headers = new Headers();
  if (token) headers.set('Cookie', `inmo_token=${token}`);
  if (method === 'POST') { headers.set('Origin', webBase.origin); headers.set('Referer', `${webBase.origin}${path}`); }
  return fetch(`${webBase.origin}${path}`, { method, headers, body, redirect: 'manual', signal: AbortSignal.timeout(30000) });
}
async function webPage(path, token) {
  const response = await web(path, { token });
  assert.equal(response.status, 200, `${path}: HTTP ${response.status}`);
  return response.text();
}
function required(name) { assert.ok(process.env[name]?.trim(), `Falta ${name}`); return process.env[name].trim(); }
