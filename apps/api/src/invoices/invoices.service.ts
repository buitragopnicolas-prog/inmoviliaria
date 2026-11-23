import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateInvoiceDto, InvoiceLineItemInputDto } from './dto/create-invoice.dto.js';
import type { DeleteInvoiceDto } from './dto/delete-invoice.dto.js';
import type { UpdateInvoiceDto } from './dto/update-invoice.dto.js';

type BalancePayment = { amount: number; status: string };
type BalanceInvoice = {
  amount: number;
  status: string;
  deletedAt?: Date | null;
  payments: BalancePayment[];
};

@Injectable()
export class InvoicesService {
  constructor(private readonly prisma: PrismaService) {}

  listCatalog() {
    return Promise.all([
      this.prisma.chargeCatalogItem.findMany({
        where: { active: true, type: 'SERVICE' },
        orderBy: { name: 'asc' },
      }),
      this.prisma.chargeCatalogItem.findMany({
        where: { active: true, type: 'PRODUCT' },
        orderBy: { name: 'asc' },
      }),
    ]).then(([services, products]) => ({ services, products }));
  }

  async listMine(userId: string) {
    await this.refreshOverdueInvoices();
    const invoices = await this.prisma.invoice.findMany({
      where: { userId, deletedAt: null },
      include: {
        lineItems: {
          include: { catalogItem: { select: { code: true, name: true, type: true } } },
          orderBy: { createdAt: 'asc' },
        },
        lease: { include: { property: { select: { title: true, address: true } } } },
        payments: {
          select: { id: true, reference: true, amount: true, status: true, provider: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { dueDate: 'desc' },
    });
    return invoices.map((invoice) => this.withBalance(invoice));
  }

  async findMine(invoiceId: string, userId: string) {
    await this.refreshOverdueInvoices();
    const invoice = await this.prisma.invoice.findFirst({
      where: { id: invoiceId, userId, deletedAt: null },
      include: {
        lease: { include: { property: true } },
        payments: { orderBy: { createdAt: 'desc' } },
        lineItems: {
          include: { catalogItem: { select: { code: true, name: true, type: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!invoice) throw new NotFoundException('Factura no encontrada.');
    return this.withBalance(invoice);
  }

  async listAdmin() {
    await this.refreshOverdueInvoices();
    const invoices = await this.prisma.invoice.findMany({
      where: { deletedAt: null },
      include: {
        user: { select: { name: true, email: true } },
        tenant: { select: { id: true, name: true, email: true } },
        lease: { include: { property: { select: { title: true } } } },
        payments: {
          select: { id: true, reference: true, amount: true, status: true, provider: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        },
        lineItems: {
          include: { catalogItem: { select: { code: true, name: true, type: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { dueDate: 'desc' },
    });
    return invoices.map((invoice) => this.withBalance(invoice));
  }

  async create(dto: CreateInvoiceDto) {
    if (Boolean(dto.accountId) === Boolean(dto.leaseId)) throw new BadRequestException('Selecciona un contrato o una cuenta.');
    const lease = dto.leaseId ? await this.prisma.lease.findUnique({where:{id:dto.leaseId}}) : null;
    if (dto.leaseId && !lease) throw new NotFoundException('Contrato no encontrado.');
    const account = dto.accountId ? await this.prisma.user.findFirst({where:{id:dto.accountId,role:'USER',portal:{in:['OWNER','SERVICES']},passwordHash:{not:null}},select:{id:true}}) : null;
    if (dto.accountId && !account) throw new NotFoundException('Cuenta de facturación no encontrada.');

    const serviceItems = await this.prepareLineItems(dto.services, 'SERVICE');
    const productItems = await this.prepareLineItems(dto.products ?? [], 'PRODUCT');
    const lineItems = [...serviceItems, ...productItems];

    if (lineItems.length === 0) {
      throw new BadRequestException('Debe agregar al menos un servicio o producto para cobrar.');
    }

    const amount = lineItems.reduce((sum, item) => sum + item.total, 0);

    const invoice = await this.prisma.invoice.create({
      data: {
        code: `FAC-${new Date().getFullYear()}-${randomUUID().slice(0, 8).toUpperCase()}`,
        leaseId: lease?.id,
        userId: account?.id ?? lease?.userId,
        tenantId: lease?.tenantId,
        period: new Date(dto.period),
        dueDate: new Date(dto.dueDate),
        amount,
        lineItems: {
          create: lineItems.map((item) => ({
            catalogItemId: item.catalogItemId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: item.total,
          })),
        },
      },
      include: {
        payments: true,
        lineItems: {
          include: { catalogItem: { select: { code: true, name: true, type: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    return this.withBalance(invoice);
  }

  async update(id: string, dto: UpdateInvoiceDto) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, deletedAt: null },
      include: {
        payments: { select: { id: true, reference: true, provider: true, amount: true, status: true } },
      },
    });
    if (!invoice) throw new NotFoundException('Factura no encontrada.');
    if (dto.amount === undefined && dto.status === undefined && !dto.period && !dto.dueDate && dto.note === undefined) {
      throw new BadRequestException('No se recibieron cambios para la factura.');
    }

    const amount = dto.amount ?? invoice.amount;
    const status = dto.status ?? invoice.status;
    const paidAt = status === 'PAID' ? invoice.paidAt ?? new Date() : null;
    const manualReference = `MANUAL-ADMIN-${invoice.code}`;
    const externalApproved = invoice.payments
      .filter((payment) => payment.status === 'APPROVED' && payment.reference !== manualReference)
      .reduce((sum, payment) => sum + payment.amount, 0);
    const manualAmount = Math.max(amount - externalApproved, 0);

    await this.prisma.$transaction(async (tx) => {
      await tx.invoice.update({
        where: { id },
        data: {
          amount,
          status,
          paidAt,
          period: dto.period ? new Date(dto.period) : undefined,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
          adminNotes: dto.note === undefined ? undefined : this.optionalText(dto.note),
        },
      });

      if (status === 'PAID' && manualAmount > 0) {
        await tx.payment.upsert({
          where: { reference: manualReference },
          update: {
            amount: manualAmount,
            status: 'APPROVED',
            provider: 'MANUAL',
            invoiceId: invoice.id,
            tenantId: invoice.tenantId,
            userId: invoice.userId,
          },
          create: {
            reference: manualReference,
            amount: manualAmount,
            provider: 'MANUAL',
            status: 'APPROVED',
            invoiceId: invoice.id,
            tenantId: invoice.tenantId,
            userId: invoice.userId,
          },
        });
      } else {
        await tx.payment.updateMany({
          where: { reference: manualReference },
          data: { status: 'VOIDED' },
        });
      }
    });

    return this.findAdmin(id);
  }

  async remove(id: string, dto: DeleteInvoiceDto) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, code: true },
    });
    if (!invoice) throw new NotFoundException('Factura no encontrada.');

    const deletedReason = this.optionalText(dto.reason) ?? 'Eliminada desde el panel administrativo.';
    await this.prisma.$transaction([
      this.prisma.payment.updateMany({
        where: { invoiceId: id, status: { in: ['PENDING', 'DECLINED', 'ERROR'] } },
        data: { status: 'VOIDED' },
      }),
      this.prisma.invoice.update({
        where: { id },
        data: { status: 'VOID', paidAt: null, deletedAt: new Date(), deletedReason },
      }),
    ]);

    return { id: invoice.id, code: invoice.code, deleted: true };
  }

  private async findAdmin(id: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, deletedAt: null },
      include: {
        user: { select: { name: true, email: true } },
        tenant: { select: { id: true, name: true, email: true } },
        lease: { include: { property: { select: { title: true } } } },
        payments: {
          select: { id: true, reference: true, amount: true, status: true, provider: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        },
        lineItems: {
          include: { catalogItem: { select: { code: true, name: true, type: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!invoice) throw new NotFoundException('Factura no encontrada.');
    return this.withBalance(invoice);
  }

  private withBalance<T extends BalanceInvoice>(invoice: T): T & { balance: number; approvedAmount: number } {
    const approvedAmount = invoice.payments
      .filter((payment) => payment.status === 'APPROVED')
      .reduce((sum, payment) => sum + payment.amount, 0);
    const balance = invoice.deletedAt || invoice.status === 'VOID' || invoice.status === 'PAID'
      ? 0
      : Math.max(invoice.amount - approvedAmount, 0);
    return { ...invoice, approvedAmount, balance };
  }

  private async prepareLineItems(items: InvoiceLineItemInputDto[], expectedType: 'SERVICE' | 'PRODUCT') {
    if (items.length === 0) return [];

    const duplicated = new Set<string>();
    const uniqueIds = new Set<string>();
    for (const item of items) {
      if (uniqueIds.has(item.itemId)) duplicated.add(item.itemId);
      uniqueIds.add(item.itemId);
    }
    if (duplicated.size > 0) {
      throw new BadRequestException('No se permiten cobros repetidos en la misma sección. Ajuste las cantidades.');
    }

    const catalog = await this.prisma.chargeCatalogItem.findMany({
      where: { id: { in: [...uniqueIds] }, active: true, type: expectedType },
    });
    const catalogById = new Map(catalog.map((item) => [item.id, item]));

    return items.map((item) => {
      const catalogItem = catalogById.get(item.itemId);
      if (!catalogItem) {
        throw new BadRequestException(`Uno o más cobros de tipo ${expectedType} no existen o están inactivos.`);
      }
      return {
        catalogItemId: catalogItem.id,
        quantity: item.quantity,
        unitPrice: catalogItem.unitPrice,
        total: catalogItem.unitPrice * item.quantity,
      };
    });
  }

  private async refreshOverdueInvoices(): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    await this.prisma.invoice.updateMany({
      where: { status: 'PENDING', dueDate: { lt: today }, deletedAt: null },
      data: { status: 'OVERDUE' },
    });
  }

  private optionalText(value?: string): string | null {
    const text = value?.trim();
    return text ? text : null;
  }
}
