import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@app/common/database/prisma.service';
import { OrderStatus } from '@prisma/client';
import { KMS } from '@aws-sdk/client-kms';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class CustomerOrderService {
  private readonly logger = new Logger(CustomerOrderService.name);
  private kmsClient: KMS;
  private kmsKeyId: string;
  private kmsKeyAlias: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.kmsKeyId = this.configService.get<string>('AWS_KMS_KEY_ID');
    this.kmsKeyAlias = this.configService.get<string>('AWS_KMS_KEY_ALIAS');

    if (
      this.configService.get<string>('AWS_ACCESS_KEY_ID') &&
      this.configService.get<string>('AWS_SECRET_ACCESS_KEY')
    ) {
      this.kmsClient = new KMS({
        region: this.configService.get<string>('AWS_REGION', 'us-east-1'),
        credentials: {
          accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID'),
          secretAccessKey: this.configService.get<string>(
            'AWS_SECRET_ACCESS_KEY',
          ),
        },
      });
    }
  }

  private async decrypt(text: string): Promise<string> {
    if (!text) return '0';
    if (!this.kmsKeyId && !this.kmsKeyAlias) return text;
    if (text === '0') return text;
    if (text.startsWith('fb:')) return this.decryptLocal(text);

    try {
      const encryptedBuffer = Buffer.from(text, 'base64');
      const response = await this.kmsClient.decrypt({
        CiphertextBlob: encryptedBuffer,
      });
      return Buffer.from(response.Plaintext).toString('utf8');
    } catch (error) {
      this.logger.error('Decryption error:', error);
      if (text.startsWith('fb:')) {
        return this.decryptLocal(text);
      }
      return text;
    }
  }

  private decryptLocal(encryptedText: string): string {
    try {
      const [, ivHex, keyHex, encrypted] = encryptedText.split(':');
      const iv = Buffer.from(ivHex, 'hex');
      const key = Buffer.from(keyHex, 'hex');
      const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (error) {
      this.logger.error('Local decryption error:', error);
      return encryptedText;
    }
  }

  private async decryptOrderData(order: any): Promise<any> {
    const decryptedOrder = { ...order };

    if (decryptedOrder.subtotal) {
      decryptedOrder.subtotal = parseFloat(
        await this.decrypt(decryptedOrder.subtotal),
      );
    }

    if (decryptedOrder.discount) {
      decryptedOrder.discount = parseFloat(
        await this.decrypt(decryptedOrder.discount),
      );
    }

    if (decryptedOrder.total) {
      decryptedOrder.total = parseFloat(
        await this.decrypt(decryptedOrder.total),
      );
    }

    if (decryptedOrder.paid) {
      decryptedOrder.paid = parseFloat(await this.decrypt(decryptedOrder.paid));
    }

    if (decryptedOrder.paymentDue) {
      decryptedOrder.paymentDue = parseFloat(
        await this.decrypt(decryptedOrder.paymentDue),
      );
    }

    return decryptedOrder;
  }

  private async decryptOrderItemData(item: any): Promise<any> {
    const decryptedItem = { ...item };

    if (decryptedItem.originalPrice) {
      decryptedItem.originalPrice = parseFloat(
        await this.decrypt(decryptedItem.originalPrice),
      );
    }

    if (decryptedItem.sellingPrice) {
      decryptedItem.sellingPrice = parseFloat(
        await this.decrypt(decryptedItem.sellingPrice),
      );
    }

    return decryptedItem;
  }

  private async decryptPaymentData(payment: any): Promise<any> {
    const decryptedPayment = { ...payment };

    if (decryptedPayment.amount) {
      decryptedPayment.amount = parseFloat(
        await this.decrypt(decryptedPayment.amount),
      );
    }

    return decryptedPayment;
  }

  /**
   * Get customer order history with wallet balance
   * @param customerId Customer ID
   * @param shopId Shop ID
   * @returns Customer orders and wallet information
   */
  async getCustomerOrderHistory(customerId: string, shopId: string) {
    try {
      // Get customer wallet
      const wallet = await this.prisma.customerWallet.findUnique({
        where: {
          customerId_shopId: {
            customerId,
            shopId,
          },
        },
      });

      // Get wallet transactions separately
      let transactions = [];
      if (wallet) {
        // Use raw query since walletTransaction is not in Prisma schema yet
        transactions = await this.prisma.$queryRaw`
          SELECT * FROM "wallet_transactions"
          WHERE "customer_id" = ${customerId}
          AND "shop_id" = ${shopId}
          ORDER BY "created_at" DESC
        `;
      }

      if (!wallet) {
        return {
          wallet: null,
          orders: [],
        };
      }

      // Decrypt wallet data
      const decryptedWallet = {
        ...wallet,
        balance: parseFloat(await this.decrypt(wallet.balance)),
        loyaltyPoints: parseInt(await this.decrypt(wallet.loyaltyPoints)),
        transactions: await Promise.all(
          transactions.map(async (transaction) => ({
            ...transaction,
            amount: parseFloat(await this.decrypt(transaction.amount)),
          })),
        ),
      };

      // Get customer orders
      const orders = await this.prisma.order.findMany({
        where: {
          customerId,
          shopId,
          status: OrderStatus.COMPLETED,
        },
        include: {
          orderItems: {
            include: {
              product: true,
            },
          },
          payments: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      // Get all wallet transactions mapped by orderId for quick lookup
      const walletTxByOrder: Record<string, any[]> = {};
      for (const tx of decryptedWallet.transactions) {
        if (tx.orderId) {
          if (!walletTxByOrder[tx.orderId]) walletTxByOrder[tx.orderId] = [];
          walletTxByOrder[tx.orderId].push(tx);
        }
      }

      // Decrypt order data and add wallet modifications
      const decryptedOrders = await Promise.all(
        orders.map(async (order) => {
          const decryptedOrder = await this.decryptOrderData(order);
          const decryptedItems = await Promise.all(
            order.orderItems.map((item) => this.decryptOrderItemData(item)),
          );
          const decryptedPayments = await Promise.all(
            order.payments.map((payment) => this.decryptPaymentData(payment)),
          );

          // Wallet modifications for this order
          const walletTxs = walletTxByOrder[order.id] || [];
          let walletUsed = 0;
          let duePaid = 0;
          let extraAdded = 0;
          let loyaltyGained = 0;
          for (const tx of walletTxs) {
            if (tx.type === 'ORDER_PAYMENT') walletUsed += tx.amount;
            if (tx.type === 'DUE_PAYMENT') duePaid += tx.amount;
            if (tx.type === 'EXTRA_PAYMENT') extraAdded += tx.amount;
            if (tx.type === 'LOYALTY_POINTS') loyaltyGained += tx.amount;
          }

          return {
            ...decryptedOrder,
            items: decryptedItems,
            payments: decryptedPayments,
            walletModifications: {
              walletUsed,
              duePaid,
              extraAdded,
              loyaltyGained,
            },
          };
        }),
      );

      return {
        wallet: decryptedWallet,
        orders: decryptedOrders,
      };
    } catch (error) {
      this.logger.error('Error getting customer order history:', error);
      throw error;
    }
  }

  /**
   * Get customer items with warranty information
   * @param customerId Customer ID
   * @param shopId Shop ID
   * @returns Items with warranty status
   */
  async getCustomerWarrantyItems(customerId: string, shopId: string) {
    try {
      // Get all completed orders for the customer
      const orders = await this.prisma.order.findMany({
        where: {
          customerId,
          shopId,
          status: OrderStatus.COMPLETED,
        },
        include: {
          orderItems: {
            include: {
              product: {
                select: {
                  name: true,
                  warrantyMonths: true,
                },
              },
            },
          },
        },
      });

      const now = new Date();
      const items = [];

      // Process each order's items
      for (const order of orders) {
        const decryptedOrder = await this.decryptOrderData(order);
        const decryptedItems = await Promise.all(
          order.orderItems.map((item) => this.decryptOrderItemData(item)),
        );

        for (const item of decryptedItems) {
          const warrantyMonths = item.product.warrantyMonths;
          if (warrantyMonths) {
            const warrantyEndDate = new Date(decryptedOrder.createdAt);
            warrantyEndDate.setMonth(
              warrantyEndDate.getMonth() + warrantyMonths,
            );

            items.push({
              orderId: decryptedOrder.id,
              orderNumber: decryptedOrder.orderNumber,
              orderDate: decryptedOrder.createdAt,
              productName: item.product.name,
              warrantyMonths,
              warrantyEndDate,
              isWarrantyActive: now <= warrantyEndDate,
            });
          }
        }
      }

      return {
        activeWarranty: items.filter((item) => item.isWarrantyActive),
        expiredWarranty: items.filter((item) => !item.isWarrantyActive),
      };
    } catch (error) {
      this.logger.error('Error getting customer warranty items:', error);
      throw error;
    }
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

  /**
   * Get customer order history from all shops that the requesting user has access to
   * @param userId User ID of the requesting user
   * @param customerId Customer ID
   * @returns Customer orders from all accessible shops
   */
  async getCustomerOrderHistoryForAllShops(userId: string, customerId: string) {
    try {
      this.logger.debug(
        `Getting order history for all shops. UserId: ${userId}, CustomerId: ${customerId}`,
      );

      // First, get the user's role
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });

      let userShops = [];

      // If the user is a customer and looking up their own data (self-lookup)
      if (user?.role === 'CUSTOMER' && userId === customerId) {
        this.logger.debug(`User is a customer looking up their own data`);

        // Find all shops where this customer has either orders or a wallet
        const shopsWithOrders = await this.prisma.order.findMany({
          where: { customerId: userId },
          distinct: ['shopId'],
          select: { shopId: true },
        });

        const shopsWithWallets = await this.prisma.customerWallet.findMany({
          where: { customerId: userId },
          select: { shopId: true },
        });

        // Combine shop IDs and remove duplicates
        const shopIdsSet = new Set([
          ...shopsWithOrders.map((o) => o.shopId),
          ...shopsWithWallets.map((w) => w.shopId),
        ]);
        const shopIds = Array.from(shopIdsSet);

        // Get shop details
        if (shopIds.length > 0) {
          const shops = await this.prisma.shop.findMany({
            where: { id: { in: shopIds } },
            select: {
              id: true,
              businessName: true,
              shopLogo: true,
            },
          });

          userShops = shops.map((shop) => ({
            shopId: shop.id,
            shop: shop,
          }));
        }

        this.logger.debug(
          `Found ${userShops.length} shops for customer ${userId}`,
        );
      } else {
        // Regular case for shop owners/staff
        userShops = await this.prisma.userShop.findMany({
          where: { userId },
          select: {
            shopId: true,
            shop: {
              select: {
                id: true,
                businessName: true,
                shopLogo: true,
              },
            },
          },
        });

        this.logger.debug(
          `Found ${userShops.length} shops for userId: ${userId}`,
        );
      }

      if (!userShops || userShops.length === 0) {
        this.logger.debug(`No shops found for userId: ${userId}`);
        return {
          customer: null,
          shopData: [],
        };
      }

      const shopIds = userShops.map((userShop) => userShop.shopId);
      this.logger.debug(`Shop IDs: ${shopIds.join(', ')}`);

      // Get customer details
      const customer = await this.prisma.user.findUnique({
        where: { id: customerId },
        select: {
          id: true,
          name: true,
          email: true,
          contactNumber: true,
        },
      });

      if (!customer) {
        this.logger.debug(`Customer not found: ${customerId}`);
        return {
          customer: null,
          shopData: [],
        };
      }

      this.logger.debug(`Found customer: ${customer.name} (${customer.id})`);

      // Get data from each shop
      const shopData = await Promise.all(
        userShops.map(async (userShop) => {
          try {
            this.logger.debug(
              `Getting order history for shop: ${userShop.shopId}`,
            );
            const orderHistory = await this.getCustomerOrderHistory(
              customerId,
              userShop.shopId,
            );

            this.logger.debug(
              `Shop ${userShop.shopId}: orders=${orderHistory.orders ? orderHistory.orders.length : 0}, has wallet=${!!orderHistory.wallet}`,
            );

            return {
              shopId: userShop.shopId,
              shopName: userShop.shop.businessName,
              shopLogo: userShop.shop.shopLogo,
              orderHistory,
            };
          } catch (error) {
            this.logger.error(
              `Error getting order history for shop ${userShop.shopId}: ${error.message}`,
            );
            return {
              shopId: userShop.shopId,
              shopName: userShop.shop.businessName,
              shopLogo: userShop.shop.shopLogo,
              orderHistory: {
                wallet: null,
                orders: [],
                error: 'Failed to get order history',
              },
            };
          }
        }),
      );

      // Return all shops regardless of whether they have data
      return {
        customer,
        shopData: shopData,
      };
    } catch (error) {
      this.logger.error(
        `Error getting all shops customer order history: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get customer warranty items from all shops that the requesting user has access to
   * @param userId User ID of the requesting user
   * @param customerId Customer ID
   * @returns Warranty items from all accessible shops
   */
  async getCustomerWarrantyItemsForAllShops(
    userId: string,
    customerId: string,
  ) {
    try {
      this.logger.debug(
        `Getting warranty items for all shops. UserId: ${userId}, CustomerId: ${customerId}`,
      );

      // First, get the user's role
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });

      let userShops = [];

      // If the user is a customer and looking up their own data (self-lookup)
      if (user?.role === 'CUSTOMER' && userId === customerId) {
        this.logger.debug(`User is a customer looking up their own data`);

        // Find all shops where this customer has orders
        const shopsWithOrders = await this.prisma.order.findMany({
          where: { customerId: userId },
          distinct: ['shopId'],
          select: { shopId: true },
        });

        // Get shop details
        if (shopsWithOrders.length > 0) {
          const shopIds = shopsWithOrders.map((o) => o.shopId);

          const shops = await this.prisma.shop.findMany({
            where: { id: { in: shopIds } },
            select: {
              id: true,
              businessName: true,
              shopLogo: true,
            },
          });

          userShops = shops.map((shop) => ({
            shopId: shop.id,
            shop: shop,
          }));
        }

        this.logger.debug(
          `Found ${userShops.length} shops for customer ${userId}`,
        );
      } else {
        // Regular case for shop owners/staff
        userShops = await this.prisma.userShop.findMany({
          where: { userId },
          select: {
            shopId: true,
            shop: {
              select: {
                id: true,
                businessName: true,
                shopLogo: true,
              },
            },
          },
        });

        this.logger.debug(
          `Found ${userShops.length} shops for userId: ${userId}`,
        );
      }

      if (!userShops || userShops.length === 0) {
        this.logger.debug(`No shops found for userId: ${userId}`);
        return {
          customer: null,
          shopData: [],
        };
      }

      // Get customer details
      const customer = await this.prisma.user.findUnique({
        where: { id: customerId },
        select: {
          id: true,
          name: true,
          email: true,
          contactNumber: true,
        },
      });

      if (!customer) {
        this.logger.debug(`Customer not found: ${customerId}`);
        return {
          customer: null,
          shopData: [],
        };
      }

      this.logger.debug(`Found customer: ${customer.name} (${customer.id})`);

      // Get warranty data from each shop
      const shopData = await Promise.all(
        userShops.map(async (userShop) => {
          try {
            this.logger.debug(
              `Getting warranty items for shop: ${userShop.shopId}`,
            );
            const warrantyItems = await this.getCustomerWarrantyItems(
              customerId,
              userShop.shopId,
            );

            const activeCount = warrantyItems.activeWarranty
              ? warrantyItems.activeWarranty.length
              : 0;
            const expiredCount = warrantyItems.expiredWarranty
              ? warrantyItems.expiredWarranty.length
              : 0;
            this.logger.debug(
              `Shop ${userShop.shopId}: active=${activeCount}, expired=${expiredCount}`,
            );

            // Include all shops, even if they have no warranty items
            return {
              shopId: userShop.shopId,
              shopName: userShop.shop.businessName,
              shopLogo: userShop.shop.shopLogo,
              warrantyItems,
            };
          } catch (error) {
            this.logger.error(
              `Error getting warranty items for shop ${userShop.shopId}: ${error.message}`,
            );
            return {
              shopId: userShop.shopId,
              shopName: userShop.shop.businessName,
              shopLogo: userShop.shop.shopLogo,
              warrantyItems: {
                activeWarranty: [],
                expiredWarranty: [],
                error: 'Failed to get warranty items',
              },
            };
          }
        }),
      );

      // Combine all active warranty items across shops
      const allActiveWarranty = [];
      const allExpiredWarranty = [];

      shopData.forEach((shop) => {
        if (shop && shop.warrantyItems.activeWarranty) {
          shop.warrantyItems.activeWarranty.forEach((item) =>
            allActiveWarranty.push({
              ...item,
              shopId: shop.shopId,
              shopName: shop.shopName,
            }),
          );
        }

        if (shop && shop.warrantyItems.expiredWarranty) {
          shop.warrantyItems.expiredWarranty.forEach((item) =>
            allExpiredWarranty.push({
              ...item,
              shopId: shop.shopId,
              shopName: shop.shopName,
            }),
          );
        }
      });

      this.logger.debug(
        `Total active warranty items: ${allActiveWarranty.length}, expired: ${allExpiredWarranty.length}`,
      );

      return {
        customer,
        shopData,
        allActiveWarranty,
        allExpiredWarranty,
        activeCount: allActiveWarranty.length,
        expiredCount: allExpiredWarranty.length,
      };
    } catch (error) {
      this.logger.error(
        `Error getting all shops customer warranty items: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }
}
