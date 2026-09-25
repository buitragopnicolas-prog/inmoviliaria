import { Body, Controller, Get, Headers, Param, Patch, Post, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { CurrentUser, type JwtUser } from '../common/decorators/current-user.decorator.js';
import { Roles } from '../common/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { PaymentsService } from './payments.service.js';
import { ReportManualPaymentDto } from './dto/report-manual-payment.dto.js';
import { ReviewManualPaymentDto } from './dto/review-manual-payment.dto.js';

const receiptMaxSize = Number(process.env.PAYMENT_RECEIPT_MAX_FILE_SIZE ?? 8_000_000);

@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post('invoices/:invoiceId/intent')
  @UseGuards(JwtAuthGuard)
  createIntent(@Param('invoiceId') invoiceId: string, @CurrentUser() user: JwtUser) {
    return this.payments.createIntent(invoiceId, user.sub);
  }

  @Get('manual/config')
  @UseGuards(JwtAuthGuard)
  manualConfig() {
    return this.payments.manualConfig();
  }

  @Post('invoices/:invoiceId/manual-report')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('receipt', { storage: memoryStorage(), limits: { fileSize: receiptMaxSize } }))
  reportManual(
    @Param('invoiceId') invoiceId: string,
    @CurrentUser() user: JwtUser,
    @Body() input: ReportManualPaymentDto,
    @UploadedFile() receipt?: Express.Multer.File,
  ) {
    return this.payments.reportManual(invoiceId, user.sub, input, receipt);
  }

  @Get('manual/pending')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  listManualPending() {
    return this.payments.listManualPending();
  }

  @Patch('manual/:paymentId/review')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  reviewManual(
    @Param('paymentId') paymentId: string,
    @CurrentUser() user: JwtUser,
    @Body() input: ReviewManualPaymentDto,
  ) {
    return this.payments.reviewManual(paymentId, user.sub, input);
  }

  @Get('receipts/:fileId')
  @UseGuards(JwtAuthGuard)
  async receipt(
    @Param('fileId') fileId: string,
    @CurrentUser() user: JwtUser,
    @Res() response: Response,
  ) {
    await this.payments.sendReceipt(fileId, user, response);
  }

  @Post('mock/:reference/approve')
  @UseGuards(JwtAuthGuard)
  approveMock(@Param('reference') reference: string, @CurrentUser() user: JwtUser) {
    return this.payments.approveMock(reference, user.sub);
  }

  @Post('wompi/webhook')
  webhook(@Body() event: unknown, @Headers('x-event-checksum') checksum?: string) {
    return this.payments.processWompiEvent(event as Parameters<PaymentsService['processWompiEvent']>[0], checksum);
  }
}
