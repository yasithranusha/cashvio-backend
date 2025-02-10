import { IsString, IsEmail, IsOptional, MinLength } from 'class-validator';

export class SellerRegisterDto {
  // User details
  @IsString()
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsOptional()
  dob?: Date;

  @IsOptional()
  @IsString()
  profileImage?: string;

  // Shop details
  @IsString()
  businessName: string;

  @IsString()
  address: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;

  @IsOptional()
  @IsString()
  shopLogo?: string;

  @IsOptional()
  @IsString()
  shopBanner?: string;
}
