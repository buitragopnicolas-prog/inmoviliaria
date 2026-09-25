import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service.js';
import { InvoicesService } from '../invoices/invoices.service.js';
import { FilesService } from '../storage/files.service.js';
import { publicManualPaymentConfig, resolveGateway, resolvePaymentMode } from './payment-config.js';
import type { ReportManualPaymentDto } from './dto/report-manual-payment.dto.js';
import type { ReviewManualPaymentDto } from './dto/review-manual-payment.dto.js';

interface WompiEvent {
  event?: string;
  data?: { transaction?: Record<string, unknown> } & Record<string, unknown>;
  signature?: { properties?: string[]; checksum?: string };
  timestamp?: number;
}

const receiptMimeTypes = new Set(['image/jpeg', 'image/png', 'application/pdf']);
const pendingManualStatuses = ['AWAITING_VERIFICATION', 'UNDER_REVIEW'] as const;

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly invoices: InvoicesService,
    private readonly files: FilesService,
  ) {}

  manualConfig() {
    return publicManualPaymentConfig();
  }

  async createIntent(invoiceId: string, userId: string) {
    const invoice = await this.invoices.findMine(invoiceId, userId);
    this.assertPayable(invoice);
    const mode = resolvePaymentMode();
    if (mode === 'manual') throw new BadRequestException('Este entorno usa pagos manuales. Reporta el pago desde los medios disponibles.');
    if (mode === 'mock' && process.env.NODE_ENV === 'production') throw new ForbiddenException('Los pagos simulados están bloqueados en producción.');
    const gateway = mode === 'mock' ? 'mock' : resolveGateway();
    const provider = gateway === 'wompi' ? 'WOMPI' : gateway === 'cybervestigio' ? 'CYBERVESTIGIO' : gateway === 'mock' ? 'MOCK' : null;
    if (!provider) throw new BadRequestException('No hay una pasarela de pago configurada.');
    const reference = `INV-${invoice.code}-${randomUUID().slice(0, 8)}`;
    let checkoutUrl: string | null = null;
    if (provider === 'WOMPI') checkoutUrl = this.buildWompiCheckout(reference, invoice.balance);
    if (provider === 'CYBERVESTIGIO') checkoutUrl = this.buildCybervestigioCheckout(reference, invoice.balance, invoice.code);
    const payment = await this.prisma.payment.create({
      data: { reference, amount: invoice.balance, invoiceId, userId, tenantId: invoice.tenantId, provider, status: 'PENDING', checkoutUrl },
    });
    return { payment, provider, checkoutUrl };
  }

  async reportManual(invoiceId: string, userId: string, input: ReportManualPaymentDto, receipt?: Express.Multer.File) {
    if (resolvePaymentMode() !== 'manual') throw new ForbiddenException('Los pagos manuales no están habilitados en este entorno.');
    const invoice = await this.invoices.findMine(invoiceId, userId);
    this.assertPayable(invoice);
    const method = publicManualPaymentConfig().methods.find((item) => item.code === input.method);
    if (!method?.enabled) throw new BadRequestException('El medio de pago seleccionado no está configurado.');
    if (input.amount !== invoice.balance) throw new BadRequestException('El valor reportado debe coincidir con el saldo actual de la factura.');
    const paidAt = new Date(input.paidAt);
    if (paidAt.getTime() > Date.now() + 5 * 60_000) throw new BadRequestException('La fecha del pago no puede estar en el futuro.');
    const bankReference = input.bankReference.trim();
    const existingByKey = await this.prisma.payment.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
    if (existingByKey) {
      if (existingByKey.userId !== userId || existingByKey.invoiceId !== invoiceId) throw new ConflictException('La solicitud ya fue utilizada.');
      return this.findManualForUser(existingByKey.id, userId);
    }
    const duplicate = await this.prisma.payment.findFirst({
      where: { provider: 'MANUAL', bankReference: { equals: bankReference, mode: 'insensitive' }, status: { notIn: ['REJECTED', 'CANCELLED', 'VOIDED'] } },
    });
    if (duplicate) throw new ConflictException('La referencia de pago ya fue reportada.');
    const activeReport = await this.prisma.payment.findFirst({
      where: { invoiceId, userId, provider: 'MANUAL', status: { in: [...pendingManualStatuses] } },
    });
    if (activeReport) return this.findManualForUser(activeReport.id, userId);
    this.validateReceipt(receipt);

    const storedReceipt = receipt ? await this.files.uploadPaymentReceipt(receipt, userId) : null;
    try {
      const payment = await this.prisma.$transaction(async (tx) => {
        const created = await tx.payment.create({
          data: {
            reference: `MAN-${invoice.code}-${randomUUID().slice(0, 10).toUpperCase()}`,
            amount: invoice.balance,
            provider: 'MANUAL', status: 'AWAITING_VERIFICATION', manualMethod: input.method,
            bankReference, idempotencyKey: input.idempotencyKey, paidAt, reportedAt: new Date(),
            receiptFileId: storedReceipt?.id, invoiceId, tenantId: invoice.tenantId, userId,
          },
        });
        await tx.paymentAuditEvent.create({
          data: { paymentId: created.id, actorId: userId, toStatus: 'AWAITING_VERIFICATION', note: 'Pago manual reportado por el usuario.' },
        });
        return created;
      });
      return this.findManualForUser(payment.id, userId);
    } catch (error) {
      if (storedReceipt) await this.files.removeStoredFile(storedReceipt).catch(() => undefined);
      throw error;
    }
  }

  listManualPending() {
    return this.prisma.payment.findMany({
      where: { provider: 'MANUAL', status: { in: [...pendingManualStatuses] } },
      include: {
        user: { select: { id: true, name: true, email: true } },
        tenant: { select: { id: true, name: true } },
        invoice: { include: { lease: { include: { property: { select: { id: true, title: true, address: true } } } } } },
        receiptFile: { select: { id: true, originalName: true, mimeType: true, size: true } },
        reviewedBy: { select: { id: true, name: true } },
        auditEvents: { include: { actor: { select: { name: true } } }, orderBy: { createdAt: 'asc' } },
      },
      orderBy: { reportedAt: 'asc' },
    });
  }

  async reviewManual(paymentId: string, adminId: string, input: ReviewManualPaymentDto) {
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, provider: 'MANUAL' },
      include: { invoice: { include: { payments: { select: { id: true, amount: true, status: true } } } } },
    });
    if (!payment) throw new NotFoundException('Reporte de pago no encontrado.');
    if (!pendingManualStatuses.includes(payment.status as (typeof pendingManualStatuses)[number])) throw new ConflictException('Este reporte ya tiene una decisión definitiva.');
    const nextStatus = input.decision === 'CONFIRM' ? 'APPROVED' : input.decision === 'REJECT' ? 'REJECTED' : 'UNDER_REVIEW';
    if (input.decision !== 'CONFIRM' && !input.note?.trim()) throw new BadRequestException('Indica el motivo de la decisión.');
    if (input.decision === 'CONFIRM') {
      const alreadyApproved = payment.invoice.payments.filter((item) => item.id !== payment.id && item.status === 'APPROVED').reduce((sum, item) => sum + item.amount, 0);
      if (alreadyApproved + payment.amount > payment.invoice.amount) throw new ConflictException('La confirmación excedería el valor de la factura. Revisa los pagos existentes.');
    }
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.payment.update({
        where: { id: payment.id },
        data: { status: nextStatus, reviewedById: adminId, reviewedAt: new Date(), reviewNote: input.note?.trim() || null },
      });
      await tx.paymentAuditEvent.create({
        data: { paymentId: payment.id, actorId: adminId, fromStatus: payment.status, toStatus: nextStatus, note: input.note?.trim() || 'Pago confirmado por administración.' },
      });
      if (nextStatus === 'APPROVED') {
        const approvedTotal = payment.invoice.payments.filter((item) => item.id !== payment.id && item.status === 'APPROVED').reduce((sum, item) => sum + item.amount, 0) + payment.amount;
        if (approvedTotal >= payment.invoice.amount) await tx.invoice.update({ where: { id: payment.invoiceId }, data: { status: 'PAID', paidAt: new Date() } });
      }
      return updated;
    });
  }

  async sendReceipt(fileId: string, viewer: { sub: string; role: 'ADMIN' | 'USER' }, response: Response) {
    const payment = await this.prisma.payment.findFirst({ where: { receiptFileId: fileId }, select: { userId: true } });
    if (!payment || (viewer.role !== 'ADMIN' && payment.userId !== viewer.sub)) throw new NotFoundException('Comprobante no encontrado.');
    await this.files.sendContent(fileId, response, false, true);
  }

  async approveMock(reference: string, userId: string) {
    if (resolvePaymentMode() !== 'mock' || process.env.NODE_ENV === 'production') throw new ForbiddenException('La aprobación simulada solo está habilitada en modo mock local.');
    const payment = await this.prisma.payment.findFirst({ where: { reference, userId, provider: 'MOCK' } });
    if (!payment) throw new NotFoundException('Pago no encontrado.');
    return this.prisma.$transaction(async (tx) => {
      const approved = await tx.payment.update({ where: { id: payment.id }, data: { status: 'APPROVED' } });
      await tx.invoice.update({ where: { id: payment.invoiceId }, data: { status: 'PAID', paidAt: new Date() } });
      return approved;
    });
  }

  async processWompiEvent(event: WompiEvent, headerChecksum?: string) {
    const secret = process.env.WOMPI_EVENTS_SECRET;
    if (!secret) throw new BadRequestException('WOMPI_EVENTS_SECRET no está configurado.');
    const checksum = headerChecksum ?? event.signature?.checksum;
    const properties = event.signature?.properties ?? [];
    if (!checksum || !event.data || !event.timestamp || properties.length === 0) throw new BadRequestException('Evento Wompi incompleto.');
    const values = properties.map((property) => String(this.readPath(event.data!, property) ?? '')).join('');
    const calculated = createHash('sha256').update(`${values}${event.timestamp}${secret}`).digest('hex');
    const received = checksum.toLowerCase();
    if (calculated.length !== received.length || !timingSafeEqual(Buffer.from(calculated), Buffer.from(received))) throw new BadRequestException('Firma de evento Wompi inválida.');
    if (event.event !== 'transaction.updated') return { received: true, ignored: true };
    const transaction = event.data.transaction ?? {};
    const reference = String(transaction.reference ?? '');
    const externalStatus = String(transaction.status ?? 'ERROR').toUpperCase();
    const payment = await this.prisma.payment.findUnique({ where: { reference } });
    if (!payment) return { received: true, ignored: true };
    const status = ['APPROVED', 'DECLINED', 'ERROR', 'VOIDED'].includes(externalStatus) ? externalStatus as 'APPROVED' | 'DECLINED' | 'ERROR' | 'VOIDED' : 'PENDING';
    await this.prisma.$transaction(async (tx) => {
      await tx.payment.update({ where: { id: payment.id }, data: { status, externalId: String(transaction.id ?? '') || null } });
      if (status === 'APPROVED') await tx.invoice.update({ where: { id: payment.invoiceId }, data: { status: 'PAID', paidAt: new Date() } });
    });
    return { received: true };
  }

  private findManualForUser(id: string, userId: string) {
    return this.prisma.payment.findFirst({
      where: { id, userId, provider: 'MANUAL' },
      select: { id: true, reference: true, amount: true, status: true, manualMethod: true, bankReference: true, paidAt: true, reportedAt: true, reviewNote: true, receiptFileId: true },
    });
  }

  private assertPayable(invoice: { status: string; balance: number }) {
    if (invoice.status === 'PAID' || invoice.status === 'VOID' || invoice.balance <= 0) throw new BadRequestException('Esta factura no tiene saldo pendiente para pagar.');
  }

  private validateReceipt(file?: Express.Multer.File) {
    if (!file) return;
    const maxSize = Number(process.env.PAYMENT_RECEIPT_MAX_FILE_SIZE ?? 8_000_000);
    if (!receiptMimeTypes.has(file.mimetype.toLowerCase()) || file.size > maxSize) throw new BadRequestException('El comprobante debe ser JPG, PNG o PDF y no superar el límite configurado.');
  }

  private buildWompiCheckout(reference: string, amountInPesos: number): string {
    const publicKey = process.env.WOMPI_PUBLIC_KEY;
    const integritySecret = process.env.WOMPI_INTEGRITY_SECRET;
    const redirectUrl = process.env.WOMPI_REDIRECT_URL ?? 'http://localhost:3000/mi-cuenta';
    if (!publicKey || !integritySecret) throw new BadRequestException('Configure las llaves de Wompi.');
    const amountInCents = amountInPesos * 100;
    const signature = createHash('sha256').update(`${reference}${amountInCents}COP${integritySecret}`).digest('hex');
    const params = new URLSearchParams({ 'public-key': publicKey, currency: 'COP', 'amount-in-cents': String(amountInCents), reference, 'signature:integrity': signature, 'redirect-url': redirectUrl });
    return `https://checkout.wompi.co/p/?${params.toString()}`;
  }

  private buildCybervestigioCheckout(reference: string, amountInPesos: number, invoiceCode: string): string {
    const baseUrl = process.env.CYBERVESTIGIO_CHECKOUT_URL ?? 'https://cybervestigio.com/pagos';
    const returnUrl = process.env.CYBERVESTIGIO_RETURN_URL ?? process.env.WEB_ORIGIN ?? 'http://localhost:3000/mi-cuenta';
    const checkoutUrl = new URL(baseUrl);
    checkoutUrl.searchParams.set('reference', reference);
    checkoutUrl.searchParams.set('amount', String(amountInPesos));
    checkoutUrl.searchParams.set('currency', 'COP');
    checkoutUrl.searchParams.set('description', `Pago factura ${invoiceCode}`);
    checkoutUrl.searchParams.set('returnUrl', returnUrl);
    return checkoutUrl.toString();
  }

  private readPath(source: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce<unknown>((value, key) => typeof value === 'object' && value !== null ? (value as Record<string, unknown>)[key] : undefined, source);
  }
}
