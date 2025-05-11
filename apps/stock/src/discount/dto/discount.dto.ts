import { Type } from 'class-transformer';
import {
  IsString,
  IsOptional,
  IsDate,
  IsEnum,
  IsInt,
  Min,
  IsArray,
  ValidateNested,
  IsNumber,
  IsPositive,
} from 'class-validator';
import { ProductStatus } from '@prisma/client';

export class CreateDiscountDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsDate()
  @Type(() => Date)
  startDate: Date;

  @IsDate()
  @Type(() => Date)
  endDate: Date;

  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;
}

export class UpdateDiscountDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  startDate?: Date;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  endDate?: Date;

  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;
}

export class GetDiscountsDto {
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
  @IsEnum(ProductStatus)
  status?: ProductStatus;
}

export class ProductDiscountDto {
  @IsString()
  productId: string;

  @IsNumber()
  @IsPositive()
  percentage: number;
}

export class AssignProductsToDiscountDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductDiscountDto)
  products: ProductDiscountDto[];
}

export class RemoveProductFromDiscountDto {
  @IsString()
  productId: string;
}
