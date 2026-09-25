import { Type } from 'class-transformer';
import { IsEmail, IsIn, IsISO8601, IsInt, IsObject, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

export class BancolombiaNotificationDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  outlookMessageId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  internetMessageId?: string | null;

  @IsEmail()
  @MaxLength(254)
  sender!: string;

  @IsString()
  @MaxLength(300)
  subject!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(160)
  payerName!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2_000_000_000)
  amount!: number;

  @IsOptional()
  @IsIn(['COP'])
  currency?: string;

  @Matches(/^\d{4}$/)
  accountLast4!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  bankReference?: string | null;

  @IsISO8601()
  receivedAt!: string;

  @IsOptional()
  @IsObject()
  rawPayload?: Record<string, unknown>;
}
