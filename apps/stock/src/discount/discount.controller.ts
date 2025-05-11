import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Put,
  Query,
} from '@nestjs/common';
import { DiscountService } from './discount.service';
import {
  AssignProductsToDiscountDto,
  CreateDiscountDto,
  GetDiscountsDto,
  RemoveProductFromDiscountDto,
  UpdateDiscountDto,
} from './dto/discount.dto';
import { Roles } from '@app/common/auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('discounts')
export class DiscountController {
  constructor(private readonly discountService: DiscountService) {}

  @Post()
  @Roles(Role.SHOP_OWNER)
  create(@Body() createDiscountDto: CreateDiscountDto) {
    return this.discountService.createDiscount(createDiscountDto);
  }

  @Get()
  findAll(@Query() query: GetDiscountsDto) {
    return this.discountService.getDiscounts(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.discountService.getDiscountById(id);
  }

  @Put(':id')
  @Roles(Role.SHOP_OWNER)
  update(
    @Param('id') id: string,
    @Body() updateDiscountDto: UpdateDiscountDto,
  ) {
    return this.discountService.updateDiscount(id, updateDiscountDto);
  }

  @Delete(':id')
  @Roles(Role.SHOP_OWNER)
  remove(@Param('id') id: string) {
    return this.discountService.deleteDiscount(id);
  }

  @Post('products/:id')
  @Roles(Role.SHOP_OWNER)
  assignProducts(
    @Param('id') id: string,
    @Body() dto: AssignProductsToDiscountDto,
  ) {
    return this.discountService.assignProductsToDiscount(id, dto);
  }

  @Delete(':id/products')
  @Roles(Role.SHOP_OWNER)
  removeProduct(
    @Param('id') id: string,
    @Body() dto: RemoveProductFromDiscountDto,
  ) {
    return this.discountService.removeProductFromDiscount(id, dto);
  }

  @Get('products/:productId')
  getProductDiscounts(@Param('productId') productId: string) {
    return this.discountService.getActiveDiscountsForProduct(productId);
  }
}
