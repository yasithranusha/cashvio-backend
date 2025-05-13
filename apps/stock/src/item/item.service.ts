import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@app/common/database/prisma.service';
import {
  CreateItemDto,
  UpdateItemDto,
  GetItemsDto,
  ItemCreateInput,
  ItemUpdateInput,
} from './dto/item.dto';
import { Item } from '@prisma/client';
import { PaginatedResponse } from '@app/common/types/response';

@Injectable()
export class ItemService {
  private readonly logger = new Logger(ItemService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Convert a Prisma Item with string prices to an Item with numeric prices for the API
   */
  private mapItemToDto(item: Item): any {
    return {
      ...item,
      broughtPrice: parseFloat(item.broughtPrice),
      sellPrice: parseFloat(item.sellPrice),
    };
  }

  async createItem(createItemDto: CreateItemDto): Promise<any> {
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

      // Convert numeric prices to strings for Prisma
      const itemData: ItemCreateInput = {
        barcode: createItemDto.barcode,
        broughtPrice: createItemDto.broughtPrice.toString(),
        sellPrice: createItemDto.sellPrice.toString(),
        warrantyPeriod: createItemDto.warrantyPeriod,
        productId: createItemDto.productId,
      };

      const item = await this.prisma.item.create({
        data: itemData,
      });

      // Convert string prices to numeric for API response
      return this.mapItemToDto(item);
    } catch (error) {
      this.logger.error(`Error creating item: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getItems(query: GetItemsDto): Promise<PaginatedResponse<any>> {
    this.logger.debug(`Getting items for product ${query.productId}`);

    try {
      let paginationOptions = {};
      let page = 1;
      let limit = 10;

      // Only apply pagination if both parameters are explicitly provided in the request
      if (query.page !== undefined && query.limit !== undefined) {
        page = query.page;
        limit = query.limit;
        paginationOptions = {
          skip: (page - 1) * limit,
          take: limit,
        };
      }

      const [items, total] = await Promise.all([
        this.prisma.item.findMany({
          where: { productId: query.productId },
          ...paginationOptions,
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.item.count({
          where: { productId: query.productId },
        }),
      ]);

      // Convert string prices to numeric for API response
      const mappedItems = items.map((item) => this.mapItemToDto(item));

      return {
        data: mappedItems,
        pagination: {
          total,
          page,
          limit,
          totalPages: limit > 0 ? Math.ceil(total / limit) : 1,
        },
      };
    } catch (error) {
      this.logger.error(`Error getting items: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getItemById(id: string): Promise<any> {
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

      // Convert string prices to numeric for API response
      return this.mapItemToDto(item);
    } catch (error) {
      this.logger.error(`Error getting item: ${error.message}`, error.stack);
      throw error;
    }
  }

  async updateItem(id: string, updateItemDto: UpdateItemDto): Promise<any> {
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

      // Prepare update data, converting price fields to strings
      const updateData: ItemUpdateInput = {};

      if (updateItemDto.barcode !== undefined) {
        updateData.barcode = updateItemDto.barcode;
      }

      if (updateItemDto.broughtPrice !== undefined) {
        updateData.broughtPrice = updateItemDto.broughtPrice.toString();
      }

      if (updateItemDto.sellPrice !== undefined) {
        updateData.sellPrice = updateItemDto.sellPrice.toString();
      }

      if (updateItemDto.warrantyPeriod !== undefined) {
        updateData.warrantyPeriod = updateItemDto.warrantyPeriod;
      }

      const updatedItem = await this.prisma.item.update({
        where: { id },
        data: updateData,
      });

      // Convert string prices to numeric for API response
      return this.mapItemToDto(updatedItem);
    } catch (error) {
      this.logger.error(`Error updating item: ${error.message}`, error.stack);
      throw error;
    }
  }

  async deleteItem(id: string): Promise<any> {
    this.logger.debug(`Deleting item ${id}`);

    try {
      const item = await this.prisma.item.findUnique({
        where: { id },
      });

      if (!item) {
        throw new NotFoundException('Item not found');
      }

      const deletedItem = await this.prisma.item.delete({
        where: { id },
      });

      // Convert string prices to numeric for API response
      return this.mapItemToDto(deletedItem);
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
