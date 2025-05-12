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
