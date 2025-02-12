import { Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { Prisma } from '@prisma/client';
import { IBaseRepository } from './base.repository';

export abstract class BasePrismaRepository<T> implements IBaseRepository<T> {
  protected abstract readonly logger: Logger;
  protected abstract readonly modelName: string;

  constructor(protected readonly prisma: PrismaService) {}

  async create<TResult = T>(
    data: any,
    include?: any,
    tx?: Prisma.TransactionClient,
  ): Promise<TResult> {
    try {
      const client = tx || this.prisma;
      return await client[this.modelName].create({
        data,
        include,
      });
    } catch (error) {
      this.logger.error(`Error creating ${this.modelName}`, error);
      throw error;
    }
  }

  async findOne(where: any, include?: any): Promise<T> {
    const record = await this.prisma[this.modelName].findUnique({
      where,
      include,
    });

    if (!record) {
      this.logger.warn(`${this.modelName} not found`, where);
      throw new NotFoundException(`${this.modelName} not found`);
    }

    return record;
  }

  async findMany(params: {
    skip?: number;
    take?: number;
    where?: any;
    orderBy?: any;
    include?: any;
  }): Promise<T[]> {
    try {
      return await this.prisma[this.modelName].findMany(params);
    } catch (error) {
      this.logger.error(`Error finding ${this.modelName}s`, error);
      throw error;
    }
  }

  async update(where: any, data: any, include?: any): Promise<T> {
    try {
      return await this.prisma[this.modelName].update({
        where,
        data,
        include,
      });
    } catch (error) {
      this.logger.error(`Error updating ${this.modelName}`, error);
      throw error;
    }
  }

  async delete(where: any): Promise<T> {
    try {
      return await this.prisma[this.modelName].delete({
        where,
      });
    } catch (error) {
      this.logger.error(`Error deleting ${this.modelName}`, error);
      throw error;
    }
  }

  async executeTransaction<TResult>(
    callback: (tx: Prisma.TransactionClient) => Promise<TResult>,
  ): Promise<TResult> {
    return this.prisma.$transaction(callback);
  }
}
