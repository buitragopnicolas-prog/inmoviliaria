import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller.js';
import { PaymentsService } from './payments.service.js';
import { InvoicesModule } from '../invoices/invoices.module.js';
import { StorageModule } from '../storage/storage.module.js';

@Module({ imports: [InvoicesModule, StorageModule], controllers: [PaymentsController], providers: [PaymentsService] })
export class PaymentsModule {}
