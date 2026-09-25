import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Response } from 'express';
import type { JwtUser } from '../common/decorators/current-user.decorator.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { FilesService } from '../storage/files.service.js';
import { validateUploadedFile } from '../storage/file-validation.js';

@Injectable()
export class LeasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly files: FilesService,
  ) {}

  listAdmin() {
    return this.prisma.lease.findMany({
      where: { active: true },
      include: {
        user: { select: { id: true, name: true, email: true } },
        tenant: { select: { id: true, name: true, email: true } },
        property: { select: { title: true, monthlyRent: true } },
        contractFile: { select: { id: true, originalName: true, mimeType: true, size: true, createdAt: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  listMine(userId: string) {
    return this.prisma.lease.findMany({
      where: {
        OR: [
          { userId },
          { tenant: { userId } },
        ],
      },
      include: {
        property: {
          select: {
            id: true,
            title: true,
            address: true,
            neighborhood: true,
            city: true,
            status: true,
          },
        },
        contractFile: {
          select: { id: true, originalName: true, mimeType: true, size: true, createdAt: true },
        },
      },
      orderBy: [{ active: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async uploadContract(leaseId: string, file: Express.Multer.File, createdById: string) {
    this.validatePdf(file);
    const lease = await this.prisma.lease.findUnique({
      where: { id: leaseId },
      include: { contractFile: { select: { id: true, objectKey: true } } },
    });
    if (!lease) throw new NotFoundException('Contrato no encontrado.');

    const uploaded = await this.files.uploadLeaseContract(file, createdById);
    if (!uploaded) throw new BadRequestException('No fue posible guardar el contrato.');

    const updated = await this.prisma.lease.update({
      where: { id: leaseId },
      data: { contractFileId: uploaded.id, contractUploadedAt: new Date() },
      include: {
        property: { select: { id: true, title: true } },
        tenant: { select: { id: true, name: true } },
        contractFile: { select: { id: true, originalName: true, mimeType: true, size: true, createdAt: true } },
      },
    }).catch(async (error: unknown) => {
      await this.files.removeStoredFile({ id: uploaded.id, objectKey: uploaded.objectKey });
      throw error;
    });
    if (lease.contractFile) await this.files.removeStoredFile(lease.contractFile).catch(() => undefined);
    return updated;
  }

  async removeContract(leaseId: string) {
    const lease = await this.prisma.lease.findUnique({
      where: { id: leaseId },
      include: { contractFile: { select: { id: true, objectKey: true } } },
    });
    if (!lease) throw new NotFoundException('Contrato no encontrado.');
    if (!lease.contractFile) return { id: leaseId, removed: false };

    await this.prisma.lease.update({
      where: { id: leaseId },
      data: { contractFileId: null, contractUploadedAt: null },
    });
    await this.files.removeStoredFile(lease.contractFile);
    return { id: leaseId, removed: true };
  }

  async sendContract(leaseId: string, user: JwtUser, response: Response, download: boolean) {
    const lease = await this.prisma.lease.findFirst({
      where: user.role === 'ADMIN'
        ? { id: leaseId }
        : {
            id: leaseId,
            OR: [
              { userId: user.sub },
              { tenant: { userId: user.sub } },
            ],
          },
      include: { contractFile: { select: { id: true } } },
    });
    if (!lease?.contractFile) throw new NotFoundException('El contrato firmado no está disponible.');
    await this.files.sendContent(lease.contractFile.id, response, download, true);
  }

  private validatePdf(file: Express.Multer.File): void {
    validateUploadedFile(file, ['pdf'], Number(process.env.CONTRACT_MAX_FILE_SIZE ?? 25_000_000), 'El contrato');
  }
}
