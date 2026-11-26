import { BadRequestException, Body, ConflictException, Controller, Get, NotFoundException, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ArrayMaxSize, ArrayUnique, IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Length, Matches, MaxLength, Min } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { Roles } from '../common/decorators/roles.decorator.js';

import { LocationInput, locationFields } from '../common/property-location.js';

const catalogs = ['comprar', 'vehiculos-y-bienes'];
class OfferInput extends LocationInput {
  @IsOptional() @IsIn(['premium','new-project']) promotion?: string | null;
  @IsOptional() @Matches(/^[1-9]\d{0,13}$/) estimatedMonthlyRent?: string | null;
  @IsIn(catalogs) catalog!: string;
  @IsString() @Length(2,150) title!: string;
  @IsString() @Length(2,80) category!: string;
  @IsString() @MaxLength(100) city!: string;
  @IsString() @Length(5,12000) description!: string;
  @Matches(/^[1-9]\d{0,13}$/) price!: string;
  @IsBoolean() published!: boolean;
  @IsArray() @ArrayMaxSize(10) @ArrayUnique() @Matches(/^\/api\/files\/[\w-]+\/content$/, {each:true}) images!: string[];
  @IsOptional() @IsInt() @Min(1) revision?: number;
}

@Controller('sales')
export class SalesController {
  constructor(private readonly prisma: PrismaService) {}
  @Get(':catalog')
  list(@Param('catalog') catalog: string, @Query('q') q?: string, @Query('category') category?: string, @Query('city') city?: string) {
    if (catalog!=='market' && !catalogs.includes(catalog)) throw new NotFoundException();
    if ([q, category, city].some(v => v !== undefined && (typeof v !== 'string' || v.length > 150))) throw new BadRequestException('Filtro inválido.');
    const contains = (value: string) => ({ contains: value, mode: 'insensitive' as const });
    return this.prisma.saleOffer.findMany({ where: { ...(catalog!=='market' && {catalog}), published: true,
      ...(category && {category: contains(category)}), ...(city && catalog !== 'vehiculos-y-bienes' && {city: contains(city)}),
      ...(q && {OR: [{title: contains(q)}, {category: contains(q)}, {description: contains(q)}]}) },
      omit:{ownerAccountId:true}, orderBy: [{createdAt:'desc'},{id:'asc'}] });
  }
  @Get(':catalog/:id')
  async detail(@Param('catalog') catalog: string, @Param('id') id: string) {
    const offer = await this.prisma.saleOffer.findFirst({where:{id,catalog,published:true},omit:{ownerAccountId:true}});
    if (!offer) throw new NotFoundException('Oferta no disponible.');
    return offer;
  }
}

@Controller('admin/sales')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class SalesAdminController {
  constructor(private readonly prisma: PrismaService) {}
  @Get() list() { return this.prisma.saleOffer.findMany({orderBy:{createdAt:'desc'}}); }
  private async fields(body: OfferInput) {
    const {revision: _revision, latitude, longitude, ...data} = body;
    const location = locationFields({latitude, longitude});
    if (data.catalog !== 'comprar' && location.latitude != null) throw new BadRequestException('El pin corresponde a inmuebles en venta.');
    if (data.published && !data.images.length) throw new BadRequestException('Añade al menos una foto para publicar.');
    const count = await this.prisma.storedFile.count({where:{publicPath:{in:data.images},purpose:'PROPERTY_IMAGE',scanStatus:'CLEAN'}});
    if (count !== data.images.length) throw new BadRequestException('Fotografía no disponible.');
    return {...data, ...(data.catalog === 'comprar' ? location : {latitude:null, longitude:null,promotion:null,estimatedMonthlyRent:null}), city:data.catalog==='comprar' ? data.city : ''};
  }
  @Post() async create(@Body() body: OfferInput) {
    return this.prisma.saleOffer.create({data:await this.fields(body)});
  }
  @Put(':id') async update(@Param('id') id: string,@Body() body: OfferInput) {
    if (!body.revision) throw new BadRequestException('Falta la versión de la oferta.');
    const data=await this.fields(body);
    const {count}=await this.prisma.saleOffer.updateMany({where:{id, revision:body.revision},data:{...data,revision:{increment:1}}});
    if (!count) throw new ConflictException('La oferta cambió. Recarga para continuar.');
    return {id,revision:body.revision+1};
  }
}
