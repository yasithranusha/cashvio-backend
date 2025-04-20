import { Controller, Get } from '@nestjs/common';
import { StockService } from './stock.service';
import { Public, Roles } from '@app/common';
import { Role } from '@prisma/client';

@Controller('stock')
export class StockController {
  constructor(private readonly stockService: StockService) {}

  @Get()
  @Public()
  getHello(): string {
    return this.stockService.getHello();
  }

  @Get('protected')
  @Roles(Role.SHOP_STAFF)
  getProtected(): string {
    return 'This is a protected route';
  }
}
