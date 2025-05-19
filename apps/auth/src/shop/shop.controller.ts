import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Req,
  Query,
  Logger,
  Patch,
} from '@nestjs/common';
import { ShopService } from './shop.service';
import {
  CreateShopDto,
  GetShopCustomersDto,
  GetShopsDto,
  UpdateShopDto,
} from './dto/shop.dto';
import { Roles } from '../decorators/roles.decorator';
import { Role, Shop } from '@prisma/client';
import { PaginatedResponse } from '@app/common/types/response';

@Controller('shops')
export class ShopController {
  private readonly logger = new Logger(ShopController.name);

  constructor(private readonly shopService: ShopService) {}

  @Post()
  @Roles(Role.SHOP_OWNER, Role.ADMIN)
  async addShop(
    @Body() createShopDto: CreateShopDto,
    @Req() req,
  ): Promise<Shop> {
    this.logger.debug('POST /shops', createShopDto);
    return this.shopService.addShop(req.user.id, createShopDto);
  }

  @Get()
  async getShops(
    @Query() query: GetShopsDto,
    @Req() req,
  ): Promise<PaginatedResponse<Shop>> {
    this.logger.debug('GET /shops', query);
    return this.shopService.getShops(req.user.id, query);
  }

  @Get(':id')
  async getShopById(@Param('id') id: string, @Req() req): Promise<Shop> {
    this.logger.debug(`GET /shops/${id}`);
    return this.shopService.getShopById(id, req.user.id);
  }

  @Put(':id')
  @Roles(Role.SHOP_OWNER, Role.ADMIN)
  async updateShop(
    @Param('id') id: string,
    @Body() updateShopDto: UpdateShopDto,
    @Req() req,
  ): Promise<Shop> {
    this.logger.debug(`PUT /shops/${id}`, updateShopDto);
    return this.shopService.updateShop(id, req.user.id, updateShopDto);
  }

  @Patch(':id/set-default')
  async setDefaultShop(
    @Param('id') id: string,
    @Req() req,
  ): Promise<{ message: string }> {
    this.logger.debug(`PATCH /shops/${id}/set-default`);
    await this.shopService.setDefaultShop(req.user.id, id);
    return { message: 'Default shop updated successfully' };
  }

  @Get(':id/customers')
  async getShopCustomers(
    @Param('id') id: string,
    @Query() query: GetShopCustomersDto,
    @Req() req,
  ) {
    this.logger.debug(`GET /shops/${id}/customers`, query);
    return this.shopService.getShopCustomers(id, req.user.id, query);
  }
}
