import { Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { Prisma } from '@prisma/client';

export type PrismaInclude = {
  [key: string]: boolean | { select: Record<string, boolean> };
};

export type ModelNames = Prisma.ModelName;

export abstract class AbstractRepository<TDocument> {
  protected abstract readonly logger: Logger;

  constructor(protected readonly prisma: PrismaService) {}

  async create<T extends TDocument>(
    model: string,
    data: Prisma.ShopCreateInput | Prisma.UserCreateInput,
    include?: PrismaInclude,
    tx?: Prisma.TransactionClient,
  ): Promise<T> {
    try {
      const client = tx || this.prisma;
      return (await client[model].create({
        data,
        include,
      })) as T;
    } catch (error) {
      this.logger.error('Error creating document', error);
      throw error;
    }
  }

  async findOne<T extends TDocument>(
    model: string,
    where: Partial<T>,
    include?: Record<string, boolean>,
  ): Promise<T> {
    const document = (await this.prisma[model].findUnique({
      where,
      include,
    })) as T;

    if (!document) {
      this.logger.warn('Document not found with query', where);
      throw new NotFoundException('Document not found.');
    }

    return document;
  }

  async findOneAndUpdate<T extends TDocument>(
    model: string,
    where: Partial<T>,
    data: Partial<T>,
    include?: Record<string, boolean>,
  ): Promise<T> {
    try {
      return (await this.prisma[model].update({
        where,
        data,
        include,
      })) as T;
    } catch (error) {
      this.logger.error('Error updating document', error);
      throw error;
    }
  }

  async find<T extends TDocument>(
    model: string,
    where: Partial<T>,
    include?: Record<string, boolean>,
  ): Promise<T[]> {
    return this.prisma[model].findMany({
      where,
      include,
    }) as T[];
  }

  async startTransaction() {
    return this.prisma.$transaction(async (prismaTransaction) => {
      return prismaTransaction;
    });
  }
}
