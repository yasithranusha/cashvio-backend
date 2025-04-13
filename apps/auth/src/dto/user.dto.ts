import {
  IsString,
  IsEmail,
  IsOptional,
  MinLength,
  IsMobilePhone,
  Length,
} from 'class-validator';

export class UserRegisterDto {
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

  @IsOptional()
  @IsMobilePhone()
  contactNumber?: string;

  @IsString()
  @Length(6, 6, { message: 'Invalid OTP' })
  otp: string;
}
