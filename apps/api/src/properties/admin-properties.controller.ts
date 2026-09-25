import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { CurrentUser, type JwtUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { CreatePropertyDto } from './dto/create-property.dto.js';
import { UpdatePropertyDto } from './dto/update-property.dto.js';
import { PropertiesService } from './properties.service.js';
import { validateUploadedFile } from '../storage/file-validation.js';

const maxImageSize = Number(process.env.PROPERTY_IMAGE_MAX_FILE_SIZE ?? 5_000_000);
const maxTour360Size = Number(process.env.PROPERTY_360_MAX_FILE_SIZE ?? 15_000_000);
const maxRequestSize = Number(process.env.STORAGE_MAX_REQUEST_SIZE ?? 70_000_000);
const storage = memoryStorage();

type PropertyUploadFields = {
  photos?: Express.Multer.File[];
  tour360?: Express.Multer.File[];
};

const propertyUploadInterceptor = FileFieldsInterceptor([
  { name: 'photos', maxCount: 10 },
  { name: 'tour360', maxCount: 1 },
], { storage, limits: { fileSize: Math.max(maxImageSize, maxTour360Size) } });

@Controller('admin/properties')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminPropertiesController {
  constructor(private readonly properties: PropertiesService) {}

  @Get()
  list() {
    return this.properties.listAdmin();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.properties.findAdminById(id);
  }

  @Post()
  @UseInterceptors(propertyUploadInterceptor)
  create(
    @Body() dto: CreatePropertyDto,
    @UploadedFiles() files: PropertyUploadFields = {},
    @CurrentUser() user: JwtUser,
  ) {
    const photos = files.photos ?? [];
    const tour360 = files.tour360?.[0];
    this.validateImages(photos);
    this.validateTour360(tour360);
    this.validateTotalSize(photos, tour360);
    return this.properties.create(dto, user.sub, photos, tour360);
  }

  @Patch(':id')
  @UseInterceptors(propertyUploadInterceptor)
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePropertyDto,
    @UploadedFiles() files: PropertyUploadFields = {},
    @CurrentUser() user: JwtUser,
  ) {
    const photos = files.photos ?? [];
    const tour360 = files.tour360?.[0];
    this.validateImages(photos);
    this.validateTour360(tour360);
    this.validateTotalSize(photos, tour360);
    return this.properties.update(id, dto, user.sub, photos, tour360);
  }

  @Post(':id/images')
  @UseInterceptors(FilesInterceptor('photos', 10, { storage, limits: { fileSize: maxImageSize } }))
  addImages(@Param('id') id: string, @UploadedFiles() files: Express.Multer.File[] = []) {
    this.validateImages(files, true);
    return this.properties.addImages(id, files);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.properties.remove(id);
  }

  private validateImages(files: Express.Multer.File[], required = false): void {
    if (required && files.length === 0) throw new BadRequestException('Debe subir al menos una imagen.');
    files.forEach((file) => validateUploadedFile(file, ['jpeg', 'png', 'webp'], maxImageSize, 'La imagen'));
  }

  private validateTotalSize(files: Express.Multer.File[], tour360?: Express.Multer.File): void {
    const totalSize = files.reduce((sum, file) => sum + file.size, tour360?.size ?? 0);
    if (totalSize > maxRequestSize) {
      throw new BadRequestException('La carga completa no puede superar 70 MB.');
    }
  }

  private validateTour360(file?: Express.Multer.File): void {
    if (!file) return;
    validateUploadedFile(file, ['jpeg', 'png', 'webp'], maxTour360Size, 'La foto 360');
  }
}
