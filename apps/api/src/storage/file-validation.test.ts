import test from 'node:test';
import assert from 'node:assert/strict';
import { BadRequestException } from '@nestjs/common';
import { validateUploadedFile } from './file-validation.js';

function file(originalname: string, mimetype: string, buffer: Buffer): Express.Multer.File {
  return { originalname, mimetype, buffer, size: buffer.length } as Express.Multer.File;
}

test('acepta firmas mínimas coherentes de JPG, PNG y PDF', () => {
  assert.doesNotThrow(() => validateUploadedFile(file('pago.jpg', 'image/jpeg', Buffer.from([0xff, 0xd8, 0xff, 0x00, 0xff, 0xd9])), ['jpeg'], 100, 'Archivo'));
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('dataIEND'), Buffer.alloc(8)]);
  assert.doesNotThrow(() => validateUploadedFile(file('pago.png', 'image/png', png), ['png'], 100, 'Archivo'));
  assert.doesNotThrow(() => validateUploadedFile(file('pago.pdf', 'application/pdf', Buffer.from('%PDF-1.4\n%%EOF')), ['pdf'], 100, 'Archivo'));
});

test('rechaza archivo vacío, MIME falso y doble extensión', () => {
  assert.throws(() => validateUploadedFile(file('vacio.pdf', 'application/pdf', Buffer.alloc(0)), ['pdf'], 100, 'Archivo'), BadRequestException);
  assert.throws(() => validateUploadedFile(file('ataque.jpg', 'image/jpeg', Buffer.from('<html>')), ['jpeg'], 100, 'Archivo'), BadRequestException);
  assert.throws(() => validateUploadedFile(file('comprobante.pdf.exe', 'application/pdf', Buffer.from('%PDF-1.4\n%%EOF')), ['pdf'], 100, 'Archivo'), BadRequestException);
});

test('rechaza nombres con path traversal y archivos demasiado grandes', () => {
  const pdf = Buffer.from('%PDF-1.4\n%%EOF');
  assert.throws(() => validateUploadedFile(file('../pago.pdf', 'application/pdf', pdf), ['pdf'], 100, 'Archivo'), BadRequestException);
  assert.throws(() => validateUploadedFile(file('pago.pdf', 'application/pdf', pdf), ['pdf'], 5, 'Archivo'), BadRequestException);
});
