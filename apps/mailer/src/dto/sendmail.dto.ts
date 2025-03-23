import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class RecipientDto {
  @IsEmail()
  @IsNotEmpty()
  address: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsNotEmpty()
  variables: Record<string, string>;
}

export class SendMailDto {
  @IsOptional()
  @IsEmail()
  from?: string;

  @ValidateNested({ each: true })
  @Type(() => RecipientDto)
  @IsNotEmpty()
  recipients: RecipientDto[];

  @IsString()
  @IsNotEmpty()
  subject: string;

  @IsString()
  @IsNotEmpty()
  html: string;

  @IsOptional()
  @IsString()
  text?: string;
}
