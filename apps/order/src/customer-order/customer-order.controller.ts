import {
  Controller,
  Get,
  Param,
  Req,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { CustomerOrderService } from './customer-order.service';
import { Roles } from '@app/common/auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('customer-orders')
export class CustomerOrderController {
  private readonly logger = new Logger(CustomerOrderController.name);

  constructor(private readonly customerOrderService: CustomerOrderService) {}

  @Get('all/:customerId/history')
  @Roles(Role.SHOP_OWNER, Role.SHOP_STAFF)
  async getAllShopsCustomerOrderHistory(
    @Param('customerId') customerId: string,
    @Req() req,
  ) {
    this.logger.debug(`GET /customer-orders/all/${customerId}/history`);

    return this.customerOrderService.getCustomerOrderHistoryForAllShops(
      req.user.id,
      customerId,
    );
  }

  @Get('all/:customerId/warranty')
  @Roles(Role.SHOP_OWNER, Role.SHOP_STAFF)
  async getAllShopsCustomerWarrantyItems(
    @Param('customerId') customerId: string,
    @Req() req,
  ) {
    this.logger.debug(`GET /customer-orders/all/${customerId}/warranty`);

    return this.customerOrderService.getCustomerWarrantyItemsForAllShops(
      req.user.id,
      customerId,
    );
  }

  @Get(':customerId/shop/:shopId/history')
  @Roles(Role.SHOP_STAFF)
  async getCustomerOrderHistory(
    @Param('customerId') customerId: string,
    @Param('shopId') shopId: string,
    @Req() req,
  ) {
    this.logger.debug(
      `GET /customer-orders/${customerId}/shop/${shopId}/history`,
    );

    // Verify user has access to this shop
    const hasAccess = await this.customerOrderService.verifyUserShopAccess(
      req.user.id,
      shopId,
    );

    if (!hasAccess) {
      throw new ForbiddenException('You do not have access to this shop');
    }

    return this.customerOrderService.getCustomerOrderHistory(
      customerId,
      shopId,
    );
  }

  @Get(':customerId/shop/:shopId/warranty')
  @Roles(Role.SHOP_STAFF)
  async getCustomerWarrantyItems(
    @Param('customerId') customerId: string,
    @Param('shopId') shopId: string,
    @Req() req,
  ) {
    this.logger.debug(
      `GET /customer-orders/${customerId}/shop/${shopId}/warranty`,
    );

    // Verify user has access to this shop
    const hasAccess = await this.customerOrderService.verifyUserShopAccess(
      req.user.id,
      shopId,
    );

    if (!hasAccess) {
      throw new ForbiddenException('You do not have access to this shop');
    }

    return this.customerOrderService.getCustomerWarrantyItems(
      customerId,
      shopId,
    );
  }
}
