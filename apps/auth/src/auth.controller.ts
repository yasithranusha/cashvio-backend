import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SellerRegisterDto } from './dto/seller.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register/shop')
  async register(@Body() shopRegisterData: SellerRegisterDto) {
    return this.authService.createShopWithOwner(shopRegisterData);
  }
}
