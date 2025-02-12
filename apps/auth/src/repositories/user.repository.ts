import { Injectable, Logger } from '@nestjs/common';
import { BasePrismaRepository } from '@app/common/database/base.prisma.repository';
import { PrismaService } from '@app/common';
import { User } from '@prisma/client';

@Injectable()
export class UserRepository extends BasePrismaRepository<User> {
  protected readonly logger = new Logger(UserRepository.name);
  protected readonly modelName = 'user';

  constructor(prisma: PrismaService) {
    super(prisma);
  }

  async executeTransaction<T>(callback: (tx: any) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(callback);
  }
}
