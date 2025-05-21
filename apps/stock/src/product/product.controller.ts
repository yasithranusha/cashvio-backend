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
import { ProductService } from './product.service';
import {
  CreateProductDto,
  UpdateProductDto,
  GetProductsDto,
} from './dto/product.dto';
import { Roles } from '@app/common/auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('products')
export class ProductController {
  private readonly logger = new Logger(ProductController.name);

  constructor(private readonly productService: ProductService) {}

  @Post()
  @Roles(Role.ADMIN, Role.SHOP_OWNER, Role.SHOP_STAFF)
  async createProduct(@Body() createProductDto: CreateProductDto, @Req() req) {
    this.logger.debug('POST /products', createProductDto);

    // If no shopId provided, use default shop
    const shopId = createProductDto.shopId || req.user.defaultShopId;

    if (!shopId) {
      throw new BadRequestException('Shop ID is required');
    }

    // Verify user has access to this shop
    if (req.user.role !== Role.ADMIN) {
      const hasAccess = await this.productService.verifyUserShopAccess(
        req.user.id,
        shopId,
      );

      if (!hasAccess) {
        throw new ForbiddenException('You do not have access to this shop');
      }
    }

    return this.productService.createProduct({
      ...createProductDto,
      shopId,
    });
  }

  @Get()
  @Roles(Role.ADMIN, Role.SHOP_OWNER, Role.SHOP_STAFF)
  async getProducts(@Query() query: GetProductsDto, @Req() req) {
    this.logger.debug('GET /products', query);

    // Get shop ID from query or default shop
    const shopId = query.shopId || req.user.defaultShopId;

    if (!shopId) {
      throw new BadRequestException('Shop ID is required');
    }

    // Verify user has access to this shop
    if (req.user.role !== Role.ADMIN) {
      const hasAccess = await this.productService.verifyUserShopAccess(
        req.user.id,
        shopId,
      );

      if (!hasAccess) {
        throw new ForbiddenException('You do not have access to this shop');
      }
    }

    return this.productService.getProducts(
      shopId,
      query.page,
      query.limit,
      query.status,
      query.supplierId,
      query.search,
      query.categoryId,
      query.subCategoryId,
      query.subSubCategoryId,
    );
  }

  @Get('with-items')
  @Roles(Role.ADMIN, Role.SHOP_OWNER, Role.SHOP_STAFF)
  async getProductsWithItems(@Query() query: GetProductsDto, @Req() req) {
    this.logger.debug('GET /products/with-items', query);

    // Get shop ID from query or default shop
    const shopId = query.shopId || req.user.defaultShopId;

    if (!shopId) {
      throw new BadRequestException('Shop ID is required');
    }

    // Verify user has access to this shop
    if (req.user.role !== Role.ADMIN) {
      const hasAccess = await this.productService.verifyUserShopAccess(
        req.user.id,
        shopId,
      );

      if (!hasAccess) {
        throw new ForbiddenException('You do not have access to this shop');
      }
    }

    return this.productService.getProductsWithItems(
      shopId,
      query.page,
      query.limit,
      query.status,
      query.supplierId,
      query.search,
      query.categoryId,
      query.subCategoryId,
      query.subSubCategoryId,
    );
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.SHOP_OWNER, Role.SHOP_STAFF)
  async getProductById(@Param('id') id: string, @Req() req) {
    this.logger.debug(`GET /products/${id}`);

    const product = await this.productService.getProductById(id);

    // Verify user has access to this product's shop
    if (req.user.role !== Role.ADMIN) {
      const hasAccess = await this.productService.verifyUserShopAccess(
        req.user.id,
        product.shopId,
      );

      if (!hasAccess) {
        throw new ForbiddenException('You do not have access to this product');
      }
    }

    return product;
  }

  @Get(':id/items')
  @Roles(Role.ADMIN, Role.SHOP_OWNER, Role.SHOP_STAFF)
  async getProductWithItems(@Param('id') id: string, @Req() req) {
    this.logger.debug(`GET /products/${id}/items`);

    const product = await this.productService.getProductWithItems(id);

    // Verify user has access to this product's shop
    if (req.user.role !== Role.ADMIN) {
      const hasAccess = await this.productService.verifyUserShopAccess(
        req.user.id,
        product.shopId,
      );

      if (!hasAccess) {
        throw new ForbiddenException('You do not have access to this product');
      }
    }

    return product;
  }

  @Put(':id')
  @Roles(Role.ADMIN, Role.SHOP_OWNER, Role.SHOP_STAFF)
  async updateProduct(
    @Param('id') id: string,
    @Body() updateProductDto: UpdateProductDto,
    @Req() req,
  ) {
    this.logger.debug(`PUT /products/${id}`, updateProductDto);

    const product = await this.productService.getProductById(id);

    // Verify user has access to this product's shop
    if (req.user.role !== Role.ADMIN) {
      const hasAccess = await this.productService.verifyUserShopAccess(
        req.user.id,
        product.shopId,
      );

      if (!hasAccess) {
        throw new ForbiddenException('You do not have access to this product');
      }
    }

    return this.productService.updateProduct(id, updateProductDto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN, Role.SHOP_OWNER)
  async deleteProduct(
    @Param('id') id: string,
    @Query('cascade') cascade: boolean = false,
    @Req() req,
  ) {
    this.logger.debug(`DELETE /products/${id} (cascade: ${cascade})`);

    const product = await this.productService.getProductById(id);

    // Verify user has access to this product's shop
    if (req.user.role !== Role.ADMIN) {
      const hasAccess = await this.productService.verifyUserShopAccess(
        req.user.id,
        product.shopId,
      );

      if (!hasAccess) {
        throw new ForbiddenException('You do not have access to this product');
      }

      // For non-admins, verify they are shop owner
      const userShop = await this.productService.getUserShopRole(
        req.user.id,
        product.shopId,
      );

      if (!userShop || userShop.role !== Role.SHOP_OWNER) {
        throw new ForbiddenException('Only shop owners can delete products');
      }

      // Only admins can do cascade deletes that remove items
      if (cascade) {
        throw new ForbiddenException(
          'Only administrators can cascade delete products with their items',
        );
      }
    }

    return this.productService.deleteProduct(id, cascade);
  }
}
