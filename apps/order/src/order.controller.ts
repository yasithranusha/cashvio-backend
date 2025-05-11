import { Controller, Get } from '@nestjs/common';
import { OrderService } from './order.service';
import { Public, Roles } from '@app/common';
import { Role } from '@prisma/client';

@Controller('order')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Get()
  @Public()
  getHello(): string {
    return this.orderService.getHello();
  }

  @Get('protected')
  @Roles(Role.SHOP_STAFF)
  getProtected(): string {
    return 'This is a protected route';
  }
}
