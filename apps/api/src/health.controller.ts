import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service.js';
import { StorageService } from './storage/storage.service.js';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService, private readonly storage: StorageService) {}

  @Get('live')
  live() {
    return { status: 'ok' };
  }

  @Get('ready')
  async ready() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      await this.storage.healthCheck();
      return { status: 'ok' };
    } catch {
      throw new ServiceUnavailableException('Required dependency unavailable');
    }
  }
}
