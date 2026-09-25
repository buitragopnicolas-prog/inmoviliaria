import { BadRequestException } from '@nestjs/common';
import { extname } from 'node:path';

type AllowedKind = 'jpeg' | 'png' | 'webp' | 'pdf';

const mimeByKind: Record<AllowedKind, string> = {
  jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', pdf: 'application/pdf',
};

const extensionsByKind: Record<AllowedKind, string[]> = {
  jpeg: ['.jpg', '.jpeg'], png: ['.png'], webp: ['.webp'], pdf: ['.pdf'],
};

export function validateUploadedFile(file: Express.Multer.File, allowed: AllowedKind[], maxSize: number, label: string): void {
  if (!file.buffer?.length || file.size <= 0) throw new BadRequestException(`${label} está vacío.`);
  if (file.size > maxSize) throw new BadRequestException(`${label} supera el tamaño permitido.`);
  if (/[\\/\0]/.test(file.originalname) || file.originalname.includes('..')) throw new BadRequestException(`${label} tiene un nombre no permitido.`);
  const extension = extname(file.originalname).toLowerCase();
  const kind = allowed.find((candidate) => mimeByKind[candidate] === file.mimetype.toLowerCase() && extensionsByKind[candidate].includes(extension));
  if (!kind || !hasSignature(file.buffer, kind)) throw new BadRequestException(`${label} no coincide con un formato permitido.`);
}

function hasSignature(buffer: Buffer, kind: AllowedKind): boolean {
  if (kind === 'jpeg') return buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff && buffer[buffer.length - 2] === 0xff && buffer[buffer.length - 1] === 0xd9;
  if (kind === 'png') return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) && buffer.subarray(-12, -8).toString('ascii') === 'IEND';
  if (kind === 'webp') return buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  if (kind === 'pdf') return buffer.subarray(0, 5).toString('ascii') === '%PDF-' && buffer.subarray(Math.max(0, buffer.length - 2048)).includes(Buffer.from('%%EOF'));
  return false;
}
