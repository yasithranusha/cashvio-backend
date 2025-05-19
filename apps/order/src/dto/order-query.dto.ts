import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { OrderStatus } from '@prisma/client';

export class OrderQueryDto {
  @IsUUID()
  @IsOptional()
  shopId?: string;

  @IsUUID()
  @IsOptional()
  customerId?: string;

  @IsEnum(OrderStatus)
  @IsOptional()
  status?: OrderStatus;

  @IsString()
  @IsOptional()
  startDate?: string;

  @IsString()
  @IsOptional()
  endDate?: string;
}
