import { Type } from 'class-transformer';
import {
  IsString,
  IsOptional,
  IsInt,
  Min,
  IsEmail,
  IsBoolean,
} from 'class-validator';

export class CreateSupplierDto {
  @IsString()
  name: string;

  @IsString()
  contactNumber: string;

  @IsOptional()
  @IsEmail()
  email: string;

  @IsBoolean()
  haveWhatsApp: boolean;

  @IsString()
  shopId: string;
}

export class UpdateSupplierDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  contactNumber?: string;

  @IsOptional()
  @IsBoolean()
  haveWhatsApp?: boolean;

  @IsOptional()
  @IsEmail()
  email?: string;
}

export class GetSuppliersDto {
  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  page: number = 1;

  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  limit: number = 10;

  @IsString()
  shopId: string;
}
