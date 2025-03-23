import { Type } from 'class-transformer';
import {
  IsOptional,
  IsString,
  IsISO8601,
  IsInt,
  Min,
  IsEnum,
  IsUrl,
  IsMobilePhone,
} from 'class-validator';
import { Role, Status } from '@prisma/client';

export class UpdateUserDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsISO8601()
  @IsOptional()
  dob?: Date;

  @IsOptional()
  @IsUrl()
  profileImage?: string;

  @IsOptional()
  @IsMobilePhone()
  contactNumber?: string;
}

export class GetAllUsers {
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

  @IsEnum(Role)
  @IsOptional()
  role?: Role;

  @IsEnum(Status)
  @IsOptional()
  status?: Status;
}
