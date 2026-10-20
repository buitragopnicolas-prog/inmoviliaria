// Production post-deploy probe. Credentials stay in memory; only synthetic evidence is emitted.
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import bcrypt from 'bcryptjs';
import { JSDOM } from 'jsdom';
import { Client } from 'minio';
import { PrismaPg } from '@prisma/adapter-pg';

const ci = process.argv.includes('--ci');
const failAfterReport = process.argv.includes('--ci-fail-after-report');
const recoveryIndex = process.argv.indexOf('--cleanup');
const recoveryRun = recoveryIndex < 0 ? null : process.argv[recoveryIndex + 1];
assert.ok(!failAfterReport || ci, 'La inyección de fallos solo está disponible en CI aislado.');
let base = 'https://asesoriainmobiliariajb.com';
if (ci) {
  assert.equal(process.env.CI, 'true');
  assert.equal(process.env.APP_ENV, 'development');
  for (const value of [process.env.E2E_WEB_URL, process.env.E2E_BASE_URL, process.env.DATABASE_URL]) {
    const url = new URL(value);
    assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname), 'CI solo admite loopback.');
    if (value !== process.env.DATABASE_URL) assert.equal(url.protocol, 'http:');
  }
  assert.equal(new URL(process.env.DATABASE_URL).pathname, '/inmobiliaria_ci');
  base = new URL(process.env.E2E_WEB_URL).origin;
  assert.equal(new URL(process.env.E2E_BASE_URL).origin + '/api', process.env.E2E_BASE_URL);
} else {
  assert.equal(process.env.APP_ENV, 'production');
  assert.equal(process.env.WEB_ORIGIN, base);
  assert.match(process.env.E2E_RELEASE_SHA ?? '', /^[a-f0-9]{40}$/);
}
assert.equal(process.env.PAYMENT_MODE, 'manual');
assert.equal(process.env.PAYMENT_GATEWAY, 'none');
assert.equal(process.env.ANTIMALWARE_ENABLED, 'true');
assert.equal(process.env.PUBLIC_REGISTRATION_ENABLED, 'false');
if (recoveryIndex >= 0) assert.match(recoveryRun ?? '', new RegExp(`^E2E-${ci ? 'CI' : 'PROD'}-[A-F0-9]{12}$`));
const { PrismaClient } = await import(pathToFileURL(resolve('apps/api/dist/generated/prisma/client.js')).href);
const run = recoveryRun ?? `E2E-${ci ? 'CI' : 'PROD'}-${randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`;
const ids = Object.fromEntries(['admin', 'customer', 'outsider', 'property', 'lease', 'invoice'].map(k => [k, `${run}-${k}`]));
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const report = { run, commit: process.env.E2E_RELEASE_SHA ?? 'isolated-ci', environment: ci ? 'ci' : 'production', startedAt: new Date().toISOString(), passed: false, cleanup: false };
const tables = ['payment', 'invoice', 'paymentAuditEvent', 'storedFile', 'user', 'tenant', 'lease', 'property'];
let baseline, created = false, at, ct, ot;
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
function event(stage, details = {}) { console.log(JSON.stringify({ stage, run, ...details })); }
async function snapshot() {
  const result = {};
  for (const table of tables) result[table] = Object.fromEntries((await db[table].findMany({ orderBy: { id: 'asc' } })).map(row => [row.id, hash(row)]));
  return result;
}
async function raw(path, { token, method = 'GET', json, body, web = false } = {}) {
  const headers = new Headers();
  if (token) headers.set(web ? 'Cookie' : 'Authorization', web ? `inmo_token=${token}` : `Bearer ${token}`);
  if (json !== undefined) headers.set('Content-Type', 'application/json');
  if (web && method === 'POST') { headers.set('Origin', base); headers.set('Referer', `${base}${path}`); }
  const origin = web ? base : ci ? new URL(process.env.E2E_BASE_URL).origin : base;
  return fetch(`${origin}${web ? '' : '/api'}${path}`, { method, headers, body: json === undefined ? body : JSON.stringify(json), redirect: 'manual', signal: AbortSignal.timeout(30000) });
}
async function api(path, options = {}) {
  const response = await raw(path, options);
  assert.ok(response.ok, `${options.method ?? 'GET'} ${path}: HTTP ${response.status}`);
  return response.json();
}
async function page(path, token) {
  const response = await raw(path, { token, web: true });
  assert.equal(response.status, 200, `Página ${path}`);
  return response.text();
}
function form(html, name, value) {
  const dom = new JSDOM(html);
  try {
    const target = [...dom.window.document.forms].find(f => f.querySelector(`input[name="${name}"]`)?.value === value);
    assert.ok(target, `Formulario ${name} ausente`);
    const body = new FormData();
    for (const input of target.querySelectorAll('input[type="hidden"][name]')) body.append(input.name, input.value);
    return body;
  } finally { dom.window.close(); }
}
function pdf() {
  const stream = `BT /F1 14 Tf 50 740 Td (PRUEBA SINTETICA - NO ES UN PAGO REAL) Tj 0 -30 Td (${run}) Tj ET`;
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`];
  let value = '%PDF-1.4\n';
  const offsets = [];
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(value)); value += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(value);
  value += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n` + offsets.map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
  return Buffer.from(`${value}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
}
async function cleanup() {
  const users = await db.user.findMany({ where: { id: { in: [ids.admin, ids.customer, ids.outsider] } } });
  if (users.length === 0) {
    // Fixture creation is transactional; an interrupted, uncommitted setup has nothing to retire.
    for (const [table, id] of [['invoice', ids.invoice], ['lease', ids.lease], ['property', ids.property]]) assert.equal(await db[table].count({ where: { id } }), 0);
    report.cleanup = true;
    return;
  }
  assert.ok(users.length >= 2 && users.length <= 3);
  assert.ok(users.every(u => u.email === `${run.toLowerCase()}-${Object.keys(ids).find(key => ids[key] === u.id)}@example.test`));
  const invoice = await db.invoice.findUniqueOrThrow({ where: { id: ids.invoice } });
  assert.equal(invoice.code, run);
  assert.equal(invoice.userId, ids.customer);
  assert.equal(invoice.leaseId, ids.lease);
  const lease = await db.lease.findUniqueOrThrow({ where: { id: ids.lease } });
  assert.equal(lease.propertyId, ids.property); assert.equal(lease.userId, ids.customer);
  assert.equal(lease.active, false);
  const property = await db.property.findUniqueOrThrow({ where: { id: ids.property } });
  assert.equal(property.published, false);
  assert.equal(property.createdById, ids.admin);
  const payments = await db.payment.findMany({ where: { invoiceId: ids.invoice } });
  assert.ok(payments.length <= 1 && payments.every(p => p.userId === ids.customer && p.provider === 'MANUAL' && p.bankReference === run));
  const files = await db.storedFile.findMany({ where: { createdById: ids.customer } });
  assert.ok(files.every(f => f.originalName === `${run}.pdf` && f.purpose === 'PAYMENT_RECEIPT' && /^(payment-receipts|quarantine)\//.test(f.objectKey)));
  const storage = new Client({ endPoint: process.env.STORAGE_ENDPOINT, port: Number(process.env.STORAGE_PORT ?? 9000), useSSL: ['true','1','yes','on'].includes(process.env.STORAGE_USE_SSL ?? 'false'), accessKey: process.env.STORAGE_ACCESS_KEY, secretKey: process.env.STORAGE_SECRET_KEY });
  // Never delete payments or mutate audit history. Preserve the actors, disable their credentials,
  // append a voiding event and archive the invoice. This also runs when the web flow fails.
  await db.$transaction(async tx => {
    const note = `${run}: cierre de prueba sintética; sin transferencia ni ingreso real. Auditoría preservada.`;
    for (const payment of payments) {
      if (payment.status !== 'VOIDED') {
        assert.equal((await tx.payment.updateMany({ where: { id: payment.id, invoiceId: ids.invoice, userId: ids.customer, bankReference: run, status: payment.status }, data: { status: 'VOIDED', reviewNote: note } })).count, 1);
        await tx.paymentAuditEvent.create({ data: { paymentId: payment.id, actorId: ids.admin, fromStatus: payment.status, toStatus: 'VOIDED', note } });
      }
    }
    await tx.invoice.update({ where: { id: ids.invoice }, data: { status: 'VOID', paidAt: null, deletedAt: new Date(), deletedReason: note } });
    assert.equal((await tx.user.updateMany({ where: { id: { in: [ids.admin, ids.customer] } }, data: { passwordHash: null, role: 'USER' } })).count, 2);
    await tx.user.deleteMany({ where: { id: ids.outsider } });
  });
  for (const file of files) {
    assert.equal(file.bucket, process.env.STORAGE_BUCKET ?? 'inmobiliaria-assets');
    await storage.removeObject(file.bucket, file.objectKey);
    await assert.rejects(storage.statObject(file.bucket, file.objectKey), error => ['NotFound', 'NoSuchKey', 'NoSuchObject'].includes(error.code));
    await db.$transaction(async tx => {
      await tx.payment.updateMany({ where: { invoiceId: ids.invoice, userId: ids.customer, receiptFileId: file.id }, data: { receiptFileId: null } });
      await tx.storedFile.delete({ where: { id: file.id } });
    });
  }
  const audit = await db.paymentAuditEvent.findMany({ where: { paymentId: { in: payments.map(p => p.id) } }, orderBy: { createdAt: 'asc' } });
  if (report.syntheticEvidence) {
    assert.equal(hash(audit.slice(0, 2)), hash(report.syntheticEvidence.audit));
    assert.equal(audit.length, 3);
  }
  assert.ok(audit.length === 0 || audit.at(-1).toStatus === 'VOIDED');
  assert.equal((await db.invoice.findUniqueOrThrow({ where: { id: ids.invoice } })).status, 'VOID');
  assert.equal(await db.storedFile.count({ where: { createdById: ids.customer } }), 0);
  report.cleanup = true;
  report.retiredSynthetic = { accountsDisabled: 2, unrelatedTestAccountRemoved: 1, invoiceArchived: true, paymentsVoided: payments.length, receiptsRemoved: files.length, immutableAuditPreserved: true };
  event('cleanup_verified', report.retiredSynthetic);
}

async function checkExistingRecords() {
  const after = await snapshot();
  // Compare every preexisting row; concurrent new customer records are allowed and never reverted.
  for (const table of tables) for (const [id, digest] of Object.entries(baseline[table])) {
    assert.equal(after[table][id], digest, `Un registro preexistente de ${table} cambió durante la prueba; requiere revisión, no se revierte.`);
  }
  report.existingRecordsUnchanged = true;
  report.existingRecordsChecked = report.baselineCounts;
  event('existing_records_unchanged', report.baselineCounts);
}

async function runFlow() {
  assert.equal((await api('/health/ready')).status, 'ok');
  // The normal invoice API refreshes overdue invoices globally. Abort if that could touch existing rows.
  const today = new Date(); today.setHours(0, 0, 0, 0);
  assert.equal(await db.invoice.count({ where: { status: 'PENDING', deletedAt: null, dueDate: { lt: today } } }), 0, 'Existen facturas que la consulta normal actualizaría; prueba detenida sin modificarlas.');
  baseline = await snapshot();
  report.baselineDigest = hash(baseline);
  report.baselineCounts = Object.fromEntries(tables.map(t => [t, Object.keys(baseline[t]).length]));
  event('probe_started', { ids });
  const password = `${randomUUID()}-Test!`;
  const passwordHash = await bcrypt.hash(password, 12);
  await db.$transaction(async tx => {
    for (const role of ['admin', 'customer', 'outsider']) await tx.user.create({ data: { id: ids[role], name: `PRUEBA TEMPORAL ${run} ${role}`, email: `${run.toLowerCase()}-${role}@example.test`, passwordHash, role: role === 'admin' ? 'ADMIN' : 'USER' } });
    await tx.property.create({ data: { id: ids.property, title: `PRUEBA SIN PUBLICAR ${run}`, slug: run.toLowerCase(), address: 'DIRECCION SINTETICA - SIN INMUEBLE REAL', features: [], published: false, status: 'ARCHIVED', createdById: ids.admin } });
    await tx.lease.create({ data: { id: ids.lease, propertyId: ids.property, userId: ids.customer, active: false, status: 'ENDED', observations: `${run}: contrato sintético temporal, sin obligación real.` } });
    await tx.invoice.create({ data: { id: ids.invoice, code: run, period: new Date(), dueDate: new Date(Date.now() + 7 * 86400000), amount: 100, leaseId: ids.lease, userId: ids.customer, adminNotes: `${run}: factura sintética temporal, NO corresponde a un cobro real.` } });
  });
  created = true;
  event('fixtures_created', { ids });
  const sessions = {};
  for (const role of ['admin', 'customer', 'outsider']) sessions[role] = await api('/auth/login', { method: 'POST', json: { email: `${run.toLowerCase()}-${role}@example.test`, password } });
  at = sessions.admin.accessToken; ct = sessions.customer.accessToken; ot = sessions.outsider.accessToken;
  assert.equal(sessions.admin.user.role, 'ADMIN');
  assert.equal(sessions.customer.user.role, 'USER');
  const config = await api('/payments/manual/config', { token: ct });
  assert.equal(config.mode, 'manual'); assert.equal(config.enabled, true);
  assert.ok(['QR','BREB','BANK_TRANSFER','BANK_DEPOSIT'].every(code => config.methods.find(m => m.code === code)?.enabled));
  const payPath = `/mi-cuenta/facturas/${ids.invoice}/pagar`;
  const body = form(await page(payPath, ct), 'invoiceId', ids.invoice);
  assert.equal(body.get('method'), 'QR');
  body.set('bankReference', run); body.set('paidAt', new Date(Date.now() - 60000).toISOString());
  const receipt = pdf(); body.set('receipt', new Blob([receipt], { type: 'application/pdf' }), `${run}.pdf`);
  assert.equal((await raw(payPath, { web: true, method: 'POST', token: ct, body })).status, 200);
  assert.match(await page(payPath, ct), /PENDIENTE DE VERIFICACIÓN/);
  const payment = (await api('/payments/manual/pending', { token: at })).find(p => p.invoiceId === ids.invoice);
  assert.ok(payment?.receiptFileId);
  assert.equal(payment.userId, ids.customer); assert.equal(payment.status, 'AWAITING_VERIFICATION');
  const stored = await db.storedFile.findUniqueOrThrow({ where: { id: payment.receiptFileId } });
  assert.equal(stored.scanStatus, 'CLEAN'); assert.equal(stored.scanEngine, 'ClamAV');
  const pending = await api(`/invoices/me/${ids.invoice}`, { token: ct });
  assert.equal(pending.balance, 100); assert.equal(pending.approvedAmount, 0);
  const duplicate = new FormData();
  for (const key of ['method', 'amount', 'idempotencyKey', 'bankReference', 'paidAt']) duplicate.set(key, body.get(key));
  duplicate.set('receipt', new Blob([receipt], { type: 'application/pdf' }), `${run}.pdf`);
  const dup = await api(`/payments/invoices/${ids.invoice}/manual-report`, { token: ct, method: 'POST', body: duplicate });
  assert.equal(dup.id, payment.id);
  for (const token of [ct, at]) {
    const response = await raw(`/documentos/pagos/${payment.receiptFileId}`, { web: true, token });
    assert.equal(response.status, 200); assert.match(response.headers.get('cache-control'), /private.*no-store/);
    assert.equal(response.headers.get('content-type'), 'application/pdf');
    assert.equal(hash(Buffer.from(await response.arrayBuffer())), hash(receipt));
  }
  assert.equal((await raw(`/documentos/pagos/${payment.receiptFileId}`, { web: true })).status, 401);
  assert.equal((await raw(`/documentos/pagos/${payment.receiptFileId}`, { web: true, token: ot })).status, 404);
  assert.equal((await raw(`/files/${payment.receiptFileId}/content`)).status, 404);
  assert.equal((await raw(`/payments/manual/${payment.id}/review`, { token: ct, method: 'PATCH', json: { decision: 'CONFIRM' } })).status, 403);
  report.reportForm = 'passed'; report.receiptPrivacy = 'passed'; report.antivirus = 'CLEAN'; report.idempotency = 'passed';
  event('report_receipt_permissions_verified', { invoice: ids.invoice, payment: payment.id });
  if (failAfterReport) throw new Error('Fallo controlado CI después del reporte.');
  const review = form(await page('/admin/conciliacion', at), 'paymentId', payment.id);
  assert.equal(review.get('paymentId'), payment.id);
  review.set('decision', 'CONFIRM'); review.set('note', `${run}: aprobación sintética autorizada; NO ES UN PAGO REAL; datos temporales.`);
  assert.equal((await raw('/admin/conciliacion', { token: at, web: true, method: 'POST', body: review })).status, 200);
  const after = await api(`/invoices/me/${ids.invoice}`, { token: ct });
  assert.equal(after.status, 'PAID'); assert.equal(after.balance, 0); assert.equal(after.approvedAmount, 100);
  const approved = await db.payment.findUniqueOrThrow({ where: { id: payment.id }, include: { auditEvents: { orderBy: { createdAt: 'asc' } } } });
  assert.equal(approved.status, 'APPROVED'); assert.equal(approved.reviewedById, ids.admin);
  assert.deepEqual(approved.auditEvents.map(e => [e.actorId, e.toStatus]), [[ids.customer, 'AWAITING_VERIFICATION'], [ids.admin, 'APPROVED']]);
  assert.equal((await raw(`/payments/manual/${payment.id}/review`, { token: at, method: 'PATCH', json: { decision: 'CONFIRM' } })).status, 409);
  assert.ok(!(await api('/payments/manual/pending', { token: at })).some(p => p.id === payment.id));
  assert.match(await page(payPath, ct), /Esta factura no tiene saldo pendiente/);
  report.adminForm = 'passed'; report.finalInvoiceStatus = after.status; report.finalBalance = after.balance;
  report.syntheticEvidence = { ids, payment: payment.id, receipt: payment.receiptFileId, receiptSha256: createHash('sha256').update(receipt).digest('hex'), audit: approved.auditEvents };
  report.flowPassed = true;
  event('approval_balance_audit_verified', { status: after.status, balance: after.balance });
}

try {
  if (recoveryRun) {
    await cleanup();
    event('recovery_complete', { cleanup: report.cleanup });
  } else {
    await runFlow();
  }
} catch (error) {
  report.error = error.message;
  event('test_failed', { error: error.message });
} finally {
  if (created) {
    try { await cleanup(); } catch (error) { report.cleanupError = error.message; }
    // Independently revoke access even if receipt removal or another cleanup assertion failed.
    try {
      await db.user.updateMany({ where: { id: { in: [ids.admin, ids.customer, ids.outsider] }, email: { in: ['admin','customer','outsider'].map(role => `${run.toLowerCase()}-${role}@example.test`) } }, data: { passwordHash: null, role: 'USER' } });
      for (const token of [ct, at, ot].filter(Boolean)) assert.equal((await raw('/auth/me', { token })).status, 401);
      report.temporarySessionsRevoked = true;
    } catch (error) { report.revocationError = error.message; }
  }
  if (baseline) {
    try { await checkExistingRecords(); } catch (error) { report.integrityError = error.message; }
  }
  report.passed = recoveryRun ? report.cleanup : !!(report.flowPassed && report.cleanup && report.existingRecordsUnchanged && report.temporarySessionsRevoked);
  await db.$disconnect();
  report.completedAt = new Date().toISOString();
  event('result', { report });
  if (ci && !recoveryRun) {
    await mkdir('coverage', { recursive: true });
    await writeFile(`coverage/production-payment-${failAfterReport ? 'cleanup-' : ''}e2e.json`, JSON.stringify(report, null, 2));
  }
}
if (!report.passed) process.exitCode = 1;
