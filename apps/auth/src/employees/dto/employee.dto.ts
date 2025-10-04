import { Type } from 'class-transformer';
import {
  IsString,
  IsOptional,
  IsISO8601,
  IsInt,
  Min,
  IsEnum,
  IsUUID,
  IsNumberString,
  MinLength,
} from 'class-validator';

// Employee Status Enum (will be replaced by Prisma generated enum after migration)
export enum EmployeeStatus {
  ACTIVE = 'ACTIVE',
  ON_LEAVE = 'ON_LEAVE',
  SUSPENDED = 'SUSPENDED',
  TERMINATED = 'TERMINATED',
}

export class CreateEmployeeDto {
  @IsUUID()
  userId: string;

  @IsUUID()
  shopId: string;

  @IsString()
  @MinLength(2)
  designation: string;

  @IsString()
  @IsOptional()
  department?: string;

  @IsNumberString()
  salary: string;

  @IsISO8601()
  hireDate: Date;

  @IsString()
  @IsOptional()
  emergencyContact?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpdateEmployeeDto {
  @IsString()
  @MinLength(2)
  @IsOptional()
  designation?: string;

  @IsString()
  @IsOptional()
  department?: string;

  @IsNumberString()
  @IsOptional()
  salary?: string;

  @IsISO8601()
  @IsOptional()
  hireDate?: Date;

  @IsEnum(EmployeeStatus)
  @IsOptional()
  status?: EmployeeStatus;

  @IsString()
  @IsOptional()
  emergencyContact?: string;

  @IsString()
  @IsOptional()
  address?: string;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class GetEmployeesDto {
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

  @IsUUID()
  @IsOptional()
  shopId?: string;

  @IsEnum(EmployeeStatus)
  @IsOptional()
  status?: EmployeeStatus;

  @IsString()
  @IsOptional()
  department?: string;

  @IsString()
  @IsOptional()
  search?: string; // Search by name or email
}

export class EmployeeResponseDto {
  id: string;
  userId: string;
  shopId: string;
  designation: string;
  department?: string;
  salary: string;
  hireDate: Date;
  status: EmployeeStatus;
  emergencyContact?: string;
  address?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  user?: {
    id: string;
    name: string;
    email: string;
    contactNumber?: string;
    profileImage?: string;
  };
  shop?: {
    id: string;
    businessName: string;
  };
}
