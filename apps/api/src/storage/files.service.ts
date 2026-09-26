import { BadRequestException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service.js';
import { StorageService } from './storage.service.js';
import { AntimalwareService } from './antimalware.service.js';

type UploadPurpose = 'PROPERTY_IMAGE' | 'GENERIC' | 'LEASE_CONTRACT' | 'PAYMENT_RECEIPT';

@Injectable()
export class FilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly antimalware: AntimalwareService,
  ) {}

  listAdmin() {
    return this.prisma.storedFile.findMany({
      where: { purpose: { not: 'LEASE_CONTRACT' }, scanStatus: 'CLEAN' },
      include: { createdBy: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getPublicMetadata(id: string) {
    const file = await this.prisma.storedFile.findFirst({
      where: { id, purpose: { in: ['PROPERTY_IMAGE', 'GENERIC'] }, scanStatus: 'CLEAN' },
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
    if (!file || file.scanStatus !== 'CLEAN' || (['LEASE_CONTRACT', 'PAYMENT_RECEIPT'].includes(file.purpose) && !allowSensitive)) {
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
    const completed: Array<{ id: string; objectKey: string }> = [];
    try {
      const records = [];
      for (const file of files) {
        const id = randomUUID();
        const quarantined = await this.storage.upload(file, 'quarantine');
        try {
          await this.prisma.storedFile.create({ data: {
            id,
            bucket: quarantined.bucket,
            objectKey: quarantined.objectKey,
            originalName: quarantined.originalName,
            mimeType: quarantined.mimeType,
            size: quarantined.size,
            purpose: options.purpose,
            publicPath: options.purpose === 'LEASE_CONTRACT'
              ? `/api/leases/contracts/${id}`
              : options.purpose === 'PAYMENT_RECEIPT'
                ? `/api/payments/receipts/${id}`
                : `/api/files/${id}/content`,
            createdById: options.createdById,
            scanStatus: 'PENDING_SCAN',
          } });
        } catch (error) {
          await this.storage.removeObject(quarantined.objectKey);
          throw error;
        }
        try {
          const scan = await this.antimalware.scan(file.buffer);
          if (scan.status === 'INFECTED') {
            await this.prisma.storedFile.update({ where: { id }, data: {
              scanStatus: 'INFECTED', scanEngine: scan.engine, scanResult: scan.detail, scannedAt: new Date(),
            } });
            throw new InfectedFileError();
          }
          const stored = await this.storage.upload(file, prefix);
          await this.storage.removeObject(quarantined.objectKey);
          const record = await this.prisma.storedFile.update({ where: { id }, data: {
            objectKey: stored.objectKey,
            scanStatus: 'CLEAN', scanEngine: scan.engine, scanResult: scan.detail, scannedAt: new Date(),
          } });
          completed.push({ id, objectKey: stored.objectKey });
          records.push(record);
        } catch (error) {
          if (error instanceof InfectedFileError) throw error;
          await this.prisma.storedFile.updateMany({ where: { id }, data: {
            scanStatus: 'SCAN_FAILED', scanEngine: 'ClamAV', scanResult: safeScanFailure(error), scannedAt: new Date(),
          } });
          throw new ScanUnavailableError();
        }
      }
      return records;
    } catch (error) {
      await Promise.allSettled(completed.map((file) => this.storage.removeObject(file.objectKey)));
      if (completed.length > 0) await this.prisma.storedFile.deleteMany({ where: { id: { in: completed.map((file) => file.id) } } });
      if (error instanceof InfectedFileError) throw new BadRequestException('El archivo fue rechazado por el control de seguridad.');
      if (error instanceof ScanUnavailableError) throw new ServiceUnavailableException('No fue posible validar el archivo de forma segura. Intente nuevamente.');
      throw error;
    }
  }
}

class InfectedFileError extends Error {}
class ScanUnavailableError extends Error {}

function safeScanFailure(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Fallo desconocido';
  return message.slice(0, 500);
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
