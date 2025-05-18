import { Module } from '@nestjs/common';
import { ShopBalanceController } from './shop-balance.controller';
import { ShopBalanceService } from './shop-balance.service';
import { DatabaseModule } from '@app/common';

@Module({
  imports: [DatabaseModule],
  controllers: [ShopBalanceController],
  providers: [ShopBalanceService],
  exports: [ShopBalanceService],
})
export class ShopBalanceModule {}
