import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';
import { DatabaseModule, RmqModule } from '@app/common';
import { MAILER_SERVICE } from './constants/services';
import { ShopRepository } from './repositories/shop.repository';
import { UserRepository } from './repositories/user.repository';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        DATABASE_URL: Joi.string().required(),
        RABBIT_MQ_URI: Joi.string().required(),
        RABBIT_MQ_MAILER_QUEUE: Joi.string().required(),
      }),
      envFilePath: ['.env', './apps/auth/.env'],
    }),
    DatabaseModule,
    RmqModule.register({ name: MAILER_SERVICE }),
    UsersModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, ShopRepository, UserRepository],
})
export class AuthModule {}
