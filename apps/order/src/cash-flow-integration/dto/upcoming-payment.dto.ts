import {
  IsString,
  IsNotEmpty,
  IsDateString,
  IsOptional,
  IsBoolean,
} from 'class-validator';

export class CreateUpcomingPaymentDto {
  @IsString()
  @IsNotEmpty()
  description: string;

  @IsString()
  @IsNotEmpty()
  amount: string;

  @IsDateString()
  dueDate: string;

  @IsString()
  @IsNotEmpty()
  shopId: string;

  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;
}

export class UpdateUpcomingPaymentDto {
  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  amount?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;
}

export class GetUpcomingPaymentsDto {
  @IsString()
  @IsNotEmpty()
  shopId: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
