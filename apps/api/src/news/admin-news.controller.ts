import { FilesInterceptor } from '@nestjs/platform-express';
import { Body, Controller, Delete, Get, Param, Put, Post, UploadedFiles, UseInterceptors, UseGuards } from '@nestjs/common';
import { CurrentUser, type JwtUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { CreateNewsPostDto } from './dto/create-news-post.dto.js';
import { NewsService } from './news.service.js';

const pdfUploads = FilesInterceptor('pdfs', 3, { defParamCharset: 'utf8', limits: { fileSize: 8_000_000, files: 3 } });

@Controller('admin/news')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminNewsController {
  constructor(private readonly news: NewsService) {}

  @Get()
  list() {
    return this.news.listAdmin();
  }

  @Post()
  @UseInterceptors(pdfUploads)
  create(@Body() dto: CreateNewsPostDto, @CurrentUser() user: JwtUser, @UploadedFiles() pdfs: Express.Multer.File[] = []) {
    return this.news.create(dto, user.sub, pdfs);
  }

  @Put(':id')
  @UseInterceptors(pdfUploads)
  update(@Param('id') id: string, @Body() dto: CreateNewsPostDto, @CurrentUser() user: JwtUser, @UploadedFiles() pdfs: Express.Multer.File[] = []) {
    return this.news.update(id, dto, user.sub, pdfs);
  }

  @Delete(':id')
  archive(@Param('id') id: string) {
    return this.news.archive(id);
  }
}
