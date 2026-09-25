import { Type } from 'class-transformer';
import { IsIn, IsISO8601, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

export class LegacyReconcilePaymentDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  cuentaDestino?: string;

  @Matches(/^\d{4}$/)
  ultimos4Cuenta!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(160)
  pagador!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2_000_000_000)
  valor!: number;

  @IsOptional()
  @IsIn(['COP'])
  moneda?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  referenciaBancaria?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  referenciaIdempotencia!: string;

  @IsISO8601()
  fechaPago!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  idCorreoOutlook!: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  asuntoCorreo?: string;
}

export class LegacyRegisterPaymentDto {
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  arrendatarioId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(64)
  contratoId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2_000_000_000)
  valor!: number;

  @IsOptional()
  @IsIn(['COP'])
  moneda?: string;

  @IsString()
  @MinLength(2)
  @MaxLength(160)
  pagador!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  banco?: string;

  @Matches(/^\d{4}$/)
  ultimos4Cuenta!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  referenciaBancaria?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  referenciaIdempotencia!: string;

  @IsISO8601()
  fechaPago!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  idCorreoOutlook!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  origen?: string;
}
