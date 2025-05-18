import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';
import { DatabaseModule, RmqModule } from '@app/common';
import { AuthModule } from '@app/common/auth/auth.module';
import {
  OrderController,
  ShopBalanceController,
  CustomerWalletController,
} from './order.controller';
import { OrderService } from './order.service';
import { PrismaService } from '@app/common/database/prisma.service';
import { MAILER_SERVICE } from './constants/services';
import { ReceiptPdfService } from './pdf/receipt-pdf.service';
import { validate } from './env.validation';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        RABBIT_MQ_URI: Joi.string().required(),
        RABBIT_MQ_ORDER_QUEUE: Joi.string().required(),
        RABBIT_MQ_MAILER_QUEUE: Joi.string().required(),
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
    RmqModule,
    RmqModule.register({ name: MAILER_SERVICE }),
  ],
  controllers: [
    OrderController,
    ShopBalanceController,
    CustomerWalletController,
  ],
  providers: [OrderService, PrismaService, ReceiptPdfService],
  exports: [OrderService, ReceiptPdfService],
})
export class OrderModule {}
