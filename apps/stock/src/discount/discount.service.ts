import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@app/common/database/prisma.service';
import { Prisma, ProductStatus } from '@prisma/client';
import {
  CreateDiscountDto,
  UpdateDiscountDto,
  GetDiscountsDto,
  AssignProductsToDiscountDto,
  RemoveProductFromDiscountDto,
} from './dto/discount.dto';

@Injectable()
export class DiscountService {
  private readonly logger = new Logger(DiscountService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createDiscount(createDiscountDto: CreateDiscountDto) {
    this.logger.debug(
      `Creating discount: ${JSON.stringify(createDiscountDto)}`,
    );

    try {
      return await this.prisma.discount.create({
        data: {
          title: createDiscountDto.title,
          description: createDiscountDto.description,
          startDate: createDiscountDto.startDate,
          endDate: createDiscountDto.endDate,
          status: createDiscountDto.status || ProductStatus.ACTIVE,
        },
      });
    } catch (error) {
      this.logger.error(
        `Error creating discount: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async getDiscounts(getDiscountsDto: GetDiscountsDto) {
    const { page = 1, limit = 10, status } = getDiscountsDto;
    this.logger.debug(
      `Getting discounts with page=${page}, limit=${limit}, status=${status}`,
    );

    try {
      const skip = (page - 1) * limit;
      const where: Prisma.DiscountWhereInput = {};

      if (status) {
        where.status = status;
      }

      const [discounts, total] = await Promise.all([
        this.prisma.discount.findMany({
          where,
          skip,
          take: limit,
          include: {
            productDiscounts: {
              include: {
                product: {
                  select: {
                    id: true,
                    name: true,
                    imageUrls: true,
                  },
                },
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        }),
        this.prisma.discount.count({ where }),
      ]);

      // Format the response to include product details
      const formattedDiscounts = discounts.map((discount) => ({
        ...discount,
        products: discount.productDiscounts.map((pd) => ({
          id: pd.product.id,
          name: pd.product.name,
          imageUrl: pd.product.imageUrls?.[0] || '',
          percentage: pd.percentage,
        })),
        productDiscounts: undefined, // Remove the raw relation data
      }));

      return {
        data: formattedDiscounts,
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      this.logger.error(
        `Error getting discounts: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async getDiscountById(id: string) {
    this.logger.debug(`Getting discount ${id}`);

    try {
      const discount = await this.prisma.discount.findUnique({
        where: { id },
        include: {
          productDiscounts: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  imageUrls: true,
                },
              },
            },
          },
        },
      });

      if (!discount) {
        throw new NotFoundException(`Discount with ID ${id} not found`);
      }

      return {
        ...discount,
        products: discount.productDiscounts.map((pd) => ({
          id: pd.product.id,
          name: pd.product.name,
          imageUrl: pd.product.imageUrls?.[0] || '',
          percentage: pd.percentage,
        })),
        productDiscounts: undefined,
      };
    } catch (error) {
      this.logger.error(
        `Error getting discount: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async updateDiscount(id: string, updateDiscountDto: UpdateDiscountDto) {
    this.logger.debug(
      `Updating discount ${id}: ${JSON.stringify(updateDiscountDto)}`,
    );

    try {
      // First check if the discount exists
      const discount = await this.prisma.discount.findUnique({
        where: { id },
      });

      if (!discount) {
        throw new NotFoundException(`Discount with ID ${id} not found`);
      }

      return await this.prisma.discount.update({
        where: { id },
        data: {
          title: updateDiscountDto.title,
          description: updateDiscountDto.description,
          startDate: updateDiscountDto.startDate,
          endDate: updateDiscountDto.endDate,
          status: updateDiscountDto.status,
        },
      });
    } catch (error) {
      this.logger.error(
        `Error updating discount: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async deleteDiscount(id: string) {
    this.logger.debug(`Deleting discount ${id}`);

    try {
      // First check if the discount exists
      const discount = await this.prisma.discount.findUnique({
        where: { id },
      });

      if (!discount) {
        throw new NotFoundException(`Discount with ID ${id} not found`);
      }

      await this.prisma.discount.delete({
        where: { id },
      });

      return { success: true, message: 'Discount deleted successfully' };
    } catch (error) {
      this.logger.error(
        `Error deleting discount: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async assignProductsToDiscount(
    discountId: string,
    dto: AssignProductsToDiscountDto,
  ) {
    this.logger.debug(
      `Assigning products to discount ${discountId}: ${JSON.stringify(dto)}`,
    );

    try {
      // First check if the discount exists
      const discount = await this.prisma.discount.findUnique({
        where: { id: discountId },
      });

      if (!discount) {
        throw new NotFoundException(`Discount with ID ${discountId} not found`);
      }

      // Create all product discount assignments in a transaction
      await this.prisma.$transaction(
        dto.products.map((productDiscount) =>
          this.prisma.productDiscount.upsert({
            where: {
              productId_discountId: {
                productId: productDiscount.productId,
                discountId,
              },
            },
            update: {
              percentage: productDiscount.percentage,
            },
            create: {
              productId: productDiscount.productId,
              discountId,
              percentage: productDiscount.percentage,
            },
          }),
        ),
      );

      return {
        success: true,
        message: 'Products assigned to discount successfully',
      };
    } catch (error) {
      this.logger.error(
        `Error assigning products to discount: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async removeProductFromDiscount(
    discountId: string,
    dto: RemoveProductFromDiscountDto,
  ) {
    this.logger.debug(
      `Removing product from discount ${discountId}: ${JSON.stringify(dto)}`,
    );

    try {
      // First check if the association exists
      const productDiscount = await this.prisma.productDiscount.findUnique({
        where: {
          productId_discountId: {
            productId: dto.productId,
            discountId,
          },
        },
      });

      if (!productDiscount) {
        throw new NotFoundException(
          `Product with ID ${dto.productId} not found in discount ${discountId}`,
        );
      }

      await this.prisma.productDiscount.delete({
        where: {
          productId_discountId: {
            productId: dto.productId,
            discountId,
          },
        },
      });

      return {
        success: true,
        message: 'Product removed from discount successfully',
      };
    } catch (error) {
      this.logger.error(
        `Error removing product from discount: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async getActiveDiscountsForProduct(productId: string) {
    this.logger.debug(`Getting active discounts for product ${productId}`);

    try {
      const now = new Date();

      const productDiscounts = await this.prisma.productDiscount.findMany({
        where: {
          productId,
          discount: {
            status: ProductStatus.ACTIVE,
            startDate: { lte: now },
            endDate: { gte: now },
          },
        },
        include: {
          discount: true,
        },
      });

      return productDiscounts.map((pd) => ({
        discountId: pd.discountId,
        title: pd.discount.title,
        description: pd.discount.description,
        percentage: pd.percentage,
        startDate: pd.discount.startDate,
        endDate: pd.discount.endDate,
      }));
    } catch (error) {
      this.logger.error(
        `Error getting active discounts for product: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
