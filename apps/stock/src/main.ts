import { NestFactory } from '@nestjs/core';
import { StockModule } from './stock.module';
import { ValidationPipe } from '@nestjs/common';
import { RmqService } from '@app/common';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(StockModule);
  app.useGlobalPipes(new ValidationPipe());

  const configService = app.get<ConfigService>(ConfigService);
  const rmqService = app.get<RmqService>(RmqService);

  // Connect to RabbitMQ as a microservice
  app.connectMicroservice(rmqService.getOptions('STOCK'));

  // Start microservices
  await app.startAllMicroservices();

  // Start HTTP server
  const port = configService.get('PORT') || 3002;
  await app.listen(port);
  console.log(`Stock service running on port ${port}`);
}
bootstrap();
