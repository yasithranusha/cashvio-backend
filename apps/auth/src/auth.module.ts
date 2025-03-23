import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import * as Joi from 'joi';
import { DatabaseModule, RmqModule } from '@app/common';
import { MAILER_SERVICE } from './constants/services';
import { UsersModule } from './users/users.module';
import { ScheduleModule } from '@nestjs/schedule';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtModule } from '@nestjs/jwt';
import { LocalStrategy } from './strategies/local.strategy';
import { RefreshStrategy } from './strategies/refresh.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { APP_GUARD } from '@nestjs/core';
import { RolesGuard } from './guards/roles.guard';
import jwtConfig from './config/jwt.config';
import refreshConfig from './config/refresh.config';
import forgetPassConfig from './config/forget-pass.config';
import googleOauthConfig from './config/google-oauth.config';
import { GoogleStrategy } from './strategies/google.strategy';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [jwtConfig, refreshConfig, forgetPassConfig, googleOauthConfig],
      validationSchema: Joi.object({
        DATABASE_URL: Joi.string().required(),
        RABBIT_MQ_URI: Joi.string().required(),
        RABBIT_MQ_MAILER_QUEUE: Joi.string().required(),
        JWT_SECRET: Joi.string().required(),
        JWT_EXPIRES_IN: Joi.string().required(),
        REFRESH_JWT_SECRET: Joi.string().required(),
        REFRESH_JWT_EXPIRES_IN: Joi.string().required(),
        REFRESH_JWT_EXTENDED_EXPIRES_IN: Joi.string().required(),
        GOOGLE_CLIENT_ID: Joi.string().required(),
        GOOGLE_CLIENT_SECRET: Joi.string().required(),
        GOOGLE_CALLBACK_URL: Joi.string().required(),
        FORGET_PASSWORD_SECRET: Joi.string().required(),
        FORGET_PASSWORD_EXPIRES_IN: Joi.string().required(),
        CLIENT_URL: Joi.string().required(),
      }),
      envFilePath: ['./apps/auth/.env'],
    }),
    JwtModule.registerAsync({
      useFactory: (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get('JWT_EXPIRES_IN'),
        },
      }),
      inject: [ConfigService],
    }),
    RmqModule.register({ name: MAILER_SERVICE }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    UsersModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    LocalStrategy,
    JwtStrategy,
    RefreshStrategy,
    GoogleStrategy,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AuthModule {}
