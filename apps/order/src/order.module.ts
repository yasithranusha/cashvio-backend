import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';
import { DatabaseModule, RmqModule } from '@app/common';
import { AuthModule } from '@app/common/auth/auth.module';
import { OrderController } from './order.controller';
import { OrderService } from './order.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        RABBIT_MQ_URI: Joi.string().required(),
        RABBIT_MQ_ORDER_QUEUE: Joi.string().required(),
        PORT: Joi.number().default(3003),
        AWS_REGION: Joi.string().default('us-east-1'),
        AWS_ACCESS_KEY_ID: Joi.string().required(),
        AWS_SECRET_ACCESS_KEY: Joi.string().required(),
        AWS_KMS_KEY_ID: Joi.string().optional(),
        AWS_KMS_KEY_ALIAS: Joi.string().optional(),
      }),
      envFilePath: ['./apps/order/.env'],
    }),
    AuthModule,
    DatabaseModule,
    RmqModule,
  ],
  controllers: [OrderController],
  providers: [OrderService],
})
export class OrderModule {}
