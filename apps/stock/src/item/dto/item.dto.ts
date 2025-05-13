import { Type } from 'class-transformer';
import {
  IsString,
  IsOptional,
  IsNumber,
  IsPositive,
  IsDate,
  IsNotEmpty,
  IsInt,
  Min,
} from 'class-validator';

export class CreateItemDto {
  @IsString()
  @IsNotEmpty()
  barcode: string;

  @IsNumber()
  @IsPositive()
  broughtPrice: number;

  @IsNumber()
  @IsPositive()
  sellPrice: number;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  warrantyPeriod?: Date;

  @IsString()
  @IsNotEmpty()
  productId: string;
}

export class UpdateItemDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  barcode?: string;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  broughtPrice?: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  sellPrice?: number;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  warrantyPeriod?: Date;
}

export class GetItemsDto {
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
  @IsNotEmpty()
  productId: string;
}

// Type interfaces for use with Prisma
export interface ItemCreateInput {
  barcode: string;
  broughtPrice: string;
  sellPrice: string;
  warrantyPeriod?: Date;
  productId: string;
}

export interface ItemUpdateInput {
  barcode?: string;
  broughtPrice?: string;
  sellPrice?: string;
  warrantyPeriod?: Date;
}
