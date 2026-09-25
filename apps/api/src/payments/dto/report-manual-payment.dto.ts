import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsString, Length, Max, Min } from 'class-validator';

export enum ManualPaymentMethodDto {
  QR = 'QR',
  BREB = 'BREB',
  BANK_TRANSFER = 'BANK_TRANSFER',
  BANK_DEPOSIT = 'BANK_DEPOSIT',
}

export class ReportManualPaymentDto {
  @IsEnum(ManualPaymentMethodDto)
  method!: ManualPaymentMethodDto;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2_000_000_000)
  amount!: number;

  @IsDateString()
  paidAt!: string;

  @IsString()
  @Length(3, 100)
  bankReference!: string;

  @IsString()
  @Length(16, 120)
  idempotencyKey!: string;
}
