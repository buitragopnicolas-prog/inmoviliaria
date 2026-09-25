import { Module } from '@nestjs/common';
import { AdminFilesController } from './admin-files.controller.js';
import { FilesController } from './files.controller.js';
import { FilesService } from './files.service.js';
import { StorageService } from './storage.service.js';
import { AntimalwareService } from './antimalware.service.js';

@Module({
  controllers: [FilesController, AdminFilesController],
  providers: [StorageService, AntimalwareService, FilesService],
  exports: [FilesService, StorageService],
})
export class StorageModule {}
