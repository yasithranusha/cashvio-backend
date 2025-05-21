import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  IsEmail,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PaymentMethod } from '@prisma/client';

// Enum definitions to replace imports from @prisma/client
export enum DiscountType {
  PERCENTAGE = 'PERCENTAGE',
  FIXED = 'FIXED',
}

export class OrderItemDto {
  @IsUUID()
  @IsNotEmpty()
  productId: string;

  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty()
  barcodes: string[];

  @IsNumber()
  @Min(0)
  customPrice: number;
}

export class PaymentDto {
  @IsNumber()
  @Min(0)
  amount: number;

  @IsEnum(PaymentMethod)
  method: PaymentMethod;

  @IsString()
  @IsOptional()
  reference?: string;
}

export class CreateOrderDto {
  @IsOptional()
  @IsString()
  shopId?: string;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  customerName?: string;

  @IsOptional()
  @IsEmail()
  customerEmail?: string;

  @IsOptional()
  @IsString()
  customerPhone?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  @IsOptional()
  items: OrderItemDto[] = [];

  @IsNumber()
  @IsOptional()
  discount?: number;

  @IsEnum(DiscountType)
  @IsOptional()
  discountType?: DiscountType;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PaymentDto)
  payments: PaymentDto[];

  @IsString()
  @IsOptional()
  note?: string;

  @IsNumber()
  @Min(0)
  @IsOptional()
  duePaidAmount?: number;

  @IsNumber()
  @IsOptional()
  extraWalletAmount?: number;

  @IsBoolean()
  @IsOptional()
  draft?: boolean;

  @IsBoolean()
  @IsOptional()
  sendReceiptEmail?: boolean;

  @IsBoolean()
  @IsOptional()
  print?: boolean;
}
