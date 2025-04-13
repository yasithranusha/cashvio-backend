import {
  Body,
  Controller,
  Post,
  UseGuards,
  Request,
  Get,
  Res,
  Logger,
} from '@nestjs/common';
import { AuthService, ShopWithUsers } from './auth.service';
import { SellerRegisterDto } from './dto/seller.dto';
import { Public } from './decorators/public.decorator';
import { LocalAuthGuard } from './guards/local-auth.guard';
import { RefreshAuthGuard } from './guards/refresh-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AdminCreateDto, GenerateOtpDto } from './dto/auth.dto';
import { GoogleAuthGuard } from './guards/google-auth.guard';
import { ForgotPasswordDto, ResetPasswordDto } from './dto/password.dto';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { UserRegisterDto } from './dto/user.dto';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Public()
  @Post('otp/generate')
  async generateOtp(@Body() { email, name }: GenerateOtpDto) {
    return this.authService.generateOtp(email, name);
  }

  @Public()
  @Post('register')
  async register(
    @Body() shopRegisterData: SellerRegisterDto,
  ): Promise<ShopWithUsers> {
    return this.authService.createShopWithOwner(shopRegisterData);
  }

  @Public()
  @Post('customer/register')
  async customerRegister(@Body() shopRegisterData: UserRegisterDto) {
    return this.authService.cerateCustomer(shopRegisterData);
  }

  @Public()
  @Post('login')
  @UseGuards(LocalAuthGuard)
  async login(@Request() req) {
    return this.authService.signIn(req.user);
  }

  @Public()
  @Post('refresh')
  @UseGuards(RefreshAuthGuard)
  async refreshTokens(@Request() req) {
    const userId = req.user.sub;
    const refreshToken = req.headers.authorization?.split(' ')[1];
    this.logger.debug(`Received refresh request for userId: ${userId}`);
    this.logger.debug(`Received refresh token: ${refreshToken}`);
    return this.authService.refreshTokens(userId, refreshToken);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(@Request() req) {
    await this.authService.logout(req.user.id);
    return { message: 'Logged out successfully' };
  }

  @Public()
  @Get('google/login')
  @UseGuards(GoogleAuthGuard)
  googleLogin() {
    // This route will redirect to Google
  }

  @Public()
  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  async googleCallback(@Request() req, @Res() res: Response) {
    const tokens = await this.authService.generateTokens(req.user, true);
    const clientUrl = this.configService.get('CUSTOMER_CLIENT_URL');

    res.redirect(
      `${clientUrl}/api/auth/callback?` +
        `accessToken=${tokens.accessToken}&` +
        `refreshToken=${tokens.refreshToken}&` +
        `userId=${tokens.user.id}&` +
        `email=${tokens.user.email}&` +
        `role=${tokens.user.role}`,
    );
  }

  @Public()
  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email, dto.role);
  }

  @Public()
  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.password);
  }

  @Public()
  @Post('admin/create')
  async createAdmin(@Body() dto: AdminCreateDto) {
    return this.authService.createAdminUser(dto);
  }
}
