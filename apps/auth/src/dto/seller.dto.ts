import { IsString, IsOptional } from 'class-validator';
import { UserRegisterDto } from './user.dto';

export class SellerRegisterDto extends UserRegisterDto {
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
