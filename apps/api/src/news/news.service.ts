import { FilesService } from '../storage/files.service.js';
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateNewsPostDto } from './dto/create-news-post.dto.js';

const articleRelations = {
  createdBy: { select: { id: true, name: true } },
  attachments: { where: { purpose: 'MANAGED_PDF', scanStatus: 'CLEAN' }, select: { id: true, originalName: true, size: true, createdAt:true }, orderBy:{createdAt:'asc'} },
} as const;

@Injectable()
export class NewsService {
  constructor(private readonly prisma: PrismaService, private readonly files: FilesService) {}

  listPublished() {
    return this.prisma.newsPost.findMany({
      where: { published: true },
      include: articleRelations,
      orderBy: { createdAt: 'desc' },
    });
  }

  featured() {
    return this.prisma.newsPost.findMany({
      where: { published: true },
      include: articleRelations,
      orderBy: { createdAt: 'desc' },
      take: 3,
    });
  }

  async findBySlug(slug: string) {
    const newsPost = await this.prisma.newsPost.findFirst({
      where: { slug, published: true },
      include: articleRelations,
    });
    if (!newsPost) throw new NotFoundException('Noticia no encontrada.');
    return newsPost;
  }

  listAdmin() {
    return this.prisma.newsPost.findMany({
      include: articleRelations,
      orderBy: { createdAt: 'desc' },
    });
  }

  private editorialFields(dto: CreateNewsPostDto) {
    return {
      title: dto.title.trim(), summary: dto.summary.trim(), content: dto.content?.trim() ?? '',
      category: dto.category,
      additionalLinks: dto.additionalLinks && [...new Set(dto.additionalLinks)],
      sourceLabel: this.optionalText(dto.sourceLabel) ?? null,
      externalUrl: this.optionalText(dto.externalUrl) ?? null,
      published: dto.published ?? true,
    };
  }

  async update(id: string, dto: CreateNewsPostDto, administratorId: string, pdfs: Express.Multer.File[]) {
    await this.ensureExists(id);
    const stored = await this.files.uploadManagedPdfs(pdfs, administratorId);
    try {
      return await this.prisma.newsPost.update({ where: {id}, data: {
        ...this.editorialFields(dto),
        attachments: { connect: stored.map(({id})=>({id})), disconnect: dto.removePdfIds?.map(id=>({id})) },
      }, include: articleRelations });
    } catch (error) {
      await this.files.removeStoredFiles(stored);
      throw error;
    }
  }

  async create(dto: CreateNewsPostDto, administratorId: string, pdfs: Express.Multer.File[]) {
    const slug = await this.uniqueSlug(dto.title);
    const stored = await this.files.uploadManagedPdfs(pdfs, administratorId);
    try {
      return await this.prisma.newsPost.create({ data: {
        ...this.editorialFields(dto), slug, createdById: administratorId,
        attachments: { connect: stored.map(({id})=>({id})) },
      }, include: articleRelations });
    } catch (error) {
      await this.files.removeStoredFiles(stored);
      throw error;
    }
  }

  async archive(newsPostId: string) {
    await this.ensureExists(newsPostId);
    return this.prisma.newsPost.update({
      where: { id: newsPostId },
      data: { published: false },
    });
  }

  private async ensureExists(id: string): Promise<void> {
    if (!(await this.prisma.newsPost.findUnique({ where: { id } }))) {
      throw new NotFoundException('Noticia no encontrada.');
    }
  }

  private async uniqueSlug(title: string): Promise<string> {
    const base = title
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    let slug = base;
    let suffix = 1;
    while (await this.prisma.newsPost.findUnique({ where: { slug } })) {
      slug = `${base}-${suffix++}`;
    }
    return slug;
  }

  private optionalText(value?: string): string | undefined {
    const normalized = value?.trim();
    return normalized ? normalized : undefined;
  }
}
