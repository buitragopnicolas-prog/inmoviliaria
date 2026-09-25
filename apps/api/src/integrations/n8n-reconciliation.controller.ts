import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { BancolombiaReconciliationService } from './bancolombia-reconciliation.service.js';
import { BancolombiaNotificationDto } from './dto/bancolombia-notification.dto.js';
import { LegacyReconcilePaymentDto, LegacyRegisterPaymentDto } from './dto/legacy-payment.dto.js';
import { N8nApiKeyGuard } from './guards/n8n-api-key.guard.js';
import { Throttle } from '@nestjs/throttler';

@Controller('integrations/n8n/bancolombia')
@UseGuards(N8nApiKeyGuard)
@Throttle({ default: { limit: Number(process.env.RATE_LIMIT_N8N ?? 60), ttl: 60_000 } })
export class N8nBancolombiaController {
  constructor(private readonly reconciliation: BancolombiaReconciliationService) {}

  @Post('reconcile')
  reconcile(@Body() input: BancolombiaNotificationDto) {
    return this.reconciliation.reconcile(input);
  }
}

@Controller('n8n/arrendamientos')
@UseGuards(N8nApiKeyGuard)
@Throttle({ default: { limit: Number(process.env.RATE_LIMIT_N8N ?? 60), ttl: 60_000 } })
export class LegacyN8nPaymentsController {
  constructor(private readonly reconciliation: BancolombiaReconciliationService) {}

  @Post('conciliar-pago')
  preview(@Body() input: LegacyReconcilePaymentDto) {
    return this.reconciliation.previewLegacy(input);
  }

  @Post('registrar-pago')
  register(@Body() input: LegacyRegisterPaymentDto) {
    return this.reconciliation.registerLegacy(input);
  }
}
