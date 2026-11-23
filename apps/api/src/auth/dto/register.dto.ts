import { ConsentInput } from '../../common/privacy.js';
import { IsEmail, IsIn, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class RegisterDto extends ConsentInput {
  @IsOptional() @IsIn(['TENANT','OWNER','SERVICES'])
  portal?: 'TENANT' | 'OWNER' | 'SERVICES';

  @IsString()
  @MinLength(3)
  @MaxLength(120)
  name!: string;

  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  @Matches(/^[+()\d\s-]*$/)
  phone?: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}
