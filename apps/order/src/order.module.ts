import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';
import { DatabaseModule } from '@app/common';
import { AuthModule } from '@app/common';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { validate } from './env.validation';
import { CustomerOrderModule } from './customer-order/customer-order.module';
import { ShopBalanceModule } from './shop-balance/shop-balance.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        PORT: Joi.number().default(3003),
        AWS_REGION: Joi.string().default('us-east-1'),
        AWS_ACCESS_KEY_ID: Joi.string().required(),
        AWS_SECRET_ACCESS_KEY: Joi.string().required(),
        AWS_KMS_KEY_ID: Joi.string().optional(),
        AWS_KMS_KEY_ALIAS: Joi.string().optional(),
      }),
      envFilePath: ['./apps/order/.env'],
      validate,
    }),
    AuthModule,
    DatabaseModule,
    CustomerOrderModule,
    ShopBalanceModule,
  ],
  controllers: [OrderController],
  providers: [OrderService],
  exports: [OrderService],
})
export class OrderModule {}
