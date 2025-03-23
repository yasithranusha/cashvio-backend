import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@app/common/database/prisma.service';
import { CreateItemDto, UpdateItemDto, GetItemsDto } from './dto/item.dto';
import { Item } from '@prisma/client';
import { PaginatedResponse } from '@app/common/types/response';

@Injectable()
export class ItemService {
  private readonly logger = new Logger(ItemService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createItem(createItemDto: CreateItemDto): Promise<Item> {
    this.logger.debug(`Creating item: ${JSON.stringify(createItemDto)}`);

    try {
      // Verify product exists
      const product = await this.prisma.product.findUnique({
        where: { id: createItemDto.productId },
        include: { shop: true },
      });

      if (!product) {
        throw new BadRequestException('Product not found');
      }

      // Check for barcode uniqueness
      const existingBarcode = await this.prisma.item.findUnique({
        where: { barcode: createItemDto.barcode },
      });

      if (existingBarcode) {
        throw new BadRequestException('Barcode already exists');
      }

      const item = await this.prisma.item.create({
        data: {
          barcode: createItemDto.barcode,
          broughtPrice: createItemDto.broughtPrice,
          sellPrice: createItemDto.sellPrice,
          warrantyPeriod: createItemDto.warrantyPeriod,
          productId: createItemDto.productId,
        },
      });

      return item;
    } catch (error) {
      this.logger.error(`Error creating item: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getItems(query: GetItemsDto): Promise<PaginatedResponse<Item>> {
    this.logger.debug(`Getting items for product ${query.productId}`);

    const skip = (query.page - 1) * query.limit;

    try {
      const [items, total] = await Promise.all([
        this.prisma.item.findMany({
          where: { productId: query.productId },
          skip,
          take: query.limit,
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.item.count({
          where: { productId: query.productId },
        }),
      ]);

      return {
        data: items,
        pagination: {
          total,
          page: query.page,
          limit: query.limit,
          totalPages: Math.ceil(total / query.limit),
        },
      };
    } catch (error) {
      this.logger.error(`Error getting items: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getItemById(id: string): Promise<Item> {
    this.logger.debug(`Getting item ${id}`);

    try {
      const item = await this.prisma.item.findUnique({
        where: { id },
        include: {
          product: true,
        },
      });

      if (!item) {
        throw new NotFoundException('Item not found');
      }

      return item;
    } catch (error) {
      this.logger.error(`Error getting item: ${error.message}`, error.stack);
      throw error;
    }
  }

  async updateItem(id: string, updateItemDto: UpdateItemDto): Promise<Item> {
    this.logger.debug(`Updating item ${id}: ${JSON.stringify(updateItemDto)}`);

    try {
      // Check if item exists
      const item = await this.prisma.item.findUnique({
        where: { id },
      });

      if (!item) {
        throw new NotFoundException('Item not found');
      }

      // Check barcode uniqueness if changing barcode
      if (updateItemDto.barcode && updateItemDto.barcode !== item.barcode) {
        const existingBarcode = await this.prisma.item.findUnique({
          where: { barcode: updateItemDto.barcode },
        });

        if (existingBarcode) {
          throw new BadRequestException('Barcode already exists');
        }
      }

      const updatedItem = await this.prisma.item.update({
        where: { id },
        data: updateItemDto,
      });

      return updatedItem;
    } catch (error) {
      this.logger.error(`Error updating item: ${error.message}`, error.stack);
      throw error;
    }
  }

  async deleteItem(id: string): Promise<Item> {
    this.logger.debug(`Deleting item ${id}`);

    try {
      const item = await this.prisma.item.findUnique({
        where: { id },
      });

      if (!item) {
        throw new NotFoundException('Item not found');
      }

      return this.prisma.item.delete({
        where: { id },
      });
    } catch (error) {
      this.logger.error(`Error deleting item: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getProductShopId(productId: string): Promise<string> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { shopId: true },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return product.shopId;
  }
}
