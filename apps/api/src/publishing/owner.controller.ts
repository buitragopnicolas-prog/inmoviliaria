import type { Response } from 'express';
import { BadRequestException, Body, ConflictException, Controller, ForbiddenException, Get, NotFoundException, Param, Post, Put, Res, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { IsIn, IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';
import { randomUUID } from 'node:crypto';
import { CurrentUser, type JwtUser } from '../common/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { recordConsent } from '../common/privacy.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { FilesService } from '../storage/files.service.js';
import { validateUploadedFile } from '../storage/file-validation.js';

class ListingInput {
  @IsIn(['rent','sale']) operation!: 'rent'|'sale';
  @IsString() @Length(3,150) title!: string;
  @IsString() @Length(2,80) category!: string;
  @IsString() @Length(10,4000) description!: string;
  @IsString() @Length(2,100) city!: string;
  @IsString() @Length(2,120) neighborhood!: string;
  @IsString() @Length(3,200) address!: string;
  @Matches(/^\d{1,2}$/) bedrooms!: string;
  @Matches(/^[1-9]\d{0,13}$/) price!: string;
  @IsString() @MaxLength(1500) features!: string;
  @IsIn(['true','false']) published!: string;
  @IsOptional() @Matches(/^[1-9]\d{0,8}$/) revision?: string;
  @IsIn(['true']) authorized!: string;
  @Matches(/^[a-f0-9]{64}$/) policyVersion!: string;
}
const photos = FilesInterceptor('photos', 8, {limits:{fileSize:5_000_000,fields:18}});
function owner(user: JwtUser) {
  if (user.role !== 'USER' || user.portal !== 'OWNER') throw new ForbiddenException('Ingresa con una cuenta de propietario.');
  return user.sub;
}

@Controller('owner/listings')
@UseGuards(JwtAuthGuard)
export class OwnerController {
  constructor(private readonly prisma: PrismaService, private readonly files: FilesService) {}
  @Get() async list(@CurrentUser() user:JwtUser) {
    const id=owner(user);
    const [rent,sale]=await Promise.all([
      this.prisma.property.findMany({where:{createdById:id},include:{images:{orderBy:{sortOrder:'asc'}}},orderBy:{createdAt:'desc'}}),
      this.prisma.saleOffer.findMany({where:{ownerAccountId:id},orderBy:{createdAt:'desc'}}),
    ]);
    return [...rent.map(item=>({...item, operation:'rent', category:item.ownerCategory ?? 'Inmueble', price:String(item.monthlyRent),revision:item.ownerRevision,images:item.images.map(i=>i.url)})),
      ...sale.map(item=>({...item,operation:'sale'}))];
  }
  @Get('photos/:id')
  async photo(@Param('id') id:string,@CurrentUser() user:JwtUser,@Res() res:Response) {
    const file=await this.prisma.storedFile.findFirst({where:{id,createdById:owner(user),purpose:'PROPERTY_IMAGE',scanStatus:'CLEAN'},select:{id:true}});
    if(!file) throw new NotFoundException('Fotografía no disponible.');
    return this.files.sendContent(file.id,res,false,true);
  }
  @Post() @UseInterceptors(photos)
  create(@CurrentUser() user:JwtUser,@Body() dto:ListingInput,@UploadedFiles() files:Express.Multer.File[]) {
    return this.save(owner(user),dto,files);
  }
  @Put(':id') @UseInterceptors(photos)
  update(@Param('id') id:string,@CurrentUser() user:JwtUser,@Body() dto:ListingInput,@UploadedFiles() files:Express.Multer.File[]) {
    return this.save(owner(user),dto,files,id);
  }
  private async save(userId:string,dto:ListingInput,photos:Express.Multer.File[] = [],id?:string) {
    const rental=dto.operation==='rent';
    if (rental && Number(dto.price)>2147483647) throw new BadRequestException('El canon supera el máximo permitido.');
    if (id && !dto.revision) throw new BadRequestException('Falta la versión de la publicación.');
    const existing=id ? (rental
      ? await this.prisma.property.findFirst({where:{id,createdById:userId},select:{images:true}})
      : await this.prisma.saleOffer.findFirst({where:{id,ownerAccountId:userId},select:{images:true}})) : null;
    if (id && !existing) throw new NotFoundException('Publicación no encontrada.');
    if (dto.published==='true' && !photos.length && !existing?.images.length) throw new BadRequestException('Añade al menos una fotografía para publicar.');
    for (const photo of photos) validateUploadedFile(photo,['jpeg','png','webp'],5_000_000,'La fotografía');
    const uploaded=await this.files.uploadPropertyImages(photos,userId);
    const paths=uploaded.map(file=>file.publicPath);
    const common={title:dto.title.trim(),description:dto.description.trim(),city:dto.city.trim(),neighborhood:dto.neighborhood.trim(),address:dto.address.trim(),
      bedrooms:Number(dto.bedrooms),features:dto.features.split(/[,\n]/).map(item=>item.trim()).filter(Boolean),published:dto.published==='true'};
    try {
      return await this.prisma.$transaction(async tx=>{
        const listingId=id ?? randomUUID();
        await recordConsent(tx,{authorized:dto.authorized==='true',policyVersion:dto.policyVersion},'listing:'+listingId,userId);
        let count=1;
        if (rental) {
          const data={...common,monthlyRent:Number(dto.price),ownerCategory:dto.category.trim()};
          if (id) {
            ({count}=await tx.property.updateMany({where:{id,createdById:userId,status:'AVAILABLE',ownerRevision:Number(dto.revision)},data:{...data,ownerRevision:{increment:1}}}));
          } else {
            await tx.property.create({data:{...data,id:listingId,slug:'inmueble-'+listingId,createdById:userId}});
          }
          if (count && paths.length) {
            await tx.propertyImage.deleteMany({where:{propertyId:listingId}});
            await tx.propertyImage.createMany({data:paths.map((url,sortOrder)=>({propertyId:listingId,url,sortOrder,alt:common.title}))});
          }
        } else {
          const data={...common,category:dto.category.trim(),price:dto.price};
          if (id) {
            ({count}=await tx.saleOffer.updateMany({where:{id,ownerAccountId:userId,revision:Number(dto.revision)},data:{...data,...(paths.length && {images:paths}),revision:{increment:1}}}));
          } else {
            await tx.saleOffer.create({data:{...data,id:listingId,catalog:'comprar',ownerAccountId:userId,images:paths}});
          }
        }
        if (!count) throw new ConflictException('La publicación cambió o el inmueble está ocupado. Recarga para consultar su estado.');
        return {id:listingId};
      });
    } catch(error) {
      await Promise.all(uploaded.map(file=>this.files.removeStoredFile(file)));
      throw error;
    }
  }
}
