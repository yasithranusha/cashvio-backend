import { Injectable, Logger } from '@nestjs/common';
import { AbstractRepository } from '@app/common';
import { PrismaService } from '@app/common';
import { Shop } from '@prisma/client';

@Injectable()
export class ShopRepository extends AbstractRepository<Shop> {
  protected readonly logger = new Logger(ShopRepository.name);

  constructor(prisma: PrismaService) {
    super(prisma);
  }

  async executeTransaction<T>(callback: (tx: any) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(callback);
  }
}
