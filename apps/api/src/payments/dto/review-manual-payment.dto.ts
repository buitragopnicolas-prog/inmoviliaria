import { IsEnum, IsOptional, IsString, Length } from 'class-validator';

export enum ManualPaymentReviewDecision {
  CONFIRM = 'CONFIRM',
  REJECT = 'REJECT',
  REVIEW = 'REVIEW',
}

export class ReviewManualPaymentDto {
  @IsEnum(ManualPaymentReviewDecision)
  decision!: ManualPaymentReviewDecision;

  @IsOptional()
  @IsString()
  @Length(3, 500)
  note?: string;
}
