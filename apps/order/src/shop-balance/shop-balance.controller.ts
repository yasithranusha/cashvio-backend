import {
  Controller,
  Get,
  Param,
  Req,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { ShopBalanceService } from './shop-balance.service';
import { Roles } from '@app/common/auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('shop-balance')
export class ShopBalanceController {
  private readonly logger = new Logger(ShopBalanceController.name);

  constructor(private readonly shopBalanceService: ShopBalanceService) {}

  @Get(':shopId')
  @Roles(Role.SHOP_OWNER, Role.SHOP_STAFF)
  async getShopBalance(@Param('shopId') shopId: string, @Req() req) {
    this.logger.debug(`GET /shop-balance/${shopId}`);

    // Verify user has access to this shop
    const hasAccess = await this.shopBalanceService.verifyUserShopAccess(
      req.user.id,
      shopId,
    );

    if (!hasAccess) {
      throw new ForbiddenException('You do not have access to this shop');
    }

    return this.shopBalanceService.getShopBalance(shopId);
  }
}
