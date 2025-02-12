import { Prisma } from '@prisma/client';

export interface IBaseRepository<T> {
  create<TResult = T>(data: any, include?: any, tx?: any): Promise<TResult>;
  findOne(where: any, include?: any): Promise<T>;
  findMany(params: {
    skip?: number;
    take?: number;
    where?: any;
    orderBy?: any;
    include?: any;
  }): Promise<T[]>;
  update(where: any, data: any, include?: any): Promise<T>;
  delete(where: any): Promise<T>;
  executeTransaction<TResult>(
    callback: (tx: Prisma.TransactionClient) => Promise<TResult>,
  ): Promise<TResult>;
}
