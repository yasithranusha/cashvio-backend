import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@app/common';

@Injectable()
export class StockService {
  private readonly logger = new Logger(StockService.name);

  constructor(private readonly prisma: PrismaService) {}

  getHello(): string {
    return 'Hello World!';
  }
}
