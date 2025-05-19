import { Module } from '@nestjs/common';
import { CustomerOrderController } from './customer-order.controller';
import { CustomerOrderService } from './customer-order.service';
import { DatabaseModule } from '@app/common';

@Module({
  imports: [DatabaseModule],
  controllers: [CustomerOrderController],
  providers: [CustomerOrderService],
  exports: [CustomerOrderService],
})
export class CustomerOrderModule {}
