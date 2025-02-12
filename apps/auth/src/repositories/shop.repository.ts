import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@app/common';
import { Shop } from '@prisma/client';
import { BasePrismaRepository } from '@app/common';

@Injectable()
export class ShopRepository extends BasePrismaRepository<Shop> {
  protected readonly logger = new Logger(ShopRepository.name);
  protected readonly modelName = 'shop';

  constructor(prisma: PrismaService) {
    super(prisma);
  }

  async executeTransaction<T>(callback: (tx: any) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(callback, {
      maxWait: 10000, // 10 seconds max to wait for transaction
      timeout: 8000, // 8 seconds transaction timeout
    });
  }
}
