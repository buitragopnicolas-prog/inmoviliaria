import { recordConsent } from '../common/privacy.js';
import { Injectable, NotFoundException } from '@nestjs/common';
import type { ContactStatus } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateContactDto } from './dto/create-contact.dto.js';

@Injectable()
export class ContactsService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateContactDto) {
    const { authorized, policyVersion, ...data } = dto;
    return this.prisma.$transaction(async tx => {
      const contact = await tx.contactMessage.create({data});
      await recordConsent(tx, {authorized, policyVersion}, 'contact', contact.id);
      return contact;
    });
  }

  list() {
    return this.prisma.contactMessage.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async updateStatus(id: string, status: ContactStatus) {
    const result = await this.prisma.contactMessage.updateMany({ where: { id }, data: { status } });
    if (!result.count) throw new NotFoundException('Solicitud de contacto no encontrada.');
    return { id, status };
  }
}
