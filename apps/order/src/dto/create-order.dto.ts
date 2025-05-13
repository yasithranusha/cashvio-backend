import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

// Enum definitions to replace imports from @prisma/client
export enum DiscountType {
  PERCENTAGE = 'PERCENTAGE',
  FIXED = 'FIXED',
}

export enum PaymentMethod {
  CASH = 'CASH',
  CARD = 'CARD',
  BANK = 'BANK',
  WALLET = 'WALLET',
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
  @IsUUID()
  @IsOptional()
  customerId?: string;

  @IsString()
  @IsOptional()
  customerName?: string;

  @IsString()
  @IsOptional()
  customerEmail?: string;

  @IsString()
  @IsOptional()
  customerPhone?: string;

  @IsUUID()
  @IsOptional()
  shopId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];

  @IsNumber()
  @Min(0)
  total: number;

  @IsNumber()
  @Min(0)
  @IsOptional()
  discount?: number;

  @IsEnum(DiscountType)
  @IsOptional()
  discountType?: DiscountType;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PaymentDto)
  payments: PaymentDto[];

  @IsBoolean()
  @IsOptional()
  storeExtraInWallet?: boolean;

  @IsString()
  @IsOptional()
  note?: string;
}
