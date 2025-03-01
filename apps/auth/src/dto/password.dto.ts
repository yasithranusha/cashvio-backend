import { IsString, IsNotEmpty, IsEmail, IsEnum } from 'class-validator';
import { Role } from '@prisma/client';

export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  password: string;

  @IsString()
  @IsNotEmpty()
  token: string;
}

export class ForgotPasswordDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsEnum(Role)
  role: Role;
}
