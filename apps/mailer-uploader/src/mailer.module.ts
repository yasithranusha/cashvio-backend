import { Module } from '@nestjs/common';
import { MailerController } from './mailer.controller';
import { MailerService } from './mailer.service';
import { RmqModule } from '@app/common';
import * as Joi from 'joi';
import { ConfigModule } from '@nestjs/config';
import { UploaderModule } from './uploader/uploader.module';

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
        // AWS S3 Configuration
        AWS_ACCESS_KEY: Joi.string().required(),
        AWS_SECRET_KEY: Joi.string().required(),
        AWS_S3_REGION: Joi.string().required(),
        AWS_BUCKET_NAME: Joi.string().required(),
      }),
      envFilePath: ['.env'],
    }),
    RmqModule,
    UploaderModule,
  ],
  controllers: [MailerController],
  providers: [MailerService],
})
export class MailerModule {}
