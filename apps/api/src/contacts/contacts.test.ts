import 'reflect-metadata';
import test from 'node:test';
import assert from 'node:assert/strict';
import { NotFoundException, ValidationPipe, type ExecutionContext } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants.js';
import { Reflector } from '@nestjs/core';
import { ContactsController } from './contacts.controller.js';
import { ContactsService } from './contacts.service.js';
import { UpdateContactStatusDto } from './dto/update-contact-status.dto.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { ROLES_KEY } from '../common/decorators/roles.decorator.js';
import type { PrismaService } from '../prisma/prisma.service.js';

test('sólo administradores autenticados pueden cambiar el estado de un contacto', () => {
  const handler = ContactsController.prototype.updateStatus;
  assert.deepEqual(Reflect.getMetadata(GUARDS_METADATA, handler), [JwtAuthGuard, RolesGuard]);
  assert.deepEqual(Reflect.getMetadata(ROLES_KEY, handler), ['ADMIN']);
  const guard = new RolesGuard(new Reflector());
  for (const [role, allowed] of [[undefined, false], ['USER', false], ['ADMIN', true]] as const) {
    const context = {
      getHandler: () => handler, getClass: () => ContactsController,
      switchToHttp: () => ({ getRequest: () => ({ user: role ? { role } : undefined }) }),
    } as unknown as ExecutionContext;
    assert.equal(guard.canActivate(context), allowed);
  }
});

test('cambio de estado rechaza valores desconocidos y campos adicionales', async () => {
  const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
  const metadata = { type: 'body' as const, metatype: UpdateContactStatusDto };
  for (const status of ['NEW', 'REVIEWED', 'CLOSED']) {
    assert.equal((await pipe.transform({ status }, metadata)).status, status);
  }
  for (const body of [{}, { status: 'ADMIN' }, { status: ['CLOSED'] }, { status: 'CLOSED', email: 'changed@example.test' }]) {
    await assert.rejects(() => pipe.transform(body, metadata));
  }
});

test('actualizar contacto sólo modifica su estado y un id inexistente devuelve 404', async () => {
  const calls: unknown[] = [];
  let count = 1;
  const prisma = { contactMessage: { updateMany: async (args: unknown) => { calls.push(args); return { count }; } } } as unknown as PrismaService;
  const service = new ContactsService(prisma);
  assert.deepEqual(await service.updateStatus('contact-1', 'REVIEWED'), { id: 'contact-1', status: 'REVIEWED' });
  assert.deepEqual(calls[0], { where: { id: 'contact-1' }, data: { status: 'REVIEWED' } });
  count = 0;
  await assert.rejects(() => service.updateStatus('missing', 'CLOSED'), NotFoundException);
});
