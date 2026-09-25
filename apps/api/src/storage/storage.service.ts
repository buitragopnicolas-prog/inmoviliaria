import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { Client } from 'minio';

type UploadableFile = Pick<Express.Multer.File, 'buffer' | 'mimetype' | 'originalname' | 'size'>;

export interface StoredObjectUpload {
  bucket: string;
  objectKey: string;
  mimeType: string;
  originalName: string;
  size: number;
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly bucket = process.env.STORAGE_BUCKET ?? 'inmobiliaria-assets';
  private readonly region = process.env.STORAGE_REGION ?? 'us-east-1';
  private readonly autoCreateBucket = toBoolean(process.env.STORAGE_AUTO_CREATE_BUCKET ?? 'true');
  private readonly client = new Client({
    endPoint: process.env.STORAGE_ENDPOINT ?? 'localhost',
    port: Number(process.env.STORAGE_PORT ?? 9000),
    useSSL: toBoolean(process.env.STORAGE_USE_SSL ?? 'false'),
    accessKey: process.env.STORAGE_ACCESS_KEY ?? 'minioadmin',
    secretKey: process.env.STORAGE_SECRET_KEY ?? 'minioadmin',
    region: this.region,
  });

  private bucketReady?: Promise<void>;

  async upload(file: UploadableFile, prefix: string): Promise<StoredObjectUpload> {
    await this.ensureBucket();
    const objectKey = this.buildObjectKey(prefix, file.originalname);
    await this.client.putObject(this.bucket, objectKey, file.buffer, file.size, {
      'Content-Type': file.mimetype || 'application/octet-stream',
      'Cache-Control': 'public, max-age=31536000, immutable',
    });
    return {
      bucket: this.bucket,
      objectKey,
      mimeType: file.mimetype || 'application/octet-stream',
      originalName: file.originalname,
      size: file.size,
    };
  }

  async getObjectStream(objectKey: string) {
    return this.client.getObject(this.bucket, objectKey);
  }

  async removeObject(objectKey: string): Promise<void> {
    try {
      await this.client.removeObject(this.bucket, objectKey);
    } catch (error) {
      this.logger.warn(`No fue posible eliminar ${objectKey} del storage: ${messageOf(error)}`);
    }
  }

  async healthCheck(): Promise<void> {
    await this.ensureBucket();
    const exists = await this.client.bucketExists(this.bucket);
    if (!exists) throw new Error('Storage bucket unavailable');
  }

  private async ensureBucket(): Promise<void> {
    if (!this.bucketReady) {
      this.bucketReady = this.ensureBucketInternal().catch((error) => {
        this.bucketReady = undefined;
        throw error;
      });
    }
    await this.bucketReady;
  }

  private async ensureBucketInternal(): Promise<void> {
    const exists = await this.client.bucketExists(this.bucket);
    if (exists) return;
    if (!this.autoCreateBucket) {
      throw new Error(`El bucket ${this.bucket} no existe y STORAGE_AUTO_CREATE_BUCKET=false.`);
    }
    await this.client.makeBucket(this.bucket, this.region);
  }

  private buildObjectKey(prefix: string, originalName: string): string {
    const normalizedPrefix = normalizePrefix(prefix);
    const datePath = new Date().toISOString().slice(0, 10).replace(/-/g, '/');
    const extension = extname(originalName).toLowerCase();
    return `${normalizedPrefix}/${datePath}/${randomUUID()}${extension}`;
  }
}

function normalizePrefix(value: string): string {
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
  return normalized.length > 0 ? normalized : 'files';
}

function toBoolean(value: string): boolean {
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'error desconocido';
}
