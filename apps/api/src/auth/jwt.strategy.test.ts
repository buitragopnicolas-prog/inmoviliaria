import test from 'node:test';
import assert from 'node:assert/strict';
import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy.js';
import type { UsersService } from '../users/users.service.js';

test('revalida identidad y rol con la base de datos', async () => {
  const users = {
    findById: async () => ({ id: 'user-1', email: 'actual@example.com', name: 'Nombre actual', role: 'USER', passwordHash: 'hash' }),
  } as unknown as UsersService;
  const strategy = new JwtStrategy(users);
  const current = await strategy.validate({ sub: 'user-1', email: 'anterior@example.com', name: 'Anterior', role: 'ADMIN' });
  assert.deepEqual(current, { sub: 'user-1', email: 'actual@example.com', name: 'Nombre actual', role: 'USER' });
});

test('rechaza cuentas eliminadas o sin contraseña activa', async () => {
  const users = { findById: async () => null } as unknown as UsersService;
  const strategy = new JwtStrategy(users);
  await assert.rejects(
    strategy.validate({ sub: 'missing', email: 'x@example.com', name: 'X', role: 'USER' }),
    UnauthorizedException,
  );
});
