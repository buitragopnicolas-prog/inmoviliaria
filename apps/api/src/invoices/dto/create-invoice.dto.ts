import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayNotEmpty, IsArray, IsDateString, IsInt, IsString, Max, MaxLength, Min, ValidateNested } from 'class-validator';

export class InvoiceLineItemInputDto {
  @IsString()
  @MaxLength(64)
  itemId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  quantity!: number;
}

export class CreateInvoiceDto {
  @IsString()
  @MaxLength(64)
  leaseId!: string;

  @IsDateString()
  period!: string;

  @IsDateString()
  dueDate!: string;

  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => InvoiceLineItemInputDto)
  services!: InvoiceLineItemInputDto[];

  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => InvoiceLineItemInputDto)
  products: InvoiceLineItemInputDto[] = [];
}
