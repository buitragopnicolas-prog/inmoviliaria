import { BadRequestException, Body, ConflictException, Controller, Get, NotFoundException, Param, Post, Put, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { IsInt, IsObject, Min } from 'class-validator';
import { readFileSync } from 'node:fs';
import { PrismaService } from '../prisma/prisma.service.js';
import { FilesService } from '../storage/files.service.js';
import { validateUploadedFile } from '../storage/file-validation.js';
import { CurrentUser, type JwtUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';

type Field = { label: string; kind: string; value: string };
const schema: Record<string, { fields: Record<string, Field> }> = JSON.parse(
  readFileSync(new URL('../../../../shared/site-fields.json', import.meta.url), 'utf8')
);
class SectionInput {
  @IsInt() @Min(0) revision!: number;
  @IsObject() values!: Record<string, string>;
}

function validLink(link: string) {
  if (!link || /[\\\s\u0000-\u001f]/u.test(link) || link.startsWith('//')) return false;
  if (link.startsWith('/')) return true;
  try { const url = new URL(link); return ['https:', 'http:', 'mailto:', 'tel:'].includes(url.protocol) && !url.username && !url.password; }
  catch { return false; }
}

function validateField(field: Field, value: unknown) {
  if (typeof value !== 'string' || value.length > (field.kind === 'long' ? 30000 : 4000)) return false;
  if (!value.trim()) return field.kind === 'optionalText' || field.kind === 'optionalLink' || field.kind === 'long' || field.kind === 'links';
  switch (field.kind) {
    case 'link': case 'optionalLink': return validLink(value);
    case 'links': return value.split(/\r?\n/).filter(line => line.trim()).every(line => {
      const [label, href, ...rest] = line.split('|'); return !!label?.trim() && !rest.length && validLink(href?.trim() || '');
    });
    case 'image': return /^\/(?:images\/[\w.-]+\.(?:webp|png|jpe?g)|fotos\/api\/files\/[\w-]+\/content)$/i.test(value);
    case 'email': return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    case 'phone': return /^[\d+() .-]{5,40}$/.test(value);
    default: return true;
  }
}
@Controller('site-content')
export class EditorialController {
  constructor(private readonly prisma: PrismaService) {}
  @Get() list() { return this.prisma.siteSection.findMany({ select: { id: true, revision: true, values: true } }); }
}

@Controller('admin/publishing')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class EditorialAdminController {
  constructor(private readonly prisma: PrismaService, private readonly files: FilesService) {}
  @Put('sections/:id')
  async save(@Param('id') id: string, @Body() body: SectionInput) {
    if (!Object.hasOwn(schema, id)) throw new NotFoundException('Sección desconocida.');
    const fields = schema[id].fields;
    const values: Record<string, string> = {};
    for (const [key, field] of Object.entries(fields)) {
      if (!validateField(field, body.values[key])) throw new BadRequestException('Revisa el campo «' + field.label + '».');
      values[key] = body.values[key].trim();
    }
    if (id==='contacto' && values.policyHref && !/^https?:\/\//i.test(values.policyHref) && !(values.policyHref==='/politica-de-datos' && values.policyText)) throw new BadRequestException('Usa la URL completa de la política o publica su texto en este sitio.');
    if (id==='servicios') {
      for (const key of ['legal','accounting','property','service4','service5','service6','service7','service8']) {
        if (values[key] && !values[key+'Text']) throw new BadRequestException('Añade la descripción de '+values[key]+'.');
        if (values[key]?.length>140) throw new BadRequestException('El nombre del servicio debe tener hasta 140 caracteres.');
      }
    }
    if (body.revision === 0) {
      const { count } = await this.prisma.siteSection.createMany({ data: [{ id, values }], skipDuplicates: true });
      if (count) return { revision: 1 };
    } else {
      const { count } = await this.prisma.siteSection.updateMany({ where: { id, revision: body.revision }, data: { values, revision: { increment: 1 } } });
      if (count) return { revision: body.revision + 1 };
    }
    throw new ConflictException('Otra persona actualizó esta sección. Recarga antes de guardar.');
  }

  @Post('images')
  @UseInterceptors(FilesInterceptor('photos', 10, { limits: { fileSize: 5000000 } }))
  async upload(@UploadedFiles() photos: Express.Multer.File[], @CurrentUser() user: JwtUser) {
    if (!photos?.length) throw new BadRequestException('Selecciona una fotografía.');
    for (const photo of photos) validateUploadedFile(photo, ['jpeg','png','webp'], 5000000, 'La fotografía');
    const stored = await this.files.uploadPropertyImages(photos, user.sub);
    return stored.map(file => file.publicPath);
  }
}
