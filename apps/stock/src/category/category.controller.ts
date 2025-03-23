import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Put,
  Delete,
  Req,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { CategoryService } from './category.service';
import {
  CreateCategoryDto,
  GetCategoriesDto,
  UpdateCategoryDto,
  CreateSubSubCategoryDto,
  GetSubSubCategoriesDto,
  UpdateSubSubCategoryDto,
} from './dto/category.dto';
import { Roles } from '@app/common/auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('categories')
export class CategoryController {
  private readonly logger = new Logger(CategoryController.name);

  constructor(private readonly categoryService: CategoryService) {}

  @Post()
  @Roles(Role.ADMIN, Role.SHOP_OWNER, Role.SHOP_STAFF)
  async createCategory(
    @Body() createCategoryDto: CreateCategoryDto,
    @Req() req,
  ) {
    this.logger.debug('POST /categories', createCategoryDto);

    // If no shopId provided, use default shop
    const shopId = createCategoryDto.shopId || req.user.defaultShopId;

    if (!shopId) {
      throw new BadRequestException('Shop ID is required');
    }

    // Verify user has access to this shop
    if (req.user.role !== Role.ADMIN) {
      const hasAccess = await this.categoryService.verifyUserShopAccess(
        req.user.id,
        shopId,
      );

      if (!hasAccess) {
        throw new ForbiddenException('You do not have access to this shop');
      }
    }

    return this.categoryService.createCategory({
      ...createCategoryDto,
      shopId,
    });
  }

  @Get()
  @Roles(Role.ADMIN, Role.SHOP_OWNER, Role.SHOP_STAFF)
  async getCategories(@Query() query: GetCategoriesDto, @Req() req) {
    this.logger.debug('GET /categories', query);

    // Get shop ID from query or default shop
    const shopId = query.shopId || req.user.defaultShopId;

    if (!shopId) {
      throw new BadRequestException('Shop ID is required');
    }

    // Verify user has access to this shop
    if (req.user.role !== Role.ADMIN) {
      const hasAccess = await this.categoryService.verifyUserShopAccess(
        req.user.id,
        shopId,
      );

      if (!hasAccess) {
        throw new ForbiddenException('You do not have access to this shop');
      }
    }

    return this.categoryService.getCategories(query);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.SHOP_OWNER, Role.SHOP_STAFF)
  async getCategoryById(@Param('id') id: string, @Req() req) {
    this.logger.debug(`GET /categories/${id}`);

    const category = await this.categoryService.getCategoryById(id);

    // Verify user has access to this category's shop
    if (req.user.role !== Role.ADMIN) {
      const hasAccess = await this.categoryService.verifyUserShopAccess(
        req.user.id,
        category.shopId,
      );

      if (!hasAccess) {
        throw new ForbiddenException('You do not have access to this category');
      }
    }

    return category;
  }

