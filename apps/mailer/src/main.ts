import { NestFactory } from '@nestjs/core';
import { MailerModule } from './mailer.module';
import { RmqService } from '@app/common';

async function bootstrap() {
  const app = await NestFactory.create(MailerModule);
  const rmqService = app.get<RmqService>(RmqService);
  app.connectMicroservice(rmqService.getOptions('MAILER'));
  await app.startAllMicroservices();
}
bootstrap();
