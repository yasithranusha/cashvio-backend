import {
  IsString,
  IsOptional,
  IsPositive,
  IsArray,
  IsEnum,
  IsInt,
  Min,
} from 'class-validator';
import { ProductStatus } from '@prisma/client';
import { Type } from 'class-transformer';

export class BaseProductDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  displayName?: string;

  @IsOptional()
  @IsInt()
  @IsPositive()
  keepingUnits?: number;

  @IsOptional()
  @IsArray()
  imageUrls?: string[];

  @IsOptional()
  @IsInt()
  warrantyMonths?: number;

  @IsOptional()
  @IsInt()
  loyaltyPoints?: number;

  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @IsOptional()
  @IsString()
  supplierId?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  subCategoryId?: string;

  @IsOptional()
  @IsString()
  subSubCategoryId?: string;
}

export class CreateProductDto extends BaseProductDto {
  @IsString()
  override name: string;

  @IsInt()
  @IsPositive()
  override keepingUnits: number;

  @IsString()
  shopId: string;
}

export class UpdateProductDto extends BaseProductDto {}

export class GetProductsDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  limit?: number = 10;

  @IsOptional()
  @IsString()
  shopId?: string;

  @IsOptional()
  @IsString()
  supplierId?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  subCategoryId?: string;

  @IsOptional()
  @IsString()
  subSubCategoryId?: string;

  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @IsOptional()
  @IsString()
  search?: string;
}