  @Put(':id')
  @Roles(Role.ADMIN, Role.SHOP_OWNER, Role.SHOP_STAFF)
  async updateCategory(
    @Param('id') id: string,
    @Body() updateCategoryDto: UpdateCategoryDto,
    @Req() req,
  ) {
    this.logger.debug(`PUT /categories/${id}`, updateCategoryDto);

    const category = await this.categoryService.getCategoryById(id);

    // Verify user has access to this category's shop
    if (req.user.role !== Role.ADMIN) {
      const hasAccess = await this.categoryService.verifyUserShopAccess(
        req.user.id,
        category.shopId,
      );

      if (!hasAccess) {
        throw new ForbiddenException('You do not have access to this category');
      }
    }

    return this.categoryService.updateCategory(id, updateCategoryDto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN, Role.SHOP_OWNER)
  async deleteCategory(@Param('id') id: string, @Req() req) {
    this.logger.debug(`DELETE /categories/${id}`);

    const category = await this.categoryService.getCategoryById(id);

    // Verify user has access to this category's shop
    if (req.user.role !== Role.ADMIN) {
      const hasAccess = await this.categoryService.verifyUserShopAccess(
        req.user.id,
        category.shopId,
      );

      if (!hasAccess) {
        throw new ForbiddenException('You do not have access to this category');
      }

      // For non-admins, verify they are shop owner
      const userShop = await this.categoryService.getUserShopRole(
        req.user.id,
        category.shopId,
      );

      if (!userShop || userShop.role !== Role.SHOP_OWNER) {
        throw new ForbiddenException('Only shop owners can delete categories');
      }
    }

    return this.categoryService.deleteCategory(id);
  }

  // SubCategory endpoints
  @Post(':categoryId/subcategories')
  @Roles(Role.ADMIN, Role.SHOP_OWNER, Role.SHOP_STAFF)
  async createSubCategory(
    @Param('categoryId') categoryId: string,
    @Body() createSubCategoryDto: CreateSubCategoryDto,
    @Req() req,
  ) {
    this.logger.debug(
      `POST /categories/${categoryId}/subcategories`,
      createSubCategoryDto,
    );

    // Get shop ID from category
    const shopId = await this.categoryService.getCategoryShopId(categoryId);

    // Verify user has access to this shop
    if (req.user.role !== Role.ADMIN) {
      const hasAccess = await this.categoryService.verifyUserShopAccess(
        req.user.id,
        shopId,
      );

      if (!hasAccess) {
        throw new ForbiddenException('You do not have access to this category');
      }
    }

    return this.categoryService.createSubCategory({
      ...createSubCategoryDto,
      categoryId,
    });
  }

  @Get(':categoryId/subcategories')
  @Roles(Role.ADMIN, Role.SHOP_OWNER, Role.SHOP_STAFF)
  async getSubCategories(
    @Param('categoryId') categoryId: string,
    @Query() query: GetSubCategoriesDto,
    @Req() req,
  ) {
    this.logger.debug(`GET /categories/${categoryId}/subcategories`, query);

    // Get shop ID from category
    const shopId = await this.categoryService.getCategoryShopId(categoryId);

    // Verify user has access to this shop
    if (req.user.role !== Role.ADMIN) {
      const hasAccess = await this.categoryService.verifyUserShopAccess(
        req.user.id,
        shopId,
      );

      if (!hasAccess) {
        throw new ForbiddenException('You do not have access to this category');
      }
    }

    return this.categoryService.getSubCategories({
      ...query,
      categoryId,
    });
  }

  @Get('subcategories/:id')
  @Roles(Role.ADMIN, Role.SHOP_OWNER, Role.SHOP_STAFF)
  async getSubCategoryById(@Param('id') id: string, @Req() req) {
    this.logger.debug(`GET /categories/subcategories/${id}`);

    const subCategory = await this.categoryService.getSubCategoryById(id);

    // Get shop ID from subcategory's parent category
    const shopId = await this.categoryService.getSubCategoryShopId(id);

    // Verify user has access to this shop
    if (req.user.role !== Role.ADMIN) {
      const hasAccess = await this.categoryService.verifyUserShopAccess(
        req.user.id,
        shopId,
      );

      if (!hasAccess) {
        throw new ForbiddenException(
          'You do not have access to this subcategory',
        );
      }
    }

    return subCategory;
  }

  @Put('subcategories/:id')
  @Roles(Role.ADMIN, Role.SHOP_OWNER, Role.SHOP_STAFF)
  async updateSubCategory(
    @Param('id') id: string,
    @Body() updateSubCategoryDto: UpdateSubCategoryDto,
    @Req() req,
  ) {
    this.logger.debug(
      `PUT /categories/subcategories/${id}`,
      updateSubCategoryDto,
    );

    // Get shop ID from subcategory's parent category
    const shopId = await this.categoryService.getSubCategoryShopId(id);

    // Verify user has access to this shop
    if (req.user.role !== Role.ADMIN) {
      const hasAccess = await this.categoryService.verifyUserShopAccess(
        req.user.id,
        shopId,
      );

      if (!hasAccess) {
        throw new ForbiddenException(
          'You do not have access to this subcategory',
        );
      }
    }

    return this.categoryService.updateSubCategory(id, updateSubCategoryDto);
  }

  @Delete('subcategories/:id')
  @Roles(Role.ADMIN, Role.SHOP_OWNER)
  async deleteSubCategory(@Param('id') id: string, @Req() req) {
    this.logger.debug(`DELETE /categories/subcategories/${id}`);

    // Get shop ID from subcategory's parent category
    const shopId = await this.categoryService.getSubCategoryShopId(id);

    // Verify user has access to this shop
    if (req.user.role !== Role.ADMIN) {
      const hasAccess = await this.categoryService.verifyUserShopAccess(
        req.user.id,
        shopId,
      );

      if (!hasAccess) {
        throw new ForbiddenException(
          'You do not have access to this subcategory',
        );
      }

      // For non-admins, verify they are shop owner
      const userShop = await this.categoryService.getUserShopRole(
        req.user.id,
        shopId,
      );

      if (!userShop || userShop.role !== Role.SHOP_OWNER) {
        throw new ForbiddenException(
          'Only shop owners can delete subcategories',
        );
      }
    }

    return this.categoryService.deleteSubCategory(id);
  }

  // SubSubCategory endpoints
  @Post('subcategories/:subCategoryId/subsubcategories')
  @Roles(Role.ADMIN, Role.SHOP_OWNER, Role.SHOP_STAFF)
  async createSubSubCategory(
    @Param('subCategoryId') subCategoryId: string,
    @Body() createSubSubCategoryDto: CreateSubSubCategoryDto,
    @Req() req,
  ) {
    this.logger.debug(
      `POST /categories/subcategories/${subCategoryId}/subsubcategories`,
      createSubSubCategoryDto,
    );

    // Get shop ID from subcategory's parent category
    const shopId =
      await this.categoryService.getSubCategoryShopId(subCategoryId);

    // Verify user has access to this shop
    if (req.user.role !== Role.ADMIN) {
      const hasAccess = await this.categoryService.verifyUserShopAccess(
        req.user.id,
        shopId,
      );

      if (!hasAccess) {
        throw new ForbiddenException(
          'You do not have access to this subcategory',
        );
      }
    }

    return this.categoryService.createSubSubCategory({
      ...createSubSubCategoryDto,
      subCategoryId,
    });
  }

  @Get('subcategories/:subCategoryId/subsubcategories')
  @Roles(Role.ADMIN, Role.SHOP_OWNER, Role.SHOP_STAFF)
  async getSubSubCategories(
    @Param('subCategoryId') subCategoryId: string,
    @Query() query: GetSubSubCategoriesDto,
    @Req() req,
  ) {
    this.logger.debug(
      `GET /categories/subcategories/${subCategoryId}/subsubcategories`,
      query,
    );

    // Get shop ID from subcategory's parent category
    const shopId =
      await this.categoryService.getSubCategoryShopId(subCategoryId);

    // Verify user has access to this shop
    if (req.user.role !== Role.ADMIN) {
      const hasAccess = await this.categoryService.verifyUserShopAccess(
        req.user.id,
        shopId,
      );

      if (!hasAccess) {
        throw new ForbiddenException(
          'You do not have access to this subcategory',
        );
      }
    }

    return this.categoryService.getSubSubCategories({
      ...query,
      subCategoryId,
    });
  }

  @Get('subsubcategories/:id')
  @Roles(Role.ADMIN, Role.SHOP_OWNER, Role.SHOP_STAFF)
  async getSubSubCategoryById(@Param('id') id: string, @Req() req) {
    this.logger.debug(`GET /categories/subsubcategories/${id}`);

    const subSubCategory = await this.categoryService.getSubSubCategoryById(id);

    // Get shop ID from subsubcategory's parent
    const shopId = await this.categoryService.getSubSubCategoryShopId(id);

    // Verify user has access to this shop
    if (req.user.role !== Role.ADMIN) {
      const hasAccess = await this.categoryService.verifyUserShopAccess(
        req.user.id,
        shopId,
      );

      if (!hasAccess) {
        throw new ForbiddenException(
          'You do not have access to this sub-subcategory',
        );
      }
    }

    return subSubCategory;
  }

  @Put('subsubcategories/:id')
  @Roles(Role.ADMIN, Role.SHOP_OWNER, Role.SHOP_STAFF)
  async updateSubSubCategory(
    @Param('id') id: string,
    @Body() updateSubSubCategoryDto: UpdateSubSubCategoryDto,
    @Req() req,
  ) {
    this.logger.debug(
      `PUT /categories/subsubcategories/${id}`,
      updateSubSubCategoryDto,
    );

    // Get shop ID from subsubcategory's parent
    const shopId = await this.categoryService.getSubSubCategoryShopId(id);

    // Verify user has access to this shop
    if (req.user.role !== Role.ADMIN) {
      const hasAccess = await this.categoryService.verifyUserShopAccess(
        req.user.id,
        shopId,
      );

      if (!hasAccess) {
        throw new ForbiddenException(
          'You do not have access to this sub-subcategory',
        );
      }
    }

    return this.categoryService.updateSubSubCategory(
      id,
      updateSubSubCategoryDto,
    );
  }

  @Delete('subsubcategories/:id')
  @Roles(Role.ADMIN, Role.SHOP_OWNER)
  async deleteSubSubCategory(@Param('id') id: string, @Req() req) {
    this.logger.debug(`DELETE /categories/subsubcategories/${id}`);

    // Get shop ID from subsubcategory's parent
    const shopId = await this.categoryService.getSubSubCategoryShopId(id);

    // Verify user has access to this shop
    if (req.user.role !== Role.ADMIN) {
      const hasAccess = await this.categoryService.verifyUserShopAccess(
        req.user.id,
        shopId,
      );

      if (!hasAccess) {
        throw new ForbiddenException(
          'You do not have access to this sub-subcategory',
        );
      }

      // For non-admins, verify they are shop owner
      const userShop = await this.categoryService.getUserShopRole(
        req.user.id,
        shopId,
      );

      if (!userShop || userShop.role !== Role.SHOP_OWNER) {
        throw new ForbiddenException(
          'Only shop owners can delete sub-subcategories',
        );
      }
    }

    return this.categoryService.deleteSubSubCategory(id);
  }
}
