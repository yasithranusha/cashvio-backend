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
import { SupplierService } from './supplier.service';
import { Roles } from '@app/common/auth/decorators/roles.decorator';
import {
  CreateSupplierDto,
  UpdateSupplierDto,
  GetSuppliersDto,
} from './dto/supplier.dto';
import { Role, Supplier } from '@prisma/client';
import { PaginatedResponse } from '@app/common/types/response';

@Controller('suppliers')
export class SupplierController {
  private readonly logger = new Logger(SupplierController.name);

  constructor(private readonly supplierService: SupplierService) {}

  @Post()
  @Roles(Role.SHOP_OWNER, Role.SHOP_STAFF)
  async createSupplier(
    @Body() createSupplierDto: CreateSupplierDto,
    @Req() req,
  ): Promise<Supplier> {
    this.logger.debug('POST /suppliers', createSupplierDto);

    // Verify user has access to this shop
    const hasAccess = await this.supplierService.verifyUserShopAccess(
      req.user.id,
      createSupplierDto.shopId,
    );

    if (!hasAccess) {
      throw new ForbiddenException('You do not have access to this shop');
    }

    return this.supplierService.createSupplier(createSupplierDto);
  }

  @Get()
  @Roles(Role.SHOP_OWNER, Role.SHOP_STAFF)
  async getSuppliers(
    @Query() query: GetSuppliersDto,
    @Req() req,
  ): Promise<PaginatedResponse<Supplier>> {
    this.logger.debug('GET /suppliers', query);

    // Verify user has access to this shop
    const hasAccess = await this.supplierService.verifyUserShopAccess(
      req.user.id,
      query.shopId,
    );

    if (!hasAccess) {
      throw new ForbiddenException('You do not have access to this shop');
    }

    return this.supplierService.getSuppliers(query);
  }

  @Get(':id')
  @Roles(Role.SHOP_OWNER, Role.SHOP_STAFF)
  async getSupplier(@Param('id') id: string, @Req() req): Promise<Supplier> {
    this.logger.debug(`GET /suppliers/${id}`);

    const supplier = await this.supplierService.getSupplierById(id);

    // Verify user has access to this shop
    const hasAccess = await this.supplierService.verifyUserShopAccess(
      req.user.id,
      supplier.shopId,
    );

    if (!hasAccess) {
      throw new ForbiddenException('You do not have access to this supplier');
    }

    return supplier;
  }

  @Put(':id')
  @Roles(Role.SHOP_OWNER, Role.SHOP_STAFF)
  async updateSupplier(
    @Param('id') id: string,
    @Body() updateSupplierDto: UpdateSupplierDto,
    @Req() req,
  ): Promise<Supplier> {
    this.logger.debug(`PUT /suppliers/${id}`, updateSupplierDto);

    const supplier = await this.supplierService.getSupplierById(id);

    // Verify user has access to this shop
    const hasAccess = await this.supplierService.verifyUserShopAccess(
      req.user.id,
      supplier.shopId,
    );

    if (!hasAccess) {
      throw new ForbiddenException('You do not have access to this supplier');
    }

    return this.supplierService.updateSupplier(id, updateSupplierDto);
  }

  @Delete(':id')
  @Roles(Role.SHOP_OWNER)
  async deleteSupplier(@Param('id') id: string, @Req() req): Promise<Supplier> {
    this.logger.debug(`DELETE /suppliers/${id}`);

    const supplier = await this.supplierService.getSupplierById(id);

    // Verify user has access to this shop with SHOP_OWNER role
    const hasAccess = await this.supplierService.verifyUserShopAccess(
      req.user.id,
      supplier.shopId,
    );

    if (!hasAccess) {
      throw new ForbiddenException('You do not have access to this supplier');
    }

    return this.supplierService.deleteSupplier(id);
  }
}
