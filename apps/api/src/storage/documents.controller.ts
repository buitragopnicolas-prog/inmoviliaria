import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Post, Query, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser, type JwtUser } from '../common/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { FilesService } from './files.service.js';

const pdfFields = { serviceType:true, id: true, originalName: true, size: true, createdAt: true } as const;
const singlePdf = FileInterceptor('file', { defParamCharset: 'utf8', limits: { fileSize: 8_000_000, files: 1 } });

@Controller()
export class DocumentsController {
  constructor(private readonly prisma: PrismaService, private readonly files: FilesService) {}

  @Get('documents/templates')
  templates() {
    return this.prisma.rentalTemplate.findMany({ select: { key: true, file: { select: pdfFields } }, orderBy: { key: 'asc' } });
  }

  @Get('documents/public/:id')
  async publicPdf(@Param('id') id: string, @Query('download') download: string, @Res() res: Response) {
    const file = await this.prisma.storedFile.findFirst({
      where: { id, purpose: 'MANAGED_PDF', recipientId: null, scanStatus: 'CLEAN',
        OR: [{ rentalTemplate: { isNot: null } }, { newsPost: { published: true } }] },
      select: { id: true },
    });
    if (!file) throw new NotFoundException('Documento no disponible.');
    return this.files.sendContent(file.id, res, download === '1', true);
  }

  @Get('documents/mine')
  @UseGuards(JwtAuthGuard)
  mine(@CurrentUser() user: JwtUser) {
    return this.listForUser(user.sub);
  }

  @Get('documents/private/:id')
  @UseGuards(JwtAuthGuard)
  async privatePdf(@Param('id') id: string, @CurrentUser() user: JwtUser, @Query('download') download: string, @Res() res: Response) {
    const file = await this.prisma.storedFile.findFirst({ where: { id, purpose: 'MANAGED_PDF', scanStatus: 'CLEAN',
      ...(user.role === 'ADMIN' ? {} : { recipientId: user.sub }) }, select: { id: true } });
    if (!file) throw new NotFoundException('Documento no disponible.');
    return this.files.sendContent(file.id, res, download === '1', true);
  }

  @Get('admin/documents/accounts')
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles('ADMIN')
  accounts() {
    return this.prisma.user.findMany({ where: {role:'USER',passwordHash:{not:null}},
      select: {id:true, name:true, email:true, portal:true}, orderBy:[{name:'asc'},{id:'asc'}] });
  }

  @Get('admin/documents/accounts/:id')
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles('ADMIN')
  accountFiles(@Param('id') id: string) { return this.listForUser(id); }

  private listForUser(recipientId: string) {
    return this.prisma.storedFile.findMany({ where: { recipientId, purpose: 'MANAGED_PDF', scanStatus: 'CLEAN' },
      select: pdfFields, orderBy: { createdAt: 'desc' } });
  }

  @Post('admin/documents/accounts/:id')
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles('ADMIN')
  @UseInterceptors(singlePdf)
  async assign(@Body('serviceType') type:unknown, @Param('id') id: string, @UploadedFile() file: Express.Multer.File, @CurrentUser() user: JwtUser) {
    const account = await this.prisma.user.findFirst({where:{id,role:'USER',passwordHash:{not:null}},select:{id:true,portal:true}});
    if (!account) throw new NotFoundException('No se encontró la cuenta de cliente.');
    if (!file) throw new BadRequestException('Selecciona un PDF.');
    const serviceType=typeof type==='string' ? type.trim() : '';
    if (serviceType.length>150 || (account.portal==='SERVICES' && !serviceType)) throw new BadRequestException('Indica el tipo de servicio del contrato (hasta 150 caracteres).');
    const [stored] = await this.files.uploadManagedPdfs([file], user.sub);
    try {
      return await this.prisma.storedFile.update({ where: { id: stored.id }, data: {recipientId:id, serviceType:account.portal==='SERVICES' ? serviceType : null}, select: pdfFields });
    } catch(error) {
      await this.files.removeStoredFile(stored);
      throw error;
    }
  }

  @Post('admin/documents/templates/:key')
  @UseGuards(JwtAuthGuard, RolesGuard) @Roles('ADMIN')
  @UseInterceptors(singlePdf)
  async setTemplate(@Param('key') key: string, @UploadedFile() file: Express.Multer.File, @CurrentUser() user: JwtUser) {
    if (!['solicitud','contrato'].includes(key)) throw new BadRequestException('Formato desconocido.');
    if (!file) throw new BadRequestException('Selecciona un PDF.');
    const [stored] = await this.files.uploadManagedPdfs([file], user.sub);
    try {
      return await this.prisma.rentalTemplate.upsert({where:{key},create:{key,fileId:stored.id},update:{fileId:stored.id}});
    } catch(error) {
      await this.files.removeStoredFile(stored);
      throw error;
    }
  }
}
