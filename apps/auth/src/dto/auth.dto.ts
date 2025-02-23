import { IsEmail, IsString, MinLength } from 'class-validator';

export class SignInDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;
}
export class GenerateOtpDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(2)
  name: string;
}
