import { IsIn } from 'class-validator';
import type { ContactStatus } from '../../generated/prisma/enums.js';

export class UpdateContactStatusDto {
  @IsIn(['NEW', 'REVIEWED', 'CLOSED'])
  status!: ContactStatus;
}
