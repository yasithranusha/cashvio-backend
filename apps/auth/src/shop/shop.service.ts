import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  CreateShopDto,
  GetShopCustomersDto,
  GetShopsDto,
  UpdateShopDto,
} from './dto/shop.dto';
import { PrismaService } from '@app/common/database/prisma.service';
import { PaginatedResponse } from '@app/common/types/response';
import { Role, Shop } from '@prisma/client';
import { userSelectFeilds } from '../types/user';

@Injectable()
export class ShopService {
  private readonly logger = new Logger(ShopService.name);

  constructor(private readonly prisma: PrismaService) {}

  async addShop(userId: string, dto: CreateShopDto): Promise<Shop> {
    this.logger.debug(`Creating shop for user ${userId}`);

    try {
      // Create the shop and associate it with the user
      return await this.prisma.$transaction(async (tx) => {
        const shop = await tx.shop.create({
          data: {
            businessName: dto.businessName,
            address: dto.address,
            contactPhone: dto.contactPhone,
            shopLogo: dto.shopLogo,
            shopBanner: dto.shopBanner,
          },
        });

        // Add user to shop with SHOP_OWNER role
        await tx.userShop.create({
          data: {
            userId,
            shopId: shop.id,
            role: Role.SHOP_OWNER,
          },
        });

        // Set as default shop if user doesn't have one
        const user = await tx.user.findUnique({
          where: { id: userId },
          select: { defaultShopId: true },
        });

        if (!user.defaultShopId) {
          await tx.user.update({
            where: { id: userId },
            data: { defaultShopId: shop.id },
          });
        }

        return shop;
      });
    } catch (error) {
      this.logger.error(`Error creating shop: ${error.message}`, error.stack);
      throw new BadRequestException('Failed to create shop');
    }
  }

  async getShops(
    userId: string,
    dto: GetShopsDto,
  ): Promise<PaginatedResponse<Shop>> {
    this.logger.debug(`Getting shops for user ${userId}`);

    const skip = (dto.page - 1) * dto.limit;
    const where = {
      users: {
        some: {
          userId,
        },
      },
    };

    if (dto.status) {
      where['status'] = dto.status;
    }

    try {
      const [shops, total] = await Promise.all([
        this.prisma.shop.findMany({
          where,
          skip,
          take: dto.limit,
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.shop.count({ where }),
      ]);

      return {
        data: shops,
        pagination: {
          total,
          page: dto.page,
          limit: dto.limit,
          totalPages: Math.ceil(total / dto.limit),
        },
      };
    } catch (error) {
      this.logger.error(`Error fetching shops: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getShopById(shopId: string, userId: string): Promise<Shop> {
    this.logger.debug(`Getting shop ${shopId} for user ${userId}`);

    try {
      // Check if user has access to this shop
      const userShop = await this.prisma.userShop.findUnique({
        where: {
          userId_shopId: {
            userId,
            shopId,
          },
        },
      });

      if (!userShop) {
        throw new NotFoundException('Shop not found or access denied');
      }

      const shop = await this.prisma.shop.findUnique({
        where: { id: shopId },
      });

      if (!shop) {
        throw new NotFoundException('Shop not found');
      }

      return shop;
    } catch (error) {
      this.logger.error(`Error fetching shop: ${error.message}`, error.stack);
      throw error;
    }
  }

  async updateShop(
    shopId: string,
    userId: string,
    dto: UpdateShopDto,
  ): Promise<Shop> {
    this.logger.debug(`Updating shop ${shopId} by user ${userId}`);

    try {
      // Verify user has access with at least SHOP_OWNER role
      const userShop = await this.prisma.userShop.findUnique({
        where: {
          userId_shopId: {
            userId,
            shopId,
          },
        },
      });

      if (
        !userShop ||
        (userShop.role !== Role.SHOP_OWNER && userShop.role !== Role.ADMIN)
      ) {
        throw new BadRequestException(
          'You do not have permission to update this shop',
        );
      }

      return this.prisma.shop.update({
        where: { id: shopId },
        data: dto,
      });
    } catch (error) {
      this.logger.error(`Error updating shop: ${error.message}`, error.stack);
      throw error;
    }
  }

  async setDefaultShop(userId: string, shopId: string): Promise<void> {
    this.logger.debug(`Setting default shop ${shopId} for user ${userId}`);

    try {
      // Verify user has access to this shop
      const userShop = await this.prisma.userShop.findUnique({
        where: {
          userId_shopId: {
            userId,
            shopId,
          },
        },
      });

      if (!userShop) {
        throw new BadRequestException('You do not have access to this shop');
      }

      await this.prisma.user.update({
        where: { id: userId },
        data: { defaultShopId: shopId },
      });
    } catch (error) {
      this.logger.error(
        `Error setting default shop: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async getShopCustomers(
    shopId: string,
    userId: string,
    dto: GetShopCustomersDto,
  ) {
    this.logger.debug(
      `Getting customers for shop ${shopId} requested by user ${userId}`,
    );

    try {
      // Verify user has access to this shop
      const userShop = await this.prisma.userShop.findUnique({
        where: {
          userId_shopId: {
            userId,
            shopId,
          },
        },
      });

      if (!userShop) {
        throw new BadRequestException('You do not have access to this shop');
      }

      // Check if pagination parameters are provided
      const shouldPaginate = dto.page !== undefined || dto.limit !== undefined;
      const page = dto.page || 1;
      const limit = dto.limit || 10;

      // Get total count for both paginated and non-paginated queries
      const total = await this.prisma.user.count({
        where: {
          orders: {
            some: {
              shopId: shopId,
            },
          },
        },
      });

      // Common select and where options
      const selectOptions = {
        ...userSelectFeilds,
        _count: {
          select: {
            orders: {
              where: {
                shopId: shopId,
              },
            },
          },
        },
      };

      const whereOptions = {
        orders: {
          some: {
            shopId: shopId,
          },
        },
      };

      let customers;

      // Fetch data with or without pagination based on shouldPaginate flag
      if (shouldPaginate) {
        const skip = (page - 1) * limit;
        customers = await this.prisma.user.findMany({
          where: whereOptions,
          select: selectOptions,
          skip: skip,
          take: limit,
          orderBy: {
            createdAt: 'desc',
          },
        });
      } else {
        customers = await this.prisma.user.findMany({
          where: whereOptions,
          select: selectOptions,
          orderBy: {
            createdAt: 'desc',
          },
        });
      }

      // Transform the data to include only order count
      const customerData = customers.map((customer) => ({
        ...customer,
        orderCount: customer._count.orders,
        _count: undefined, // Remove the _count property
      }));

      // Return with or without pagination info based on shouldPaginate flag
      if (shouldPaginate) {
        return {
          data: customerData,
          pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
          },
        };
      }

      // Return just the data if we're not paginating
      return { data: customerData };
    } catch (error) {
      this.logger.error(
        `Error fetching shop customers: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
