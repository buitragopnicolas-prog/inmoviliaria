import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AssignPropertyDto } from './dto/assign-property.dto.js';
import type { CreateAdminUserDto } from './dto/create-admin-user.dto.js';

type FinancialRecord = {
  amount: number;
  status: 'PENDING' | 'PAID' | 'OVERDUE' | 'VOID';
  deletedAt?: Date | null;
  payments?: Array<{ amount: number; status: string }>;
};

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  }

  findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async listAdmin(search?: string) {
    await this.refreshOverdueInvoices();
    const term = search?.trim();
    const tenants = await this.prisma.tenant.findMany({
      where: term
        ? {
            OR: [
              { name: { contains: term, mode: 'insensitive' } },
              { email: { contains: term, mode: 'insensitive' } },
              { documentNumber: { contains: term, mode: 'insensitive' } },
              { phone: { contains: term, mode: 'insensitive' } },
            ],
          }
        : undefined,
      include: {
        user: { select: { id: true, name: true, email: true, phone: true, role: true, createdAt: true } },
        leases: {
          where: { active: true },
          take: 1,
          orderBy: { createdAt: 'desc' },
          include: { property: { select: { id: true, title: true, address: true, status: true } } },
        },
        invoices: {
          where: { deletedAt: null },
          select: {
            amount: true,
            status: true,
            payments: { select: { amount: true, status: true } },
          },
        },
        _count: { select: { leases: true, invoices: { where: { deletedAt: null } }, payments: true } },
      },
      orderBy: { name: 'asc' },
    });

    return tenants.map((tenant) => ({
      id: tenant.id,
      name: tenant.name,
      email: tenant.email ?? tenant.user?.email ?? null,
      phone: tenant.phone ?? tenant.user?.phone ?? null,
      documentNumber: tenant.documentNumber,
      webAccount: tenant.user
        ? { id: tenant.user.id, email: tenant.user.email, role: tenant.user.role, createdAt: tenant.user.createdAt }
        : null,
      activeLease: tenant.leases[0] ?? null,
      counts: tenant._count,
      financial: this.financialSummary(tenant.invoices),
      createdAt: tenant.createdAt,
      updatedAt: tenant.updatedAt,
    }));
  }

  async findAdminDetail(id: string) {
    await this.refreshOverdueInvoices();
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            role: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        aliases: { orderBy: { createdAt: 'asc' } },
        leases: {
          orderBy: [{ active: 'desc' }, { createdAt: 'desc' }],
          include: {
            property: {
              select: {
                id: true,
                title: true,
                address: true,
                neighborhood: true,
                city: true,
                monthlyRent: true,
                status: true,
                images: { take: 1, orderBy: { sortOrder: 'asc' } },
              },
            },
            contractFile: {
              select: { id: true, originalName: true, mimeType: true, size: true, createdAt: true },
            },
            invoices: {
              where: { deletedAt: null },
              orderBy: { dueDate: 'desc' },
              include: {
                lineItems: {
                  include: { catalogItem: { select: { name: true, code: true, type: true } } },
                  orderBy: { createdAt: 'asc' },
                },
                payments: { orderBy: { createdAt: 'desc' } },
              },
            },
          },
        },
        invoices: {
          where: { deletedAt: null },
          orderBy: { dueDate: 'desc' },
          include: {
            lease: { include: { property: { select: { id: true, title: true, address: true } } } },
            lineItems: {
              include: { catalogItem: { select: { name: true, code: true, type: true } } },
              orderBy: { createdAt: 'asc' },
            },
            payments: { orderBy: { createdAt: 'desc' } },
          },
        },
        payments: {
          orderBy: { createdAt: 'desc' },
          include: {
            invoice: {
              include: { lease: { include: { property: { select: { id: true, title: true } } } } },
            },
          },
        },
      },
    });
    if (!tenant) throw new NotFoundException('Usuario no encontrado.');

    const invoices = tenant.invoices.map((invoice) => this.withInvoiceBalance(invoice));
    const leases = tenant.leases.map((lease) => ({
      ...lease,
      invoices: lease.invoices.map((invoice) => this.withInvoiceBalance(invoice)),
    }));
    return {
      ...tenant,
      leases,
      invoices,
      email: tenant.email ?? tenant.user?.email ?? null,
      phone: tenant.phone ?? tenant.user?.phone ?? null,
      financial: this.financialSummary(tenant.invoices),
    };
  }

  async createCustomer(dto: CreateAdminUserDto) {
    const name = dto.name.trim();
    const email = this.optionalText(dto.email)?.toLowerCase();
    const phone = this.optionalText(dto.phone);
    const documentNumber = this.optionalText(dto.documentNumber);
    const normalizedName = this.normalize(name);

    const duplicateConditions: Prisma.TenantWhereInput[] = [];
    if (email) duplicateConditions.push({ email: { equals: email, mode: 'insensitive' } });
    if (documentNumber) duplicateConditions.push({ documentNumber });
    if (duplicateConditions.length > 0) {
      const existing = await this.prisma.tenant.findFirst({ where: { OR: duplicateConditions } });
      if (existing) throw new ConflictException('Ya existe un usuario con ese correo o documento.');
    }

    const linkedUser = email
      ? await this.prisma.user.findUnique({
          where: { email },
          include: { tenantProfile: { select: { id: true } } },
        })
      : null;
    if (linkedUser && (linkedUser.role!=='USER' || linkedUser.portal!=='TENANT')) throw new ConflictException('Ese correo corresponde a otro perfil.');
    if (linkedUser?.tenantProfile) {
      throw new ConflictException('La cuenta web ya tiene un perfil de usuario asociado.');
    }

    return this.prisma.tenant.create({
      data: {
        name,
        normalizedName,
        email,
        phone,
        documentNumber,
        userId: linkedUser?.id,
        aliases: normalizedName
          ? { create: { alias: name, normalizedAlias: normalizedName } }
          : undefined,
      },
      include: { user: { select: { id: true, email: true, role: true } } },
    });
  }

  async assignProperty(tenantId: string, dto: AssignPropertyDto) {
    const [tenant, property] = await Promise.all([
      this.prisma.tenant.findUnique({ where: { id: tenantId } }),
      this.prisma.property.findUnique({
        where: { id: dto.propertyId },
        include: { leases: { where: { active: true }, take: 1, select: { id: true } } },
      }),
    ]);
    if (!tenant) throw new NotFoundException('Usuario no encontrado.');
    if (!property) throw new NotFoundException('Inmueble no encontrado.');
    if (property.status !== 'AVAILABLE' || property.leases.length > 0) {
      throw new BadRequestException('El inmueble ya está asignado o no se encuentra disponible.');
    }

    const expectedMonthlyPayment = dto.expectedMonthlyPayment ?? property.monthlyRent;
    const startDate = dto.leaseStartDate ? new Date(dto.leaseStartDate) : new Date();
    const endDate = dto.leaseEndDate ? new Date(dto.leaseEndDate) : null;
    if (endDate && endDate < startDate) {
      throw new BadRequestException('La fecha final no puede ser anterior a la fecha inicial.');
    }

    const lease = await this.prisma.$transaction(async (tx) => {
      const createdLease = await tx.lease.create({
        data: {
          propertyId: property.id,
          tenantId: tenant.id,
          userId: tenant.userId,
          startDate,
          endDate,
          active: true,
          status: 'ACTIVE',
          expectedMonthlyPayment,
        },
      });

      const normalizedTenantName = this.normalize(tenant.name);
      if (normalizedTenantName) {
        await tx.tenantAlias.upsert({
          where: { tenantId_normalizedAlias: { tenantId: tenant.id, normalizedAlias: normalizedTenantName } },
          update: { alias: tenant.name },
          create: { tenantId: tenant.id, alias: tenant.name, normalizedAlias: normalizedTenantName },
        });
        await tx.leasePayerAlias.upsert({
          where: { leaseId_normalizedAlias: { leaseId: createdLease.id, normalizedAlias: normalizedTenantName } },
          update: { alias: tenant.name },
          create: { leaseId: createdLease.id, alias: tenant.name, normalizedAlias: normalizedTenantName },
        });
      }

      const accounts = await tx.receivingBankAccount.findMany({
        where: { active: true },
        select: { id: true },
      });
      if (accounts.length > 0) {
        await tx.leaseReceivingAccount.createMany({
          data: accounts.map((account) => ({ leaseId: createdLease.id, accountId: account.id, active: true })),
          skipDuplicates: true,
        });
      }

      await tx.property.update({ where: { id: property.id }, data: { status: 'RENTED' } });

      if ((dto.createCurrentInvoice ?? true) && expectedMonthlyPayment > 0) {
        const period = this.currentPeriod();
        const dueDate = dto.invoiceDueDate ? new Date(dto.invoiceDueDate) : this.daysFromNow(5);
        const code = `CANON-${createdLease.id.slice(-8).toUpperCase()}-${period.toISOString().slice(0, 7)}`;
        await tx.invoice.upsert({
          where: { code },
          update: {
            amount: expectedMonthlyPayment,
            dueDate,
            leaseId: createdLease.id,
            tenantId: tenant.id,
            userId: tenant.userId,
          },
          create: {
            code,
            period,
            dueDate,
            amount: expectedMonthlyPayment,
            status: 'PENDING',
            leaseId: createdLease.id,
            tenantId: tenant.id,
            userId: tenant.userId,
          },
        });
      }

      return createdLease;
    });

    return this.findAdminDetail(tenantId).then((user) => ({ lease, user }));
  }

  private async refreshOverdueInvoices(): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    await this.prisma.invoice.updateMany({
      where: { status: 'PENDING', dueDate: { lt: today }, deletedAt: null },
      data: { status: 'OVERDUE' },
    });
  }

  private financialSummary(invoices: FinancialRecord[]) {
    const activeInvoices = invoices.filter((invoice) => !invoice.deletedAt && invoice.status !== 'VOID');
    const balanceOf = (invoice: FinancialRecord): number => {
      const approved = (invoice.payments ?? [])
        .filter((payment) => payment.status === 'APPROVED')
        .reduce((sum, payment) => sum + payment.amount, 0);
      return invoice.status === 'PAID' ? 0 : Math.max(invoice.amount - approved, 0);
    };
    const pendingAmount = activeInvoices
      .filter((invoice) => invoice.status === 'PENDING')
      .reduce((sum, invoice) => sum + balanceOf(invoice), 0);
    const overdueAmount = activeInvoices
      .filter((invoice) => invoice.status === 'OVERDUE')
      .reduce((sum, invoice) => sum + balanceOf(invoice), 0);
    const paidAmount = activeInvoices
      .filter((invoice) => invoice.status === 'PAID')
      .reduce((sum, invoice) => sum + invoice.amount, 0);
    const approvedPayments = activeInvoices
      .flatMap((invoice) => invoice.payments ?? [])
      .filter((payment) => payment.status === 'APPROVED')
      .reduce((sum, payment) => sum + payment.amount, 0);
    const outstandingAmount = pendingAmount + overdueAmount;
    const state = overdueAmount > 0
      ? 'OVERDUE'
      : pendingAmount > 0
        ? 'PENDING'
        : activeInvoices.length > 0
          ? 'PAID'
          : 'NO_CHARGES';

    return {
      state,
      outstandingAmount,
      pendingAmount,
      overdueAmount,
      paidAmount,
      approvedPayments,
      invoiceCount: activeInvoices.length,
    };
  }

  private withInvoiceBalance<T extends FinancialRecord>(invoice: T): T & { balance: number; approvedAmount: number } {
    const approvedAmount = (invoice.payments ?? [])
      .filter((payment) => payment.status === 'APPROVED')
      .reduce((sum, payment) => sum + payment.amount, 0);
    const balance = invoice.status === 'PAID' || invoice.status === 'VOID' || invoice.deletedAt
      ? 0
      : Math.max(invoice.amount - approvedAmount, 0);
    return { ...invoice, approvedAmount, balance };
  }

  private currentPeriod(): Date {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  }

  private daysFromNow(days: number): Date {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date;
  }

  private optionalText(value?: string): string | undefined {
    const normalized = value?.trim();
    return normalized ? normalized : undefined;
  }

  private normalize(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }
}
