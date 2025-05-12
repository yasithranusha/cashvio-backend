import { NestFactory } from '@nestjs/core';
import { OrderModule } from './order.module';
import { ValidationPipe } from '@nestjs/common';
import { RmqService } from '@app/common';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(OrderModule);
  app.useGlobalPipes(new ValidationPipe());

  const configService = app.get<ConfigService>(ConfigService);
  const rmqService = app.get<RmqService>(RmqService);

  // Connect to RabbitMQ as a microservice
  app.connectMicroservice(rmqService.getOptions('ORDER'));

  // Start microservices
  await app.startAllMicroservices();

  // Start HTTP server
  const port = configService.get('PORT') || 3003;
  await app.listen(port);
  console.log(`Order service running on port ${port}`);
}
bootstrap();
