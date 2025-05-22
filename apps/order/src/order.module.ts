import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';
import { DatabaseModule, RmqModule } from '@app/common';
import { AuthModule } from '@app/common';
import {
  OrderController,
  ShopBalanceController,
  CustomerWalletController,
} from './order.controller';
import { OrderService } from './order.service';
import { validate } from './env.validation';
import { CustomerOrderModule } from './customer-order/customer-order.module';
import { ShopBalanceModule } from './shop-balance/shop-balance.module';
import { MAILER_SERVICE } from './constants/services';
import { ReceiptPdfService } from './pdf/receipt-pdf.service';
import { CashFlowIntegrationModule } from './cash-flow-integration/cash-flow-integration.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        AWS_REGION: Joi.string().default('us-east-1'),
        AWS_ACCESS_KEY_ID: Joi.string().required(),
        AWS_SECRET_ACCESS_KEY: Joi.string().required(),
        AWS_KMS_KEY_ID: Joi.string().optional(),
        AWS_KMS_KEY_ALIAS: Joi.string().optional(),
        RABBIT_MQ_URI: Joi.string().required(),
        RABBIT_MQ_ORDER_QUEUE: Joi.string().required(),
        RABBIT_MQ_MAILER_QUEUE: Joi.string().required(),
        STOCK_SERVICE_URL: Joi.string().default('http://localhost:3002'),
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
    forwardRef(() => CashFlowIntegrationModule),
  ],
  controllers: [
    OrderController,
    ShopBalanceController,
    CustomerWalletController,
  ],
  providers: [OrderService, ReceiptPdfService],
  exports: [OrderService],
})
export class OrderModule {}
