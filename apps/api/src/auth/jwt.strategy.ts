import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { JwtUser } from '../common/decorators/current-user.decorator.js';
import { UsersService } from '../users/users.service.js';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly users: UsersService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET ?? 'insecure-development-secret-change-it',
    });
  }

  async validate(payload: JwtUser): Promise<JwtUser> {
    if (!payload?.sub) throw new UnauthorizedException('Sesión inválida.');
    const user = await this.users.findById(payload.sub);
    if (!user?.passwordHash) throw new UnauthorizedException('La cuenta ya no está disponible.');
    return { sub: user.id, email: user.email, name: user.name, role: user.role };
  }
}
