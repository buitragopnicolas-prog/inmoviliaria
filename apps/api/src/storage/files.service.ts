import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from './storage.service.js';

type UploadPurpose = 'PROPERTY_IMAGE' | 'GENERIC' | 'LEASE_CONTRACT' | 'PAYMENT_RECEIPT';

@Injectable()
export class FilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  listAdmin() {
    return this.prisma.storedFile.findMany({
      where: { purpose: { not: 'LEASE_CONTRACT' } },
      include: { createdBy: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getPublicMetadata(id: string) {
    const file = await this.prisma.storedFile.findFirst({
      where: { id, purpose: { in: ['PROPERTY_IMAGE', 'GENERIC'] } },
      select: {
        id: true,
        originalName: true,
        mimeType: true,
        size: true,
        purpose: true,
        publicPath: true,
        createdAt: true,
      },
    });
    if (!file) throw new NotFoundException('Archivo no encontrado.');
    return { ...file, downloadPath: `${file.publicPath}?download=1` };
  }

  async uploadGeneric(files: Express.Multer.File[], createdById?: string, folder?: string) {
    return this.uploadMany(files, { createdById, purpose: 'GENERIC', folder: folder?.trim() });
  }

  async uploadPropertyImages(files: Express.Multer.File[], createdById?: string) {
    return this.uploadMany(files, { createdById, purpose: 'PROPERTY_IMAGE', folder: 'property-images' });
  }

  async uploadProperty360(file: Express.Multer.File, createdById?: string) {
    const [uploaded] = await this.uploadMany([file], { createdById, purpose: 'GENERIC', folder: 'property-360' });
    return uploaded ?? null;
  }

  async uploadLeaseContract(file: Express.Multer.File, createdById?: string) {
    const [uploaded] = await this.uploadMany([file], {
      createdById,
      purpose: 'LEASE_CONTRACT',
      folder: 'lease-contracts',
    });
    return uploaded ?? null;
  }

  async uploadPaymentReceipt(file: Express.Multer.File, createdById: string) {
    const [uploaded] = await this.uploadMany([file], {
      createdById,
      purpose: 'PAYMENT_RECEIPT',
      folder: 'payment-receipts',
    });
    return uploaded ?? null;
  }

  async removeStoredFile(file: { id: string; objectKey: string }): Promise<void> {
    await this.storage.removeObject(file.objectKey).catch(() => undefined);
    await this.prisma.storedFile.deleteMany({ where: { id: file.id } });
  }

  async removeStoredFiles(files: Array<{ id: string; objectKey: string }>): Promise<void> {
    if (files.length === 0) return;
    await Promise.allSettled(files.map((file) => this.storage.removeObject(file.objectKey)));
    await this.prisma.storedFile.deleteMany({ where: { id: { in: files.map((file) => file.id) } } });
  }

  async sendContent(id: string, response: Response, download = false, allowSensitive = false): Promise<void> {
    const file = await this.prisma.storedFile.findUnique({ where: { id } });
    if (!file || (['LEASE_CONTRACT', 'PAYMENT_RECEIPT'].includes(file.purpose) && !allowSensitive)) {
      throw new NotFoundException('Archivo no encontrado.');
    }
    const stream = await this.storage.getObjectStream(file.objectKey);
    response.setHeader('Content-Type', file.mimeType);
    response.setHeader('Content-Length', String(file.size));
    response.setHeader('Cache-Control', ['LEASE_CONTRACT', 'PAYMENT_RECEIPT'].includes(file.purpose) ? 'private, no-store' : 'public, max-age=31536000, immutable');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Content-Disposition', contentDisposition(file.originalName, download || file.purpose === 'GENERIC'));
    await pipeline(stream, response);
  }

  private async uploadMany(
    files: Express.Multer.File[],
    options: { createdById?: string; purpose: UploadPurpose; folder?: string },
  ) {
    if (files.length === 0) return [];
    const prefix = options.purpose === 'PROPERTY_IMAGE'
      ? 'property-images'
      : options.purpose === 'LEASE_CONTRACT'
        ? 'lease-contracts'
        : options.purpose === 'PAYMENT_RECEIPT'
          ? 'payment-receipts'
        : `files/${sanitizeFolder(options.folder)}`;
    const uploadedObjects: Array<{ bucket: string; objectKey: string; mimeType: string; originalName: string; size: number }> = [];
    try {
      for (const file of files) {
        uploadedObjects.push(await this.storage.upload(file, prefix));
      }
      const records = uploadedObjects.map((file) => {
        const id = randomUUID();
        return {
          id,
          bucket: file.bucket,
          objectKey: file.objectKey,
          originalName: file.originalName,
          mimeType: file.mimeType,
          size: file.size,
          purpose: options.purpose,
          publicPath: options.purpose === 'LEASE_CONTRACT'
            ? `/api/leases/contracts/${id}`
            : options.purpose === 'PAYMENT_RECEIPT'
              ? `/api/payments/receipts/${id}`
              : `/api/files/${id}/content`,
          createdById: options.createdById,
        };
      });
      return this.prisma.$transaction(records.map((record) => this.prisma.storedFile.create({ data: record })));
    } catch (error) {
      await Promise.allSettled(uploadedObjects.map((file) => this.storage.removeObject(file.objectKey)));
      throw error;
    }
  }
}

function contentDisposition(originalName: string, download: boolean): string {
  const sanitized = originalName.replace(/["\\]/g, '').replace(/[^\x20-\x7E]/g, '_') || 'archivo';
  const encoded = encodeURIComponent(originalName);
  return `${download ? 'attachment' : 'inline'}; filename="${sanitized}"; filename*=UTF-8''${encoded}`;
}

function sanitizeFolder(value?: string): string {
  if (!value) return 'generic';
  const normalized = value
    .split('/')
    .map((segment) => segment
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/(^-|-$)/g, ''))
    .filter(Boolean)
    .join('/');
  return normalized.length > 0 ? normalized : 'generic';
}
