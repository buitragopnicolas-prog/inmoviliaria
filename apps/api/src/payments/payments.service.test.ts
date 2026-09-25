import test, { afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PaymentsService } from './payments.service.js';
import { ManualPaymentMethodDto } from './dto/report-manual-payment.dto.js';
import { ManualPaymentReviewDecision } from './dto/review-manual-payment.dto.js';

const originalEnvironment = { ...process.env };

beforeEach(() => {
  process.env.PAYMENT_MODE = 'manual';
  process.env.MANUAL_PAYMENT_BANK_NAME = 'Banco autorizado';
  process.env.MANUAL_PAYMENT_ACCOUNT_HOLDER = 'Titular autorizado';
  process.env.MANUAL_PAYMENT_ACCOUNT_TYPE = 'Ahorros';
  process.env.MANUAL_PAYMENT_ACCOUNT_DISPLAY = '****1234';
});

afterEach(() => {
  process.env = { ...originalEnvironment };
});

function fixture(overrides: Record<string, unknown> = {}) {
  let saved: Record<string, unknown> | null = null;
  const payment = {
    findUnique: async () => null,
    findFirst: async (args: { where?: { id?: string } }) => args.where?.id && saved ? saved : null,
    create: async ({ data }: { data: Record<string, unknown> }) => {
      saved = { id: 'payment-1', ...data };
      return saved;
    },
    update: async ({ data }: { data: Record<string, unknown> }) => ({ id: 'payment-1', ...data }),
    updateMany: async ({ data }: { data: Record<string, unknown> }) => { saved = { id: 'payment-1', ...saved, ...data }; return { count: 1 }; },
    findUniqueOrThrow: async () => saved ?? { id: 'payment-1' },
  };
  const tx = {
    payment,
    paymentAuditEvent: { create: async () => ({ id: 'audit-1' }) },
    invoice: { update: async () => ({ id: 'invoice-1' }) },
  };
  const prisma = {
    payment,
    $transaction: async (callback: (transaction: typeof tx) => unknown) => callback(tx),
    ...overrides,
  };
  const invoices = {
    findMine: async () => ({ id: 'invoice-1', code: 'FAC-1', status: 'PENDING', balance: 100_000, amount: 100_000, tenantId: 'tenant-1' }),
  };
  const files = {
    uploadPaymentReceipt: async () => ({ id: 'file-1', objectKey: 'receipt' }),
    removeStoredFile: async () => undefined,
    sendContent: async () => undefined,
  };
  return { service: new PaymentsService(prisma as never, invoices as never, files as never), prisma, invoices, files };
}

const report = { method: ManualPaymentMethodDto.BANK_TRANSFER, amount: 100_000, paidAt: '2026-09-25T10:00:00-05:00', bankReference: 'REF-123', idempotencyKey: 'idem-1234567890123456' };

test('crea un reporte manual pendiente y conserva la factura sin aprobar', async () => {
  const { service } = fixture();
  const result = await service.reportManual('invoice-1', 'user-1', report);
  assert.equal(result?.status, 'AWAITING_VERIFICATION');
  assert.equal(result?.amount, 100_000);
});

test('impide que el navegador modifique el saldo', async () => {
  const { service } = fixture();
  await assert.rejects(() => service.reportManual('invoice-1', 'user-1', { ...report, amount: 99_000 }), BadRequestException);
});

test('respeta la autorización de propiedad aplicada por facturas', async () => {
  const { service, invoices } = fixture();
  invoices.findMine = async () => { throw new NotFoundException('Factura no encontrada.'); };
  await assert.rejects(() => service.reportManual('invoice-otro', 'user-1', report), NotFoundException);
});

test('rechaza una referencia bancaria activa duplicada', async () => {
  const duplicatePayment = { findUnique: async () => null, findFirst: async () => ({ id: 'duplicate' }) };
  const { service } = fixture({ payment: duplicatePayment });
  await assert.rejects(() => service.reportManual('invoice-1', 'user-1', report), ConflictException);
});

test('rechaza comprobantes cuyo MIME no está autorizado', async () => {
  const { service } = fixture();
  const file = { mimetype: 'text/html', size: 100, originalname: 'falso.jpg', buffer: Buffer.from('x') } as Express.Multer.File;
  await assert.rejects(() => service.reportManual('invoice-1', 'user-1', report, file), BadRequestException);
});

test('confirma administrativamente y actualiza la factura dentro del valor permitido', async () => {
  const manual = { id: 'payment-1', provider: 'MANUAL', status: 'AWAITING_VERIFICATION', amount: 100_000, invoiceId: 'invoice-1', invoice: { amount: 100_000, payments: [] } };
  let invoiceUpdated = false;
  let reviewed = manual as Record<string, unknown>;
  const payment = {
    findFirst: async () => manual,
    updateMany: async ({ data }: { data: Record<string, unknown> }) => { reviewed = { ...manual, ...data }; return { count: 1 }; },
    findUniqueOrThrow: async () => reviewed,
  };
  const tx = { payment, paymentAuditEvent: { create: async () => ({}) }, invoice: { update: async () => { invoiceUpdated = true; return {}; } } };
  const { service } = fixture({ payment, $transaction: async (callback: (transaction: typeof tx) => unknown) => callback(tx) });
  const result = await service.reviewManual('payment-1', 'admin-1', { decision: ManualPaymentReviewDecision.CONFIRM });
  assert.equal(result.status, 'APPROVED');
  assert.equal(invoiceUpdated, true);
});

test('rechaza una segunda decisión concurrente sobre el mismo pago', async () => {
  const manual = { id: 'payment-1', provider: 'MANUAL', status: 'AWAITING_VERIFICATION', amount: 100_000, invoiceId: 'invoice-1', invoice: { amount: 100_000, payments: [] } };
  let auditCreated = false;
  const payment = {
    findFirst: async () => manual,
    updateMany: async () => ({ count: 0 }),
    findUniqueOrThrow: async () => manual,
  };
  const tx = {
    payment,
    paymentAuditEvent: { create: async () => { auditCreated = true; return {}; } },
    invoice: { update: async () => ({}) },
  };
  const { service } = fixture({ payment, $transaction: async (callback: (transaction: typeof tx) => unknown) => callback(tx) });
  await assert.rejects(() => service.reviewManual('payment-1', 'admin-2', { decision: ManualPaymentReviewDecision.CONFIRM }), ConflictException);
  assert.equal(auditCreated, false);
});

test('bloquea la aprobación mock en producción', async () => {
  process.env.PAYMENT_MODE = 'mock';
  process.env.NODE_ENV = 'production';
  const { service } = fixture();
  await assert.rejects(() => service.approveMock('ref', 'user-1'), ForbiddenException);
});
