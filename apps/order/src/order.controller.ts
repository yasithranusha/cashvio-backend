import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Request,
  Patch,
} from '@nestjs/common';
import { OrderService } from './order.service';
import { CreateOrderDto, OrderQueryDto } from './dto';
import { Role } from '@prisma/client';
import { Roles } from '@app/common';

@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post()
  @Roles(Role.SHOP_OWNER, Role.SHOP_STAFF)
  createOrder(@Request() req, @Body() createOrderDto: CreateOrderDto) {
    return this.orderService.createOrder(req.user.id, createOrderDto);
  }

  @Get()
  @Roles(Role.SHOP_OWNER, Role.SHOP_STAFF)
  getOrders(@Request() req, @Query() query: OrderQueryDto) {
    return this.orderService.getOrders(req.user.id, query);
  }

  @Get(':id')
  @Roles(Role.SHOP_OWNER, Role.SHOP_STAFF)
  getOrderById(@Request() req, @Param('id') id: string) {
    return this.orderService.getOrderById(req.user.id, id);
  }

  @Patch(':id')
  @Roles(Role.SHOP_OWNER, Role.SHOP_STAFF)
  updateOrder(
    @Request() req,
    @Param('id') id: string,
    @Body() updateOrderDto: CreateOrderDto,
  ) {
    return this.orderService.updateOrder(req.user.id, id, updateOrderDto);
  }

  @Post('cleanup-items')
  @Roles(Role.SHOP_OWNER)
  cleanupOrphanedItems() {
    return this.orderService.cleanupOrphanedItems();
  }
}

@Controller('shop-balance')
export class ShopBalanceController {
  constructor(private readonly orderService: OrderService) {}

  @Get(':shopId')
  @Roles(Role.SHOP_OWNER, Role.SHOP_STAFF)
  getShopBalance(@Request() req, @Param('shopId') shopId: string) {
    return this.orderService.getShopBalance(shopId);
  }
}

@Controller('customer-wallet')
export class CustomerWalletController {
  constructor(private readonly orderService: OrderService) {}

  @Get('all/:customerId')
  @Roles(Role.SHOP_OWNER, Role.SHOP_STAFF)
  getCustomerWallets(@Request() req, @Param('customerId') customerId: string) {
    // Verify user has access to see this customer's data
    return this.orderService.getCustomerWalletsForAllShops(
      req.user.id,
      customerId,
    );
  }

  @Get(':shopId/:customerId')
  @Roles(Role.SHOP_OWNER, Role.SHOP_STAFF)
  getCustomerWallet(
    @Request() req,
    @Param('shopId') shopId: string,
    @Param('customerId') customerId: string,
  ) {
    return this.orderService.getCustomerWallet(customerId, shopId);
  }
}
