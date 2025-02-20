import { Body, Controller, Post, UseGuards, Request } from '@nestjs/common';
import { AuthService, ShopWithUsers } from './auth.service';
import { SellerRegisterDto } from './dto/seller.dto';
import { Public } from './decorators/public.decorator';
import { LocalAuthGuard } from './guards/local-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  async register(
    @Body() shopRegisterData: SellerRegisterDto,
  ): Promise<ShopWithUsers> {
    return this.authService.createShopWithOwner(shopRegisterData);
  }

  @Public()
  @Post('login')
  @UseGuards(LocalAuthGuard)
  async login(@Request() req) {
    return this.authService.signIn(req.user);
  }
}
