import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const emptyToUndefined = ({ value }: { value: unknown }) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

export class CreatePropertyDto {
  @IsString()
  @MinLength(5)
  @MaxLength(160)
  title!: string;

  @IsString()
  @MinLength(30)
  @MaxLength(10_000)
  description!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(2_000_000_000)
  monthlyRent!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(2_000_000_000)
  administrationFee!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(2_000_000_000)
  deposit!: number;

  @IsString()
  @MaxLength(100)
  city!: string;

  @IsString()
  @MaxLength(120)
  neighborhood!: string;

  @IsString()
  @MaxLength(240)
  address!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  bedrooms!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  bathrooms!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100_000)
  areaM2!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  parking!: number;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  features?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsUrl({ require_tld: false })
  @MaxLength(2048)
  videoUrl?: string;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  published?: boolean;

  @IsOptional()
  @IsIn(['NONE', 'EXISTING', 'NEW'])
  assignmentMode?: 'NONE' | 'EXISTING' | 'NEW';

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(64)
  tenantId?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  tenantName?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsEmail()
  @MaxLength(254)
  tenantEmail?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(30)
  tenantPhone?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(30)
  tenantDocumentNumber?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsDateString()
  leaseStartDate?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsDateString()
  leaseEndDate?: string;

  @IsOptional()
  @Transform(({ value }) => value === '' || value === null || value === undefined ? undefined : Number(value))
  @IsNumber()
  @Min(0)
  @Max(2_000_000_000)
  expectedMonthlyPayment?: number;
}
