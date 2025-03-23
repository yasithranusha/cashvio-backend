import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@app/common/database/prisma.service';
import {
  CreateSupplierDto,
  UpdateSupplierDto,
  GetSuppliersDto,
} from './dto/supplier.dto';
import { PaginatedResponse } from '@app/common/types/response';
import { Supplier } from '@prisma/client';

@Injectable()
export class SupplierService {
  private readonly logger = new Logger(SupplierService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createSupplier(dto: CreateSupplierDto): Promise<Supplier> {
    this.logger.debug(`Creating supplier: ${JSON.stringify(dto)}`);

    try {
      // Verify shop exists
      const shop = await this.prisma.shop.findUnique({
        where: { id: dto.shopId },
      });

      if (!shop) {
        throw new BadRequestException('Shop not found');
      }

      return await this.prisma.supplier.create({
        data: {
          name: dto.name,
          contactNumber: dto.contactNumber,
          shopId: dto.shopId,
        },
      });
    } catch (error) {
      this.logger.error(
        `Error creating supplier: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async getSuppliers(
    query: GetSuppliersDto,
  ): Promise<PaginatedResponse<Supplier>> {
    this.logger.debug(`Getting suppliers for shop ${query.shopId}`);

    const skip = (query.page - 1) * query.limit;

    try {
      const [suppliers, total] = await Promise.all([
        this.prisma.supplier.findMany({
          where: { shopId: query.shopId },
          skip,
          take: query.limit,
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.supplier.count({
          where: { shopId: query.shopId },
        }),
      ]);

      return {
        data: suppliers,
        pagination: {
          total,
          page: query.page,
          limit: query.limit,
          totalPages: Math.ceil(total / query.limit),
        },
      };
    } catch (error) {
      this.logger.error(
        `Error getting suppliers: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async getSupplierById(id: string): Promise<Supplier> {
    this.logger.debug(`Getting supplier ${id}`);

    try {
      const supplier = await this.prisma.supplier.findUnique({
        where: { id },
      });

      if (!supplier) {
        throw new NotFoundException('Supplier not found');
      }

      return supplier;
    } catch (error) {
      this.logger.error(
        `Error getting supplier: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async updateSupplier(id: string, dto: UpdateSupplierDto): Promise<Supplier> {
    this.logger.debug(`Updating supplier ${id}: ${JSON.stringify(dto)}`);

    try {
      const supplier = await this.prisma.supplier.update({
        where: { id },
        data: {
          name: dto.name,
          contactNumber: dto.contactNumber,
        },
      });

      return supplier;
    } catch (error) {
      this.logger.error(
        `Error updating supplier: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async deleteSupplier(id: string): Promise<Supplier> {
    this.logger.debug(`Deleting supplier ${id}`);

    try {
      // Check if supplier exists
      const supplierExists = await this.prisma.supplier.findUnique({
        where: { id },
        include: { products: { select: { id: true }, take: 1 } },
      });

      if (!supplierExists) {
        throw new NotFoundException('Supplier not found');
      }

      // Check if supplier has products
      if (supplierExists.products.length > 0) {
        throw new BadRequestException(
          'Cannot delete supplier with associated products',
        );
      }

      const supplier = await this.prisma.supplier.delete({
        where: { id },
      });

      return supplier;
    } catch (error) {
      this.logger.error(
        `Error deleting supplier: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async verifyUserShopAccess(userId: string, shopId: string): Promise<boolean> {
    const userShop = await this.prisma.userShop.findUnique({
      where: {
        userId_shopId: {
          userId,
          shopId,
        },
      },
    });

    return !!userShop;
  }
}
