import { Module } from '@nestjs/common';
import { HealthController } from './health.controller.js';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module.js';
import { ContactsModule } from './contacts/contacts.module.js';
import { DashboardModule } from './dashboard/dashboard.module.js';
import { InvoicesModule } from './invoices/invoices.module.js';
import { IntegrationsModule } from './integrations/integrations.module.js';
import { LeasesModule } from './leases/leases.module.js';
import { NewsModule } from './news/news.module.js';
import { PaymentsModule } from './payments/payments.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { PropertiesModule } from './properties/properties.module.js';
import { StorageModule } from './storage/storage.module.js';
import { TenantsModule } from './tenants/tenants.module.js';
import { UsersModule } from './users/users.module.js';

@Module({
  controllers: [HealthController],
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    UsersModule,
    AuthModule,
    PropertiesModule,
    NewsModule,
    StorageModule,
    TenantsModule,
    ContactsModule,
    LeasesModule,
    InvoicesModule,
    IntegrationsModule,
    PaymentsModule,
    DashboardModule,
  ],
})
export class AppModule {}
