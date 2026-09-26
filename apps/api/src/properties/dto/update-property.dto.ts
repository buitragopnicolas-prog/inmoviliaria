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

export class UpdatePropertyDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10_000)
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(2_000_000_000)
  monthlyRent?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(2_000_000_000)
  administrationFee?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(2_000_000_000)
  deposit?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  neighborhood?: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  address?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  bedrooms?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  bathrooms?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100_000)
  areaM2?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  parking?: number;

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
  @IsIn(['KEEP', 'APPEND', 'REPLACE', 'DEFAULT'])
  imageMode?: 'KEEP' | 'APPEND' | 'REPLACE' | 'DEFAULT';

  @IsOptional()
  @IsIn(['KEEP', 'REPLACE', 'REMOVE'])
  tour360Mode?: 'KEEP' | 'REPLACE' | 'REMOVE';

  @IsOptional()
  @IsIn(['UNCHANGED', 'NONE', 'EXISTING', 'NEW'])
  assignmentMode?: 'UNCHANGED' | 'NONE' | 'EXISTING' | 'NEW';

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
