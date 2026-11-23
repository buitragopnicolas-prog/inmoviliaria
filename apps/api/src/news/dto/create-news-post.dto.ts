import { Transform } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsOptional, IsString, IsUrl, MaxLength, MinLength } from 'class-validator';

import { readFileSync } from 'node:fs';
const categories: string[] = JSON.parse(readFileSync(new URL('../../../../../shared/bulletin-categories.json', import.meta.url), 'utf8'));

export class CreateNewsPostDto {
  @IsOptional() @IsIn(categories) category?: string;

  @IsOptional()
  @Transform(({value}) => typeof value === 'string' ? [value] : value)
  @IsArray() @ArrayMaxSize(100) @IsString({each:true})
  removePdfIds?: string[];

  @IsOptional()
  @Transform(({value}) => value === '' ? [] : typeof value === 'string' ? [value] : value)
  @IsArray() @ArrayMaxSize(20)
  @IsUrl({ protocols:['http','https'], require_protocol:true }, {each:true, message:'Cada enlace debe empezar por http:// o https://.'})
  @MaxLength(2048,{each:true})
  additionalLinks?: string[];

  @IsString()
  @MinLength(5)
  @MaxLength(140)
  title!: string;

  @IsString()
  @MinLength(20)
  @MaxLength(8000)
  summary!: string;

  @IsString()
  @IsOptional()
  @MaxLength(50_000)
  content?: string;

  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' && value.trim().length === 0 ? undefined : value)
  @IsString()
  @MaxLength(80)
  sourceLabel?: string;

  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' && value.trim().length === 0 ? undefined : value)
  @IsUrl({ require_tld: false, protocols: ['http', 'https'], require_protocol: true }, { message: 'El enlace externo debe ser una URL válida.' })
  @MaxLength(2048)
  externalUrl?: string;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  published?: boolean;
}
