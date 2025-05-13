import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Request,
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
}
