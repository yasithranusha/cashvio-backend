import { Type } from 'class-transformer';
import {
  IsString,
  IsOptional,
  IsEnum,
  IsInt,
  Min,
  IsUrl,
} from 'class-validator';
import { ProductStatus } from '@prisma/client';

export class CreateShopDto {
  @IsString()
  businessName: string;

  @IsString()
  address: string;

  @IsOptional()
  @IsUrl()
  shopLogo?: string;

  @IsOptional()
  @IsUrl()
  shopBanner?: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;
}

export class UpdateShopDto {
  @IsOptional()
  @IsString()
  businessName?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsUrl()
  shopLogo?: string;

  @IsOptional()
  @IsUrl()
  shopBanner?: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;
}

export class GetShopsDto {
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

  @IsEnum(ProductStatus)
  @IsOptional()
  status?: ProductStatus;
}
