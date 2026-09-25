import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, IsUrl, MaxLength, MinLength } from 'class-validator';

export class CreateNewsPostDto {
  @IsString()
  @MinLength(5)
  @MaxLength(140)
  title!: string;

  @IsString()
  @MinLength(20)
  @MaxLength(280)
  summary!: string;

  @IsString()
  @MinLength(30)
  @MaxLength(50_000)
  content!: string;

  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' && value.trim().length === 0 ? undefined : value)
  @IsString()
  @MaxLength(80)
  sourceLabel?: string;

  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' && value.trim().length === 0 ? undefined : value)
  @IsUrl({ require_tld: false }, { message: 'El enlace externo debe ser una URL válida.' })
  @MaxLength(2048)
  externalUrl?: string;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  published?: boolean;
}
