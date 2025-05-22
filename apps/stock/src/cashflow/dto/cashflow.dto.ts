import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsDate,
  IsInt,
  Min,
} from 'class-validator';
import { TransactionType } from '@prisma/client';
import { Type } from 'class-transformer';

// Enums that are not exported from Prisma client
export enum PaymentFrequency {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  ANNUALLY = 'ANNUALLY',
}

export enum PaymentType {
  ONE_TIME = 'ONE_TIME',
  RECURRING = 'RECURRING',
}

export enum TransactionCategory {
  SHOP_RENT = 'SHOP_RENT',
  UTILITIES = 'UTILITIES',
  STOCK_PURCHASE = 'STOCK_PURCHASE',
  STAFF_WAGES = 'STAFF_WAGES',
  MARKETING = 'MARKETING',
  SALES = 'SALES',
  SERVICE_FEES = 'SERVICE_FEES',
  DELIVERY_CHARGES = 'DELIVERY_CHARGES',
  VAT_PAYMENT = 'VAT_PAYMENT',
  INSURANCE = 'INSURANCE',
  EQUIPMENT = 'EQUIPMENT',
  INTERNET = 'INTERNET',
  POS_SYSTEM_FEE = 'POS_SYSTEM_FEE',
  OTHER = 'OTHER',
}

// Base Transaction DTO
export class BaseTransactionDto {
  @IsString()
  description: string;

  @IsString()
  amount: string;

  @IsDate()
  @Type(() => Date)
  date: Date;

  @IsString()
  shopId: string;

  @IsEnum(TransactionType)
  type: TransactionType;

  @IsEnum(TransactionCategory)
  category: TransactionCategory;

  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;
}

export class CreateTransactionDto extends BaseTransactionDto {
  @IsOptional()
  @IsEnum(PaymentFrequency)
  frequency?: PaymentFrequency;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  nextDate?: Date;
}

export class UpdateTransactionDto {
  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  amount?: string;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  date?: Date;

  @IsOptional()
  @IsEnum(TransactionType)
  type?: TransactionType;

  @IsOptional()
  @IsEnum(TransactionCategory)
  category?: TransactionCategory;

  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;
}

// Recurring Payment DTOs
export class BaseRecurringPaymentDto {
  @IsString()
  description: string;

  @IsString()
  amount: string;

  @IsEnum(PaymentFrequency)
  frequency: PaymentFrequency;

  @IsDate()
  @Type(() => Date)
  nextDate: Date;

  @IsString()
  shopId: string;
}

export class CreateRecurringPaymentDto extends BaseRecurringPaymentDto {
  @IsOptional()
  @IsString()
  transactionId?: string;
}

export class UpdateRecurringPaymentDto {
  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  amount?: string;

  @IsOptional()
  @IsEnum(PaymentFrequency)
  frequency?: PaymentFrequency;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  nextDate?: Date;
}

// Upcoming Payment DTOs
export class BaseUpcomingPaymentDto {
  @IsString()
  description: string;

  @IsString()
  amount: string;

  @IsDate()
  @Type(() => Date)
  dueDate: Date;

  @IsEnum(PaymentType)
  paymentType: PaymentType;

  @IsOptional()
  @IsBoolean()
  isPriority?: boolean;

  @IsString()
  shopId: string;
}

export class CreateUpcomingPaymentDto extends BaseUpcomingPaymentDto {}

export class UpdateUpcomingPaymentDto {
  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  amount?: string;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  dueDate?: Date;

  @IsOptional()
  @IsEnum(PaymentType)
  paymentType?: PaymentType;

  @IsOptional()
  @IsBoolean()
  isPriority?: boolean;
}

// Query DTOs
export class GetTransactionsDto {
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
  @IsEnum(TransactionType)
  type?: TransactionType;

  @IsOptional()
  @IsEnum(TransactionCategory)
  category?: TransactionCategory;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  startDate?: Date;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  endDate?: Date;
}

export class GetRecurringPaymentsDto {
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
  @IsEnum(PaymentFrequency)
  frequency?: PaymentFrequency;
}

export class GetUpcomingPaymentsDto {
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
  @IsEnum(PaymentType)
  paymentType?: PaymentType;

  @IsOptional()
  @IsBoolean()
  isPriority?: boolean;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  startDate?: Date;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  endDate?: Date;
}

// Response DTOs
export class CashflowSummaryDto {
  currentBalance: string;
  totalIncome: string;
  totalExpenses: string;
  projectedBalance: string;
  incomeGrowth: number;
  expenseGrowth: number;
  dailyTarget: string;
  dailyProgress: number;
  nextPaymentDue: number; // days until next payment
}
