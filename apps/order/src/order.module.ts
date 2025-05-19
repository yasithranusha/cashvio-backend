import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';
import { DatabaseModule, RmqModule } from '@app/common';
import { AuthModule } from '@app/common';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';
import { validate } from './env.validation';
import { CustomerOrderModule } from './customer-order/customer-order.module';
import { ShopBalanceModule } from './shop-balance/shop-balance.module';
import { MAILER_SERVICE } from './constants/services';
import { ReceiptPdfService } from './pdf/receipt-pdf.service';

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
        RABBIT_MQ_URI: Joi.string().required(),
        RABBIT_MQ_ORDER_QUEUE: Joi.string().required(),
        RABBIT_MQ_MAILER_QUEUE: Joi.string().required(),
      }),
      envFilePath: ['./apps/order/.env'],
      validate,
    }),
    AuthModule,
    DatabaseModule,
    RmqModule,
    RmqModule.register({ name: MAILER_SERVICE }),
    CustomerOrderModule,
    ShopBalanceModule,
  ],
  controllers: [OrderController],
  providers: [OrderService, ReceiptPdfService],
  exports: [OrderService],
})
export class OrderModule {}
