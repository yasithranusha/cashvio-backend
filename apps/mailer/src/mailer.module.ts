import { Module } from '@nestjs/common';
import { MailerController } from './mailer.controller';
import { MailerService } from './mailer.service';
import { RmqModule } from '@app/common';
import * as Joi from 'joi';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        RABBIT_MQ_URI: Joi.string().required(),
        RABBIT_MQ_MAILER_QUEUE: Joi.string().required(),
        MAILER_EMAIL: Joi.string().required(),
        OAUTH_CLIENT_ID: Joi.string().required(),
        OAUTH_CLIENT_SECRET: Joi.string().required(),
        OAUTH_REFRESH_TOKEN: Joi.string().required(),
      }),
      envFilePath: ['.env'],
    }),
    RmqModule,
  ],
  controllers: [MailerController],
  providers: [MailerService],
})
export class MailerModule {}
