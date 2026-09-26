import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service.js';
import { UsersService } from '../users/users.service.js';
import type { LoginDto } from './dto/login.dto.js';
import type { RegisterDto } from './dto/register.dto.js';

const dummyPasswordHash = '$2b$12$ZltX8z1V2X/FIi81VKZFe.SBukURYrDSWlfkU.lGmqbqIiaPLgW3u';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const email = dto.email.toLowerCase().trim();
    if (await this.users.findByEmail(email)) {
      throw new ConflictException('El correo ya se encuentra registrado.');
    }
    const name = dto.name.trim();
    const phone = dto.phone?.trim() || undefined;
    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: { name, email, phone, passwordHash, role: 'USER' },
      });

      const existingTenant = await tx.tenant.findFirst({
        where: { email: { equals: email, mode: 'insensitive' }, userId: null },
        orderBy: { createdAt: 'asc' },
      });
      if (existingTenant) {
        await tx.tenant.update({
          where: { id: existingTenant.id },
          data: {
            userId: created.id,
            name,
            normalizedName: this.normalize(name),
            email,
            phone: phone ?? existingTenant.phone,
          },
        });
        await Promise.all([
          tx.lease.updateMany({ where: { tenantId: existingTenant.id }, data: { userId: created.id } }),
          tx.invoice.updateMany({ where: { tenantId: existingTenant.id }, data: { userId: created.id } }),
          tx.payment.updateMany({ where: { tenantId: existingTenant.id }, data: { userId: created.id } }),
        ]);
      } else {
        await tx.tenant.create({
          data: {
            userId: created.id,
            name,
            normalizedName: this.normalize(name),
            email,
            phone,
          },
        });
      }
      return created;
    });
    return this.issueToken(user);
  }

  async login(dto: LoginDto) {
    const user = await this.users.findByEmail(dto.email.toLowerCase().trim());
    const validPassword = await bcrypt.compare(dto.password, user?.passwordHash ?? dummyPasswordHash);
    if (!user?.passwordHash || !validPassword) {
      throw new UnauthorizedException('Correo o contraseña inválidos.');
    }
    return this.issueToken(user);
  }

  private normalize(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  private async issueToken(user: { id: string; email: string; name: string; role: 'ADMIN' | 'USER' }) {
    const payload = { sub: user.id, email: user.email, name: user.name, role: user.role };
    return {
      accessToken: await this.jwt.signAsync(payload),
      user: payload,
    };
  }
}
