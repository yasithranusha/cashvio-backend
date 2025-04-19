import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@app/common/database/prisma.service';
import {
  CreateCategoryDto,
  GetCategoriesDto,
  UpdateCategoryDto,
} from './dto/category.dto';
import {
  CreateSubCategoryDto,
  GetShopSubCategoriesDto,
  UpdateSubCategoryDto,
} from './dto/subcategory.dto';
import {
  CreateSubSubCategoryDto,
  GetShopSubSubCategoriesDto,
  UpdateSubSubCategoryDto,
} from './dto/subsubcategory.dto';
import {
  Category,
  ProductStatus,
  SubCategory,
  SubSubCategory,
} from '@prisma/client';
import { PaginatedResponse } from '@app/common/types/response';

@Injectable()
export class CategoryService {
  private readonly logger = new Logger(CategoryService.name);

  constructor(private readonly prisma: PrismaService) {}

  // Category methods
  async createCategory(
    createCategoryDto: CreateCategoryDto,
  ): Promise<Category> {
    this.logger.debug(
      `Creating category: ${JSON.stringify(createCategoryDto)}`,
    );

    try {
      // Verify shop exists
      const shop = await this.prisma.shop.findUnique({
        where: { id: createCategoryDto.shopId },
      });

      if (!shop) {
        throw new BadRequestException('Shop not found');
      }

      const category = await this.prisma.category.create({
        data: {
          name: createCategoryDto.name,
          description: createCategoryDto.description,
          imageUrl: createCategoryDto.imageUrl,
          status: createCategoryDto.status || ProductStatus.ACTIVE,
          shopId: createCategoryDto.shopId,
        },
      });

      return category;
    } catch (error) {
      this.logger.error(
        `Error creating category: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async getCategories(
    query: GetCategoriesDto,
    shopid: string,
  ): Promise<PaginatedResponse<Category>> {
    this.logger.debug(`Getting categories for shop ${shopid}`);

    const where: any = { shopId: shopid };
    if (query.status) where.status = query.status;

    try {
      let paginationOptions = {};
      let page = 1;
      let limit = 10;

      if (query.page && query.limit) {
        page = query.page;
        limit = query.limit;
        paginationOptions = {
          skip: (page - 1) * limit,
          take: limit,
        };
      }

      const [categories, total] = await Promise.all([
        this.prisma.category.findMany({
          where,
          ...paginationOptions,
          orderBy: { name: 'asc' },
          include: {
            _count: {
              select: {
                products: true,
                subCategories: true,
              },
            },
          },
        }),
        this.prisma.category.count({ where }),
      ]);

      return {
        data: categories,
        pagination: {
          total,
          page,
          limit,
          totalPages: limit > 0 ? Math.ceil(total / limit) : 1,
        },
      };
    } catch (error) {
      this.logger.error(
        `Error getting categories: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async getCategoryById(id: string): Promise<Category> {
    this.logger.debug(`Getting category ${id}`);

    try {
      const category = await this.prisma.category.findUnique({
        where: { id },
        include: {
          subCategories: {
            where: { status: ProductStatus.ACTIVE },
            include: {
              subSubCategories: {
                where: { status: ProductStatus.ACTIVE },
              },
            },
          },
          _count: {
            select: { products: true },
          },
        },
      });

      if (!category) {
        throw new NotFoundException('Category not found');
      }

      return category;
    } catch (error) {
      this.logger.error(
        `Error getting category: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async updateCategory(
    id: string,
    updateCategoryDto: UpdateCategoryDto,
  ): Promise<Category> {
    this.logger.debug(
      `Updating category ${id}: ${JSON.stringify(updateCategoryDto)}`,
    );

    try {
      const category = await this.prisma.category.findUnique({
        where: { id },
      });

      if (!category) {
        throw new NotFoundException('Category not found');
      }

      const updatedCategory = await this.prisma.category.update({
        where: { id },
        data: updateCategoryDto,
      });

      return updatedCategory;
    } catch (error) {
      this.logger.error(
        `Error updating category: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async deleteCategory(id: string): Promise<Category> {
    this.logger.debug(`Soft deleting category ${id}`);

    try {
      const category = await this.prisma.category.findUnique({
        where: { id },
        include: {
          products: { select: { id: true }, take: 1 },
          subCategories: { select: { id: true }, take: 1 },
        },
      });

      if (!category) {
        throw new NotFoundException('Category not found');
      }

      // Check if has products or subcategories
      if (category.products.length > 0 || category.subCategories.length > 0) {
        // Soft delete by setting status to inactive
        return await this.prisma.category.update({
          where: { id },
          data: { status: ProductStatus.HIDE },
        });
      }

      // Hard delete if no dependencies
      return await this.prisma.category.delete({
        where: { id },
      });
    } catch (error) {
      this.logger.error(
        `Error deleting category: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  // SubCategory methods
  async createSubCategory(
    createSubCategoryDto: CreateSubCategoryDto,
  ): Promise<SubCategory> {
    this.logger.debug(
      `Creating subcategory: ${JSON.stringify(createSubCategoryDto)}`,
    );

    try {
      // Verify category exists
      const category = await this.prisma.category.findUnique({
        where: { id: createSubCategoryDto.categoryId },
      });

      if (!category) {
        throw new BadRequestException('Category not found');
      }

      const subCategory = await this.prisma.subCategory.create({
        data: {
          name: createSubCategoryDto.name,
          description: createSubCategoryDto.description,
          imageUrl: createSubCategoryDto.imageUrl,
          status: createSubCategoryDto.status || ProductStatus.ACTIVE,
          categoryId: createSubCategoryDto.categoryId,
        },
      });

      return subCategory;
    } catch (error) {
      this.logger.error(
        `Error creating subcategory: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async getShopSubCategories(
    query: GetShopSubCategoriesDto,
  ): Promise<PaginatedResponse<SubCategory>> {
    this.logger.debug(`Getting subcategories for shop ${query.shopId}`);

    // Create base where condition with shopId (joined through category)
    const where: any = {
      category: {
        shopId: query.shopId,
      },
    };

    // Add optional filters
    if (query.categoryId) {
      where.categoryId = query.categoryId;
    }

    if (query.status) {
      where.status = query.status;
    }

    try {
      let skip = 0;
      const page = query.page || 1;
      const limit = query.limit || 10;
      let take = undefined;

      // Only apply pagination if both page and limit are provided
      if (query.page && query.limit) {
        skip = (page - 1) * limit;
        take = limit;
      }

      const [subCategories, total] = await Promise.all([
        this.prisma.subCategory.findMany({
          where,
          skip,
          take,
          orderBy: { name: 'asc' },
          include: {
            category: {
              select: { id: true, name: true },
            },
            _count: {
              select: {
                products: true,
                subSubCategories: true,
              },
            },
          },
        }),
        this.prisma.subCategory.count({ where }),
      ]);

      return {
        data: subCategories,
        pagination: {
          total,
          page,
          limit,
          totalPages: limit > 0 ? Math.ceil(total / limit) : 1,
        },
      };
    } catch (error) {
      this.logger.error(
        `Error getting shop subcategories: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async getSubCategoryById(id: string): Promise<SubCategory> {
    this.logger.debug(`Getting subcategory ${id}`);

    try {
      const subCategory = await this.prisma.subCategory.findUnique({
        where: { id },
        include: {
          category: true,
          subSubCategories: {
            where: { status: ProductStatus.ACTIVE },
          },
          _count: {
            select: { products: true },
          },
        },
      });

      if (!subCategory) {
        throw new NotFoundException('Subcategory not found');
      }

      return subCategory;
    } catch (error) {
      this.logger.error(
        `Error getting subcategory: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async updateSubCategory(
    id: string,
    updateSubCategoryDto: UpdateSubCategoryDto,
  ): Promise<SubCategory> {
    this.logger.debug(
      `Updating subcategory ${id}: ${JSON.stringify(updateSubCategoryDto)}`,
    );

    try {
      const subCategory = await this.prisma.subCategory.findUnique({
        where: { id },
      });

      if (!subCategory) {
        throw new NotFoundException('Subcategory not found');
      }

      if (
        updateSubCategoryDto.categoryId &&
        updateSubCategoryDto.categoryId !== subCategory.categoryId
      ) {
        const newCategory = await this.prisma.category.findUnique({
          where: { id: updateSubCategoryDto.categoryId },
        });

        if (!newCategory) {
          throw new BadRequestException('New parent category not found');
        }

        const oldCategory = await this.prisma.category.findUnique({
          where: { id: subCategory.categoryId },
          select: { shopId: true },
        });

        if (oldCategory && oldCategory.shopId !== newCategory.shopId) {
          throw new BadRequestException(
            'Cannot move subcategory to a different shop',
          );
        }
      }

      const updatedSubCategory = await this.prisma.subCategory.update({
        where: { id },
        data: updateSubCategoryDto,
      });

      return updatedSubCategory;
    } catch (error) {
      this.logger.error(
        `Error updating subcategory: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async deleteSubCategory(id: string): Promise<SubCategory> {
    this.logger.debug(`Soft deleting subcategory ${id}`);

    try {
      const subCategory = await this.prisma.subCategory.findUnique({
        where: { id },
        include: {
          products: { select: { id: true }, take: 1 },
          subSubCategories: { select: { id: true }, take: 1 },
        },
      });

      if (!subCategory) {
        throw new NotFoundException('Subcategory not found');
      }

      // Check if has products or sub-subcategories
      if (
        subCategory.products.length > 0 ||
        subCategory.subSubCategories.length > 0
      ) {
        // Soft delete by setting status to inactive
        return await this.prisma.subCategory.update({
          where: { id },
          data: { status: ProductStatus.HIDE },
        });
      }

      // Hard delete if no dependencies
      return await this.prisma.subCategory.delete({
        where: { id },
      });
    } catch (error) {
      this.logger.error(
        `Error deleting subcategory: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  // SubSubCategory methods
  async createSubSubCategory(
    createSubSubCategoryDto: CreateSubSubCategoryDto,
  ): Promise<SubSubCategory> {
    this.logger.debug(
      `Creating sub-subcategory: ${JSON.stringify(createSubSubCategoryDto)}`,
    );

    try {
      // Verify subcategory exists
      const subCategory = await this.prisma.subCategory.findUnique({
        where: { id: createSubSubCategoryDto.subCategoryId },
      });

      if (!subCategory) {
        throw new BadRequestException('Subcategory not found');
      }

      const subSubCategory = await this.prisma.subSubCategory.create({
        data: {
          name: createSubSubCategoryDto.name,
          description: createSubSubCategoryDto.description,
          imageUrl: createSubSubCategoryDto.imageUrl,
          status: createSubSubCategoryDto.status || ProductStatus.ACTIVE,
          subCategoryId: createSubSubCategoryDto.subCategoryId,
        },
      });

      return subSubCategory;
    } catch (error) {
      this.logger.error(
        `Error creating sub-subcategory: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async getShopSubSubCategories(
    query: GetShopSubSubCategoriesDto,
  ): Promise<PaginatedResponse<SubSubCategory>> {
    this.logger.debug(`Getting sub-subcategories for shop ${query.shopId}`);

    // Create base where condition with shopId (joined through category->subcategory)
    const where: any = {
      subCategory: {
        category: {
          shopId: query.shopId,
        },
      },
    };

    // Add optional filters
    if (query.subCategoryId) {
      where.subCategoryId = query.subCategoryId;
    }

    if (query.status) {
      where.status = query.status;
    }

    try {
      let skip = 0;
      const page = query.page || 1;
      const limit = query.limit || 10;
      let take = undefined;

      // Only apply pagination if both page and limit are provided
      if (query.page && query.limit) {
        skip = (page - 1) * limit;
        take = limit;
      }

      const [subSubCategories, total] = await Promise.all([
        this.prisma.subSubCategory.findMany({
          where,
          skip,
          take,
          orderBy: { name: 'asc' },
          include: {
            subCategory: {
              select: {
                id: true,
                name: true,
                category: {
                  select: { id: true, name: true },
                },
              },
            },
            _count: {
              select: {
                products: true,
              },
            },
          },
        }),
        this.prisma.subSubCategory.count({ where }),
      ]);

      return {
        data: subSubCategories,
        pagination: {
          total,
          page,
          limit,
          totalPages: limit > 0 ? Math.ceil(total / limit) : 1,
        },
      };
    } catch (error) {
      this.logger.error(
        `Error getting shop sub-subcategories: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async getSubSubCategoryById(id: string): Promise<SubSubCategory> {
    this.logger.debug(`Getting sub-subcategory ${id}`);

    try {
      const subSubCategory = await this.prisma.subSubCategory.findUnique({
        where: { id },
        include: {
          subCategory: {
            include: {
              category: true,
            },
          },
          _count: {
            select: { products: true },
          },
        },
      });

      if (!subSubCategory) {
        throw new NotFoundException('Sub-subcategory not found');
      }

      return subSubCategory;
    } catch (error) {
      this.logger.error(
        `Error getting sub-subcategory: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async updateSubSubCategory(
    id: string,
    updateSubSubCategoryDto: UpdateSubSubCategoryDto,
  ): Promise<SubSubCategory> {
    this.logger.debug(
      `Updating sub-subcategory ${id}: ${JSON.stringify(updateSubSubCategoryDto)}`,
    );

    try {
      const subSubCategory = await this.prisma.subSubCategory.findUnique({
        where: { id },
      });

      if (!subSubCategory) {
        throw new NotFoundException('Sub-subcategory not found');
      }

      if (
        updateSubSubCategoryDto.subCategoryId &&
        updateSubSubCategoryDto.subCategoryId !== subSubCategory.subCategoryId
      ) {
        const newSubCategory = await this.prisma.subCategory.findUnique({
          where: { id: updateSubSubCategoryDto.subCategoryId },
          include: {
            category: { select: { shopId: true } },
          },
        });

        if (!newSubCategory) {
          throw new BadRequestException('New parent subcategory not found');
        }

        const oldSubCategory = await this.prisma.subCategory.findUnique({
          where: { id: subSubCategory.subCategoryId },
          include: {
            category: { select: { shopId: true } },
          },
        });

        if (
          oldSubCategory?.category.shopId !== newSubCategory.category.shopId
        ) {
          throw new BadRequestException(
            'Cannot move sub-subcategory to a different shop',
          );
        }
      }

      const updatedSubSubCategory = await this.prisma.subSubCategory.update({
        where: { id },
        data: updateSubSubCategoryDto,
      });

      return updatedSubSubCategory;
    } catch (error) {
      this.logger.error(
        `Error updating sub-subcategory: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async deleteSubSubCategory(id: string): Promise<SubSubCategory> {
    this.logger.debug(`Soft deleting sub-subcategory ${id}`);

    try {
      const subSubCategory = await this.prisma.subSubCategory.findUnique({
        where: { id },
        include: {
          products: { select: { id: true }, take: 1 },
        },
      });

      if (!subSubCategory) {
        throw new NotFoundException('Sub-subcategory not found');
      }

      // Check if has products
      if (subSubCategory.products.length > 0) {
        // Soft delete by setting status to inactive
        return await this.prisma.subSubCategory.update({
          where: { id },
          data: { status: ProductStatus.HIDE },
        });
      }

      // Hard delete if no dependencies
      return await this.prisma.subSubCategory.delete({
        where: { id },
      });
    } catch (error) {
      this.logger.error(
        `Error deleting sub-subcategory: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  // Helper methods
  async getCategoryShopId(categoryId: string): Promise<string> {
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
      select: { shopId: true },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return category.shopId;
  }

  async getSubCategoryShopId(subCategoryId: string): Promise<string> {
    const subCategory = await this.prisma.subCategory.findUnique({
      where: { id: subCategoryId },
      select: {
        category: {
          select: { shopId: true },
        },
      },
    });

    if (!subCategory || !subCategory.category) {
      throw new NotFoundException('Subcategory not found');
    }

    return subCategory.category.shopId;
  }

  async getSubSubCategoryShopId(subSubCategoryId: string): Promise<string> {
    const subSubCategory = await this.prisma.subSubCategory.findUnique({
      where: { id: subSubCategoryId },
      select: {
        subCategory: {
          select: {
            category: {
              select: { shopId: true },
            },
          },
        },
      },
    });

    if (
      !subSubCategory ||
      !subSubCategory.subCategory ||
      !subSubCategory.subCategory.category
    ) {
      throw new NotFoundException('Sub-subcategory not found');
    }

    return subSubCategory.subCategory.category.shopId;
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
}
