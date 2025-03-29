import { NestFactory } from '@nestjs/core';
import { MailerModule } from './mailer.module';
import { ValidationPipe } from '@nestjs/common';
import { RmqService } from '@app/common';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(MailerModule);
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
    }),
  );

  // Enable CORS
  app.enableCors();

  const configService = app.get<ConfigService>(ConfigService);

  const rmqService = app.get<RmqService>(RmqService);
  app.connectMicroservice(rmqService.getOptions('MAILER'));
  await app.startAllMicroservices();

  const port = configService.get('PORT') || 3001;
  await app.listen(port);
  console.log(`Mailer Uploader service running on port ${port}`);
}
bootstrap();
