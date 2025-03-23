import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
  Query,
  Req,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { ItemService } from './item.service';
import { CreateItemDto, GetItemsDto, UpdateItemDto } from './dto/item.dto';
import { Roles } from '@app/common/auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { ProductService } from '../product/product.service';

@Controller('items')
export class ItemController {
  private readonly logger = new Logger(ItemController.name);

  constructor(
    private readonly itemService: ItemService,
    private readonly productService: ProductService,
  ) {}

  @Post()
  @Roles(Role.ADMIN, Role.SHOP_OWNER, Role.SHOP_STAFF)
  async createItem(@Body() createItemDto: CreateItemDto, @Req() req) {
    this.logger.debug('POST /items', createItemDto);

    // Get shop ID from product
    const shopId = await this.itemService.getProductShopId(
      createItemDto.productId,
    );

    // Verify user has access to this shop
    if (req.user.role !== Role.ADMIN) {
      const hasAccess = await this.productService.verifyUserShopAccess(
        req.user.id,
        shopId,
      );

      if (!hasAccess) {
        throw new ForbiddenException('You do not have access to this product');
      }
    }

    return this.itemService.createItem(createItemDto);
  }

  @Get()
  @Roles(Role.ADMIN, Role.SHOP_OWNER, Role.SHOP_STAFF)
  async getItems(@Query() query: GetItemsDto, @Req() req) {
    this.logger.debug('GET /items', query);

    // Get shop ID from product
    const shopId = await this.itemService.getProductShopId(query.productId);

    // Verify user has access to this shop
    if (req.user.role !== Role.ADMIN) {
      const hasAccess = await this.productService.verifyUserShopAccess(
        req.user.id,
        shopId,
      );

      if (!hasAccess) {
        throw new ForbiddenException('You do not have access to this product');
      }
    }

    return this.itemService.getItems(query);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.SHOP_OWNER, Role.SHOP_STAFF)
  async getItem(@Param('id') id: string, @Req() req) {
    this.logger.debug(`GET /items/${id}`);

    const item = await this.itemService.getItemById(id);

    // Get shop ID from product
    const shopId = await this.itemService.getProductShopId(item.productId);

    // Verify user has access to this shop
    if (req.user.role !== Role.ADMIN) {
      const hasAccess = await this.productService.verifyUserShopAccess(
        req.user.id,
        shopId,
      );

      if (!hasAccess) {
        throw new ForbiddenException('You do not have access to this item');
      }
    }

    return item;
  }

  @Put(':id')
  @Roles(Role.ADMIN, Role.SHOP_OWNER, Role.SHOP_STAFF)
  async updateItem(
    @Param('id') id: string,
    @Body() updateItemDto: UpdateItemDto,
    @Req() req,
  ) {
    this.logger.debug(`PUT /items/${id}`, updateItemDto);

    const item = await this.itemService.getItemById(id);

    // Get shop ID from product
    const shopId = await this.itemService.getProductShopId(item.productId);

    // Verify user has access to this shop
    if (req.user.role !== Role.ADMIN) {
      const hasAccess = await this.productService.verifyUserShopAccess(
        req.user.id,
        shopId,
      );

      if (!hasAccess) {
        throw new ForbiddenException('You do not have access to this item');
      }
    }

    return this.itemService.updateItem(id, updateItemDto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN, Role.SHOP_OWNER)
  async deleteItem(@Param('id') id: string, @Req() req) {
    this.logger.debug(`DELETE /items/${id}`);

    const item = await this.itemService.getItemById(id);

    // Get shop ID from product
    const shopId = await this.itemService.getProductShopId(item.productId);

    // Verify user has access to this shop
    if (req.user.role !== Role.ADMIN) {
      const hasAccess = await this.productService.verifyUserShopAccess(
        req.user.id,
        shopId,
      );

      if (!hasAccess) {
        throw new ForbiddenException('You do not have access to this item');
      }

      // For non-admins, verify they are shop owner
      const userShop = await this.productService.getUserShopRole(
        req.user.id,
        shopId,
      );

      if (!userShop || userShop.role !== Role.SHOP_OWNER) {
        throw new ForbiddenException('Only shop owners can delete items');
      }
    }

    return this.itemService.deleteItem(id);
  }
}
