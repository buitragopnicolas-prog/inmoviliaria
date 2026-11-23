import { OwnerController } from './owner.controller.js';
import { Module } from '@nestjs/common';
import { StorageModule } from '../storage/storage.module.js';
import { EditorialController, EditorialAdminController } from './editorial.controller.js';
import { SalesController, SalesAdminController } from './sales.controller.js';
@Module({
  imports: [StorageModule],
  controllers: [OwnerController, EditorialController, EditorialAdminController, SalesController, SalesAdminController],
})
export class PublishingModule {}
