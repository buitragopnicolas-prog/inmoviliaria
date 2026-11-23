import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { FilesService } from '../storage/files.service.js';
import type { CreatePropertyDto } from './dto/create-property.dto.js';
import type { SearchPropertiesDto } from './dto/search-properties.dto.js';
import type { UpdatePropertyDto } from './dto/update-property.dto.js';

const DEFAULT_PROPERTY_IMAGE_URL = '/property-placeholder.svg';

type AssignmentMode = 'NONE' | 'EXISTING' | 'NEW';
type UpdateAssignmentMode = 'UNCHANGED' | AssignmentMode;

type AssignmentData = {
  tenantId?: string;
  tenantName?: string;
  tenantEmail?: string;
  tenantPhone?: string;
  tenantDocumentNumber?: string;
  leaseStartDate?: string;
  leaseEndDate?: string;
  expectedMonthlyPayment?: number;
};

@Injectable()
export class PropertiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly files: FilesService,
  ) {}

  async listPublished(query: SearchPropertiesDto) {
    return this.prisma.property.findMany({
      where: {
        published: true,
        status: 'AVAILABLE',
        city: query.city ? { contains: query.city, mode: 'insensitive' } : undefined,
        monthlyRent: query.maxRent ? { lte: query.maxRent } : undefined,
        OR: query.search
          ? [
              { title: { contains: query.search, mode: 'insensitive' } },
              { neighborhood: { contains: query.search, mode: 'insensitive' } },
              { city: { contains: query.search, mode: 'insensitive' } },
            ]
          : undefined,
      },
      include: { images: { orderBy: { sortOrder: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async featured() {
    return this.prisma.property.findMany({
      where: { published: true, status: 'AVAILABLE' },
      include: { images: { orderBy: { sortOrder: 'asc' }, take: 1 } },
      take: 3,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findBySlug(slug: string) {
    const property = await this.prisma.property.findFirst({
      where: { slug, published: true },
      include: { images: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!property) throw new NotFoundException('Inmueble no encontrado.');
    return property;
  }

  listAdmin() {
    return this.prisma.property.findMany({
      include: {
        images: { orderBy: { sortOrder: 'asc' } },
        leases: {
          where: { active: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            tenant: { select: { id: true, name: true, email: true, phone: true, documentNumber: true } },
            user: { select: { id: true, name: true, email: true } },
          },
        },
        _count: { select: { leases: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findAdminById(id: string) {
    const property = await this.prisma.property.findUnique({
      where: { id },
      include: {
        images: { orderBy: { sortOrder: 'asc' } },
        leases: {
          where: { active: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            tenant: { select: { id: true, name: true, email: true, phone: true, documentNumber: true } },
            user: { select: { id: true, name: true, email: true } },
          },
        },
        _count: { select: { leases: true } },
      },
    });
    if (!property) throw new NotFoundException('Inmueble no encontrado.');
    return property;
  }

  async create(
    dto: CreatePropertyDto,
    administratorId: string,
    files: Express.Multer.File[],
    tour360File?: Express.Multer.File,
  ) {
    const slug = await this.uniqueSlug(dto.title);
    const features = this.parseFeatures(dto.features);
    const uploadedFiles = await this.files.uploadPropertyImages(files, administratorId);
    const uploadedTour360 = tour360File
      ? await this.files.uploadProperty360(tour360File, administratorId)
      : null;
    const uploadedAssets = uploadedTour360 ? [...uploadedFiles, uploadedTour360] : uploadedFiles;

    try {
      const propertyId = await this.prisma.$transaction(async (tx) => {
        const property = await tx.property.create({
          data: {
            title: dto.title.trim(),
            slug,
            description: dto.description.trim(),
            monthlyRent: dto.monthlyRent,
            administrationFee: dto.administrationFee,
            deposit: dto.deposit,
            city: dto.city.trim(),
            neighborhood: dto.neighborhood.trim(),
            address: dto.address.trim(),
            bedrooms: dto.bedrooms,
            bathrooms: dto.bathrooms,
            areaM2: dto.areaM2,
            parking: dto.parking,
            features,
            tour360Url: uploadedTour360?.publicPath,
            videoUrl: this.optionalText(dto.videoUrl),
            published: dto.published ?? true,
            createdById: administratorId,
            images: {
              create: uploadedFiles.length > 0
                ? uploadedFiles.map((file, index) => ({
                    url: file.publicPath,
                    alt: dto.title.trim(),
                    sortOrder: index,
                  }))
                : [{
                    url: DEFAULT_PROPERTY_IMAGE_URL,
                    alt: `Imagen predeterminada de ${dto.title.trim()}`,
                    sortOrder: 0,
                  }],
            },
          },
        });

        await this.applyAssignment(
          tx,
          property.id,
          dto.assignmentMode ?? 'NONE',
          dto,
          dto.monthlyRent,
        );
        return property.id;
      });

      return this.findAdminById(propertyId);
    } catch (error) {
      await this.files.removeStoredFiles(uploadedAssets);
      throw error;
    }
  }

  async update(
    propertyId: string,
    dto: UpdatePropertyDto,
    administratorId: string,
    photos: Express.Multer.File[],
    tour360File?: Express.Multer.File,
  ) {
    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
      include: {
        images: { orderBy: { sortOrder: 'asc' } },
        leases: { where: { active: true }, orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
    if (!property) throw new NotFoundException('Inmueble no encontrado.');

    const requestedImageMode = dto.imageMode ?? 'KEEP';
    const imageMode = photos.length > 0 && requestedImageMode === 'KEEP' ? 'APPEND' : requestedImageMode;
    if ((imageMode === 'APPEND' || imageMode === 'REPLACE') && photos.length === 0) {
      throw new BadRequestException('Seleccione al menos una imagen para agregar o reemplazar.');
    }
    if (imageMode === 'DEFAULT' && photos.length > 0) {
      throw new BadRequestException('No adjunte fotografías cuando elija usar la imagen predeterminada.');
    }

    const requestedTourMode = dto.tour360Mode ?? 'KEEP';
    const tour360Mode = tour360File && requestedTourMode === 'KEEP' ? 'REPLACE' : requestedTourMode;
    if (tour360Mode === 'REPLACE' && !tour360File) {
      throw new BadRequestException('Seleccione una foto 360 para reemplazar la actual.');
    }

    const uploadedPhotos = await this.files.uploadPropertyImages(photos, administratorId);
    const uploadedTour360 = tour360File
      ? await this.files.uploadProperty360(tour360File, administratorId)
      : null;
    const uploadedAssets = uploadedTour360 ? [...uploadedPhotos, uploadedTour360] : uploadedPhotos;

    const pathsToRemove = new Set<string>();
    if (imageMode === 'REPLACE' || imageMode === 'DEFAULT') {
      property.images.forEach((image) => {
        if (this.isManagedAsset(image.url)) pathsToRemove.add(image.url);
      });
    }
    if ((tour360Mode === 'REPLACE' || tour360Mode === 'REMOVE') && this.isManagedAsset(property.tour360Url)) {
      pathsToRemove.add(property.tour360Url!);
    }

    const oldStoredFiles = await this.storedFilesForPaths([...pathsToRemove]);

    try {
      const nextTitle = dto.title?.trim() ?? property.title;
      const nextMonthlyRent = dto.monthlyRent ?? property.monthlyRent;
      const updateData: Prisma.PropertyUncheckedUpdateInput = {
        title: dto.title === undefined ? undefined : nextTitle,
        description: dto.description === undefined ? undefined : dto.description.trim(),
        monthlyRent: dto.monthlyRent,
        administrationFee: dto.administrationFee,
        deposit: dto.deposit,
        city: dto.city === undefined ? undefined : dto.city.trim(),
        neighborhood: dto.neighborhood === undefined ? undefined : dto.neighborhood.trim(),
        address: dto.address === undefined ? undefined : dto.address.trim(),
        bedrooms: dto.bedrooms,
        bathrooms: dto.bathrooms,
        areaM2: dto.areaM2,
        parking: dto.parking,
        features: dto.features === undefined ? undefined : this.parseFeatures(dto.features),
        videoUrl: dto.videoUrl === undefined ? undefined : this.optionalText(dto.videoUrl) ?? null,
        published: dto.published,
      };

      if (dto.title !== undefined && nextTitle !== property.title) {
        updateData.slug = await this.uniqueSlug(nextTitle, propertyId);
      }

      if (tour360Mode === 'REPLACE') updateData.tour360Url = uploadedTour360?.publicPath ?? null;
      if (tour360Mode === 'REMOVE') updateData.tour360Url = null;

      await this.prisma.$transaction(async (tx) => {
        await tx.property.update({ where: { id: propertyId }, data: {...updateData,ownerRevision:{increment:1}} });

        if (imageMode === 'REPLACE' || imageMode === 'DEFAULT') {
          await tx.propertyImage.deleteMany({ where: { propertyId } });
        }

        if (imageMode === 'REPLACE') {
          await tx.propertyImage.createMany({
            data: uploadedPhotos.map((file, index) => ({
              propertyId,
              url: file.publicPath,
              alt: nextTitle,
              sortOrder: index,
            })),
          });
        } else if (imageMode === 'DEFAULT') {
          await tx.propertyImage.create({
            data: {
              propertyId,
              url: DEFAULT_PROPERTY_IMAGE_URL,
              alt: `Imagen predeterminada de ${nextTitle}`,
              sortOrder: 0,
            },
          });
        } else if (imageMode === 'APPEND') {
          const placeholderIds = property.images
            .filter((image) => image.url === DEFAULT_PROPERTY_IMAGE_URL)
            .map((image) => image.id);
          if (placeholderIds.length > 0) {
            await tx.propertyImage.deleteMany({ where: { id: { in: placeholderIds } } });
          }
          const realImages = property.images.filter((image) => image.url !== DEFAULT_PROPERTY_IMAGE_URL);
          const nextSortOrder = realImages.reduce((max, image) => Math.max(max, image.sortOrder), -1) + 1;
          await tx.propertyImage.createMany({
            data: uploadedPhotos.map((file, index) => ({
              propertyId,
              url: file.publicPath,
              alt: nextTitle,
              sortOrder: nextSortOrder + index,
            })),
          });
        } else if (property.images.length === 0) {
          await tx.propertyImage.create({
            data: {
              propertyId,
              url: DEFAULT_PROPERTY_IMAGE_URL,
              alt: `Imagen predeterminada de ${nextTitle}`,
              sortOrder: 0,
            },
          });
        } else if (dto.title !== undefined) {
          await tx.propertyImage.updateMany({ where: { propertyId }, data: { alt: nextTitle } });
        }

        await this.applyAssignment(
          tx,
          propertyId,
          dto.assignmentMode ?? 'UNCHANGED',
          dto,
          nextMonthlyRent,
        );
      });

    } catch (error) {
      await this.files.removeStoredFiles(uploadedAssets);
      throw error;
    }

    await this.files.removeStoredFiles(oldStoredFiles);
    return this.findAdminById(propertyId);
  }

  async addImages(propertyId: string, files: Express.Multer.File[]) {
    const property = await this.prisma.property.findUnique({ where: { id: propertyId }, include: { images: true } });
    if (!property) throw new NotFoundException('Inmueble no encontrado.');
    const uploadedFiles = await this.files.uploadPropertyImages(files);
    try {
      await this.prisma.$transaction(async (tx) => {
        const placeholderIds = property.images
          .filter((image) => image.url === DEFAULT_PROPERTY_IMAGE_URL)
          .map((image) => image.id);
        if (placeholderIds.length > 0) {
          await tx.propertyImage.deleteMany({ where: { id: { in: placeholderIds } } });
        }
        const realImages = property.images.filter((image) => image.url !== DEFAULT_PROPERTY_IMAGE_URL);
        const nextSortOrder = realImages.reduce((max, image) => Math.max(max, image.sortOrder), -1) + 1;
        await tx.propertyImage.createMany({
          data: uploadedFiles.map((file, index) => ({
            propertyId,
            url: file.publicPath,
            alt: property.title,
            sortOrder: nextSortOrder + index,
          })),
        });
      });
    } catch (error) {
      await this.files.removeStoredFiles(uploadedFiles);
      throw error;
    }
    return this.findAdminById(propertyId);
  }

  async remove(propertyId: string) {
    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
      include: {
        images: { select: { url: true } },
        leases: { select: { id: true, active: true } },
      },
    });
    if (!property) throw new NotFoundException('Inmueble no encontrado.');

    if (property.leases.length > 0) {
      await this.prisma.$transaction(async (tx) => {
        await tx.lease.updateMany({
          where: { propertyId, active: true },
          data: { active: false, status: 'ENDED', endDate: new Date() },
        });
        await tx.property.update({
          where: { id: propertyId },
          data: { status: 'ARCHIVED', published: false },
        });
      });
      return {
        deleted: false,
        archived: true,
        id: propertyId,
        preservedLeases: property.leases.length,
        message: 'El inmueble fue retirado del catálogo y archivado para conservar contratos, facturas y pagos.',
      };
    }

    const publicPaths = [
      ...property.images.map((image) => image.url),
      property.tour360Url,
    ].filter((value): value is string => this.isManagedAsset(value));
    const storedFiles = await this.storedFilesForPaths(publicPaths);

    await this.prisma.property.delete({ where: { id: propertyId } });
    await this.files.removeStoredFiles(storedFiles);
    return {
      deleted: true,
      archived: false,
      id: propertyId,
      message: 'El inmueble sin historial asociado fue eliminado definitivamente.',
    };
  }

  private async applyAssignment(
    tx: Prisma.TransactionClient,
    propertyId: string,
    mode: UpdateAssignmentMode,
    data: AssignmentData,
    monthlyRent: number,
  ): Promise<void> {
    if (mode === 'UNCHANGED') return;

    if (mode === 'NONE') {
      await tx.lease.updateMany({
        where: { propertyId, active: true },
        data: { active: false, status: 'ENDED', endDate: data.leaseEndDate ? new Date(data.leaseEndDate) : new Date() },
      });
      await tx.property.update({ where: { id: propertyId }, data: { status: 'AVAILABLE' } });
      return;
    }

    const tenant = mode === 'EXISTING'
      ? await this.findExistingTenant(tx, data.tenantId)
      : await this.findOrCreateTenant(tx, data);

    const currentLease = await tx.lease.findFirst({
      where: { propertyId, active: true },
      orderBy: { createdAt: 'desc' },
    });

    const leaseData = {
      tenantId: tenant.id,
      userId: tenant.userId,
      startDate: data.leaseStartDate ? new Date(data.leaseStartDate) : currentLease?.startDate ?? new Date(),
      endDate: data.leaseEndDate ? new Date(data.leaseEndDate) : null,
      expectedMonthlyPayment: data.expectedMonthlyPayment ?? monthlyRent,
      active: true,
      status: 'ACTIVE' as const,
    };

    let leaseId: string;
    if (currentLease?.tenantId === tenant.id) {
      const updated = await tx.lease.update({ where: { id: currentLease.id }, data: leaseData });
      leaseId = updated.id;
    } else {
      await tx.lease.updateMany({
        where: { propertyId, active: true },
        data: { active: false, status: 'ENDED', endDate: new Date() },
      });
      const lease = await tx.lease.create({
        data: {
          propertyId,
          ...leaseData,
        },
      });
      leaseId = lease.id;
    }

    const normalizedTenantName = this.normalize(tenant.name);
    if (normalizedTenantName) {
      await tx.tenantAlias.upsert({
        where: {
          tenantId_normalizedAlias: {
            tenantId: tenant.id,
            normalizedAlias: normalizedTenantName,
          },
        },
        update: { alias: tenant.name },
        create: { tenantId: tenant.id, alias: tenant.name, normalizedAlias: normalizedTenantName },
      });
      await tx.leasePayerAlias.upsert({
        where: {
          leaseId_normalizedAlias: {
            leaseId,
            normalizedAlias: normalizedTenantName,
          },
        },
        update: { alias: tenant.name },
        create: { leaseId, alias: tenant.name, normalizedAlias: normalizedTenantName },
      });
    }

    const activeAccounts = await tx.receivingBankAccount.findMany({ where: { active: true }, select: { id: true } });
    if (activeAccounts.length > 0) {
      await tx.leaseReceivingAccount.createMany({
        data: activeAccounts.map((account) => ({ leaseId, accountId: account.id, active: true })),
        skipDuplicates: true,
      });
    }

    await tx.property.update({ where: { id: propertyId }, data: { status: 'RENTED' } });

    const monthlyCharge = leaseData.expectedMonthlyPayment ?? monthlyRent;
    if (monthlyCharge > 0) {
      const now = new Date();
      const period = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 5);
      const code = `CANON-${leaseId.slice(-8).toUpperCase()}-${period.toISOString().slice(0, 7)}`;
      await tx.invoice.upsert({
        where: { code },
        update: {
          amount: monthlyCharge,
          dueDate,
          leaseId,
          tenantId: tenant.id,
          userId: tenant.userId,
        },
        create: {
          code,
          period,
          dueDate,
          amount: monthlyCharge,
          status: 'PENDING',
          leaseId,
          tenantId: tenant.id,
          userId: tenant.userId,
        },
      });
    }
  }

  private async findExistingTenant(tx: Prisma.TransactionClient, tenantId?: string) {
    if (!tenantId) throw new BadRequestException('Seleccione un arrendatario existente.');
    const tenant = await tx.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) throw new BadRequestException('El arrendatario seleccionado ya no existe.');
    if (!tenant.userId && tenant.email) {
      const user = await tx.user.findUnique({
        where: { email: tenant.email.toLowerCase() },
        include: { tenantProfile: { select: { id: true } } },
      });
      if (user?.role==='USER' && user.portal==='TENANT' && !user.tenantProfile) {
        return tx.tenant.update({ where: { id: tenant.id }, data: { userId: user.id } });
      }
    }
    return tenant;
  }

  private async findOrCreateTenant(tx: Prisma.TransactionClient, data: AssignmentData) {
    const name = data.tenantName?.trim();
    if (!name) throw new BadRequestException('Escriba el nombre del nuevo arrendatario.');

    const email = this.optionalText(data.tenantEmail)?.toLowerCase();
    const phone = this.optionalText(data.tenantPhone);
    const documentNumber = this.optionalText(data.tenantDocumentNumber);
    const normalizedName = this.normalize(name);
    const candidates: Prisma.TenantWhereInput[] = [];
    if (email) candidates.push({ email: { equals: email, mode: 'insensitive' } });
    if (documentNumber) candidates.push({ documentNumber });
    candidates.push({ normalizedName });

    const linkedUser = email
      ? await tx.user.findUnique({
          where: { email },
          include: { tenantProfile: true },
        })
      : null;
    if (linkedUser && (linkedUser.role!=='USER' || linkedUser.portal!=='TENANT')) throw new BadRequestException('Ese correo corresponde a otro perfil.');
    if (linkedUser?.tenantProfile) {
      return tx.tenant.update({
        where: { id: linkedUser.tenantProfile.id },
        data: {
          name,
          normalizedName,
          email,
          phone: phone ?? linkedUser.tenantProfile.phone,
          documentNumber: documentNumber ?? linkedUser.tenantProfile.documentNumber,
        },
      });
    }

    const existing = await tx.tenant.findFirst({ where: { OR: candidates } });
    if (existing) {
      return tx.tenant.update({
        where: { id: existing.id },
        data: {
          name,
          normalizedName,
          email: email ?? existing.email,
          phone: phone ?? existing.phone,
          documentNumber: documentNumber ?? existing.documentNumber,
          userId: existing.userId ?? linkedUser?.id,
        },
      });
    }

    return tx.tenant.create({
      data: { name, normalizedName, email, phone, documentNumber, userId: linkedUser?.id },
    });
  }

  private async storedFilesForPaths(publicPaths: string[]) {
    if (publicPaths.length === 0) return [];
    return this.prisma.storedFile.findMany({
      where: { publicPath: { in: publicPaths } },
      select: { id: true, objectKey: true },
    });
  }

  private async uniqueSlug(title: string, excludeId?: string): Promise<string> {
    const base = title
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'inmueble';
    let slug = base;
    let suffix = 1;
    while (await this.prisma.property.findFirst({
      where: { slug, id: excludeId ? { not: excludeId } : undefined },
      select: { id: true },
    })) {
      slug = `${base}-${suffix++}`;
    }
    return slug;
  }

  private parseFeatures(value?: string): string[] {
    return value
      ? value.split(',').map((feature) => feature.trim()).filter(Boolean)
      : [];
  }

  private optionalText(value?: string): string | undefined {
    const normalized = value?.trim();
    return normalized ? normalized : undefined;
  }

  private normalize(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  private isManagedAsset(value?: string | null): value is string {
    return Boolean(value?.startsWith('/api/files/'));
  }
}
