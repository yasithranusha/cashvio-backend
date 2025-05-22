import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';
import { DatabaseModule, RmqModule } from '@app/common';
import { AuthModule } from '@app/common/auth/auth.module';
import { StockController } from './stock.controller';
import { StockService } from './stock.service';
import { SupplierModule } from './supplier/supplier.module';
import { ProductModule } from './product/product.module';
import { ItemModule } from './item/item.module';
import { CategoryModule } from './category/category.module';
import { DiscountModule } from './discount/discount.module';
import { CashflowModule } from './cashflow/cashflow.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        RABBIT_MQ_URI: Joi.string().required(),
        RABBIT_MQ_STOCK_QUEUE: Joi.string().required(),
        PORT: Joi.number().default(3002),
      }),
      envFilePath: ['./apps/stock/.env'],
    }),
    AuthModule,
    DatabaseModule,
    RmqModule,
    SupplierModule,
    ProductModule,
    ItemModule,
    CategoryModule,
    DiscountModule,
    CashflowModule,
  ],
  controllers: [StockController],
  providers: [StockService],
})
export class StockModule {}
