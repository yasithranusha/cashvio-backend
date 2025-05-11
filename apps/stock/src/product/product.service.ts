import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@app/common/database/prisma.service';
import {
  CreateProductDto,
  ProductWithStock,
  UpdateProductDto,
} from './dto/product.dto';
import { Product, ProductStatus, Prisma } from '@prisma/client';
import { PaginatedResponse } from '@app/common/types/response';

@Injectable()
export class ProductService {
  private readonly logger = new Logger(ProductService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createProduct(createProductDto: CreateProductDto): Promise<Product> {
    this.logger.debug(`Creating product: ${JSON.stringify(createProductDto)}`);

    try {
      // Verify shop exists
      const shop = await this.prisma.shop.findUnique({
        where: { id: createProductDto.shopId },
      });

      if (!shop) {
        throw new BadRequestException('Shop not found');
      }

      // If supplier ID is provided, verify it belongs to the shop
      if (createProductDto.supplierId) {
        const supplier = await this.prisma.supplier.findUnique({
          where: {
            id: createProductDto.supplierId,
            shopId: createProductDto.shopId,
          },
        });

        if (!supplier) {
          throw new BadRequestException(
            'Supplier not found or does not belong to this shop',
          );
        }
      }

      // Create product with proper typing
      const productData: Prisma.ProductCreateInput = {
        name: createProductDto.name,
        description: createProductDto.description,
        displayName: createProductDto.displayName,
        keepingUnits: createProductDto.keepingUnits,
        imageUrls: createProductDto.imageUrls || [],
        status: createProductDto.status || ProductStatus.ACTIVE,
        warrantyMonths: createProductDto.warrantyMonths,
        loyaltyPoints: createProductDto.loyaltyPoints,
        shop: { connect: { id: createProductDto.shopId } },
        ...(createProductDto.supplierId && {
          supplier: { connect: { id: createProductDto.supplierId } },
        }),
        ...(createProductDto.categoryId && {
          category: { connect: { id: createProductDto.categoryId } },
        }),
        ...(createProductDto.subCategoryId && {
          subCategory: { connect: { id: createProductDto.subCategoryId } },
        }),
        ...(createProductDto.subSubCategoryId && {
          subSubCategory: {
            connect: { id: createProductDto.subSubCategoryId },
          },
        }),
      };

      const product = await this.prisma.product.create({
        data: productData,
      });

      return product;
    } catch (error) {
      this.logger.error(
        `Error creating product: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async getProducts(
    shopId: string,
    page?: number,
    limit?: number,
    status?: ProductStatus,
    supplierId?: string,
    search?: string,
    categoryId?: string,
    subCategoryId?: string,
    subSubCategoryId?: string,
  ): Promise<PaginatedResponse<ProductWithStock>> {
    this.logger.debug(`Getting products for shop ${shopId}`);

    const where: Prisma.ProductWhereInput = { shopId };
    if (status) where.status = status;
    if (supplierId) where.supplierId = supplierId;
    if (categoryId) where.categoryId = categoryId;
    if (subCategoryId) where.subCategoryId = subCategoryId;
    if (subSubCategoryId) where.subSubCategoryId = subSubCategoryId;

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { displayName: { contains: search, mode: 'insensitive' } },
      ];
    }

    try {
      const pageValue = page || 1;
      const limitValue = limit || 10;
      const skip = (pageValue - 1) * limitValue;

      const paginationOptions = {
        skip,
        take: limitValue,
      };

      const [products, total] = await Promise.all([
        this.prisma.product.findMany({
          where,
          ...paginationOptions,
          orderBy: { createdAt: 'desc' },
          include: {
            supplier: true,
            category: {
              select: { id: true, name: true },
            },
            subCategory: {
              select: { id: true, name: true, categoryId: true },
            },
            subSubCategory: {
              select: { id: true, name: true, subCategoryId: true },
            },
            _count: {
              select: { items: true },
            },
          },
        }),
        this.prisma.product.count({ where }),
      ]);

      // Add stock information to each product
      const productsWithStock = products.map((product) => ({
        ...product,
        stock: product._count?.items || 0,
      }));

      return {
        data: productsWithStock,
        pagination: {
          total,
          page: pageValue,
          limit: limitValue,
          totalPages: limitValue > 0 ? Math.ceil(total / limitValue) : 1,
        },
      };
    } catch (error) {
      this.logger.error(
        `Error getting products: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async updateProduct(
    id: string,
    updateProductDto: UpdateProductDto,
  ): Promise<Product> {
    this.logger.debug(
      `Updating product ${id}: ${JSON.stringify(updateProductDto)}`,
    );

    try {
      const product = await this.prisma.product.findUnique({
        where: { id },
        select: { shopId: true },
      });

      if (!product) {
        throw new NotFoundException('Product not found');
      }

      // If supplier ID is provided, verify it belongs to the shop
      if (updateProductDto.supplierId) {
        const supplier = await this.prisma.supplier.findUnique({
          where: {
            id: updateProductDto.supplierId,
            shopId: product.shopId,
          },
        });

        if (!supplier) {
          throw new BadRequestException(
            'Supplier not found or does not belong to this shop',
          );
        }
      }

      // Create properly typed update data
      const updateData: Prisma.ProductUpdateInput = {};

      if (updateProductDto.name !== undefined)
        updateData.name = updateProductDto.name;
      if (updateProductDto.description !== undefined)
        updateData.description = updateProductDto.description;
      if (updateProductDto.displayName !== undefined)
        updateData.displayName = updateProductDto.displayName;
      if (updateProductDto.keepingUnits !== undefined)
        updateData.keepingUnits = updateProductDto.keepingUnits;
      if (updateProductDto.imageUrls !== undefined)
        updateData.imageUrls = updateProductDto.imageUrls;
      if (updateProductDto.status !== undefined)
        updateData.status = updateProductDto.status;

      if (updateProductDto.supplierId !== undefined) {
        updateData.supplier = updateProductDto.supplierId
          ? { connect: { id: updateProductDto.supplierId } }
          : { disconnect: true };
      }

      if (updateProductDto.categoryId !== undefined) {
        updateData.category = updateProductDto.categoryId
          ? { connect: { id: updateProductDto.categoryId } }
          : { disconnect: true };
      }

      if (updateProductDto.subCategoryId !== undefined) {
        updateData.subCategory = updateProductDto.subCategoryId
          ? { connect: { id: updateProductDto.subCategoryId } }
          : { disconnect: true };
      }

      if (updateProductDto.subSubCategoryId !== undefined) {
        updateData.subSubCategory = updateProductDto.subSubCategoryId
          ? { connect: { id: updateProductDto.subSubCategoryId } }
          : { disconnect: true };
      }

      if (updateProductDto.warrantyMonths !== undefined)
        updateData.warrantyMonths = updateProductDto.warrantyMonths;

      if (updateProductDto.loyaltyPoints !== undefined)
        updateData.loyaltyPoints = updateProductDto.loyaltyPoints;

      const updatedProduct = await this.prisma.product.update({
        where: { id },
        data: updateData,
      });

      return updatedProduct;
    } catch (error) {
      this.logger.error(
        `Error updating product: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async getProductById(id: string): Promise<ProductWithStock> {
    this.logger.debug(`Getting product ${id}`);

    try {
      const product = await this.prisma.product.findUnique({
        where: { id },
        include: {
          supplier: true,
          category: true,
          subCategory: true,
          subSubCategory: true,
          _count: {
            select: { items: true },
          },
        },
      });

      if (!product) {
        throw new NotFoundException('Product not found');
      }

      // Add stock information to the product
      const productWithStock: ProductWithStock = {
        ...product,
        stock: product._count?.items || 0,
      };

      return productWithStock;
    } catch (error) {
      this.logger.error(`Error getting product: ${error.message}`, error.stack);
      throw error;
    }
  }

  async deleteProduct(id: string, cascade: boolean = false): Promise<Product> {
    this.logger.debug(`Deleting product ${id} with cascade: ${cascade}`);

    try {
      const product = await this.prisma.product.findUnique({
        where: { id },
        include: {
          items: true,
        },
      });

      if (!product) {
        throw new NotFoundException('Product not found');
      }

      // If product has items but cascade is false, prevent deletion
      if (!cascade && product.items.length > 0) {
        throw new BadRequestException(
          `Cannot delete product with ${product.items.length} items. Use cascade delete or remove items first.`,
        );
      }

      // Start a transaction to ensure data consistency
      return this.prisma.$transaction(async (tx) => {
        // If cascade is true, delete all related items first
        if (cascade && product.items.length > 0) {
          await tx.item.deleteMany({
            where: { productId: id },
          });
        }

        // Now delete the product
        return tx.product.delete({
          where: { id },
        });
      });
    } catch (error) {
      if (
        error instanceof BadRequestException ||
        error instanceof NotFoundException
      ) {
        throw error;
      }

      // Handle other database errors
      this.logger.error(
        `Error deleting product: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException('Failed to delete product');
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

  async getUserShopRole(userId: string, shopId: string) {
    return this.prisma.userShop.findUnique({
      where: {
        userId_shopId: {
          userId,
          shopId,
        },
      },
    });
  }

  async findSupplier(supplierId: string) {
    return this.prisma.supplier.findUnique({
      where: { id: supplierId },
    });
  }
}
