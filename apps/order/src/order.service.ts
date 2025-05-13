import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '@app/common/database/prisma.service';
import { CreateOrderDto, OrderQueryDto, DiscountType } from './dto';
import { OrderStatus } from './dto/order-query.dto';
import * as crypto from 'crypto';
import { randomBytes } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { KMS } from '@aws-sdk/client-kms';
import { PaymentMethod, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);
  private readonly kmsClient: KMS;
  private readonly kmsKeyId: string;
  private readonly kmsKeyAlias: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    this.kmsKeyId = this.configService.get<string>('AWS_KMS_KEY_ID');
    this.kmsKeyAlias = this.configService.get<string>('AWS_KMS_KEY_ALIAS');

    // Initialize AWS KMS client
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

  async getShopForUser(userId: string, shopId?: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        defaultShop: true,
        shopAccess: {
          include: {
            shop: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // If shopId is provided, verify user has access to it
    if (shopId) {
      const hasAccess = user.shopAccess.some(
        (access) => access.shopId === shopId,
      );
      if (!hasAccess) {
        throw new BadRequestException('You do not have access to this shop');
      }
      return shopId;
    }

    // Use default shop if available
    if (user.defaultShopId) {
      return user.defaultShopId;
    }

    // Use first available shop
    if (user.shopAccess.length > 0) {
      return user.shopAccess[0].shopId;
    }

    throw new BadRequestException('No shop available for this user');
  }

  async createCustomerIfNotExists(customerData: {
    name?: string;
    email?: string;
    phone?: string;
  }): Promise<string | null> {
    if (!customerData.name && !customerData.email && !customerData.phone) {
      return null; // No customer data provided
    }

    let customer;

    // Try to find customer by email or phone
    if (customerData.email) {
      customer = await this.prisma.user.findUnique({
        where: { email: customerData.email },
      });
    }

    if (!customer && customerData.phone) {
      customer = await this.prisma.user.findFirst({
        where: { contactNumber: customerData.phone },
      });
    }

    // If customer exists, return ID
    if (customer) {
      return customer.id;
    }

    // Create new customer directly with Prisma
    try {
      const password = randomBytes(10).toString('hex');
      const hashedPassword = await bcrypt.hash(password, 10);

      const newCustomer = await this.prisma.user.create({
        data: {
          name: customerData.name || 'Guest Customer',
          email: customerData.email || `guest_${Date.now()}@cashvio.com`,
          password: hashedPassword,
          contactNumber: customerData.phone,
          role: Role.CUSTOMER,
        },
      });

      return newCustomer.id;
    } catch (error) {
      this.logger.error('Error creating customer:', error);
      return null;
    }
  }

  /**
   * Encrypt data using AWS KMS
   * @param text Data to encrypt
   * @returns Encrypted data
   */
  private async encrypt(text: string): Promise<string> {
    if (!this.kmsKeyId && !this.kmsKeyAlias) {
      this.logger.warn('KMS Key ID not configured, storing data unencrypted');
      return text;
    }

    try {
      // AWS KMS encryption
      const encryptParams = {
        KeyId: this.kmsKeyId || `alias/${this.kmsKeyAlias}`,
        Plaintext: Buffer.from(text),
      };

      const response = await this.kmsClient.encrypt(encryptParams);
      if (!response.CiphertextBlob) {
        throw new Error('Failed to encrypt data with KMS');
      }

      // Convert the encrypted data to base64 for storage
      return Buffer.from(response.CiphertextBlob).toString('base64');
    } catch (error) {
      this.logger.error('Encryption error:', error);

      // Fallback if primary encryption fails
      const key = crypto.randomBytes(32);
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);

      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      return `fallback:${iv.toString('hex')}:${key.toString('hex')}:${encrypted}`;
    }
  }

  /**
   * Decrypt data using AWS KMS
   * @param encryptedText Encrypted data
   * @returns Decrypted data
   */
  private async decrypt(encryptedText: string): Promise<string> {
    if (!encryptedText) {
      return '0';
    }

    // If no KMS key is configured or data isn't encrypted, return as is
    if ((!this.kmsKeyId && !this.kmsKeyAlias) || encryptedText === '0') {
      return encryptedText;
    }

    try {
      // Handle fallback encryption
      if (encryptedText.startsWith('fallback:')) {
        const [, ivHex, keyHex, encrypted] = encryptedText.split(':');
        const iv = Buffer.from(ivHex, 'hex');
        const key = Buffer.from(keyHex, 'hex');

        const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
      }

      // AWS KMS decryption
      const encryptedBuffer = Buffer.from(encryptedText, 'base64');
      const decryptParams = {
        CiphertextBlob: encryptedBuffer,
      };

      const response = await this.kmsClient.decrypt(decryptParams);
      if (!response.Plaintext) {
        throw new Error('Failed to decrypt data with KMS');
      }

      return Buffer.from(response.Plaintext).toString('utf8');
    } catch (error) {
      this.logger.error('Decryption error:', error);
      return encryptedText; // Return original on failure
    }
  }

  async updateShopBalance(
    shopId: string,
    paymentMethod: PaymentMethod,
    amount: number,
  ): Promise<void> {
    try {
      const shopBalance = await this.prisma.shopBalance.findUnique({
        where: { shopId },
      });

      if (!shopBalance) {
        // Create a new shop balance record
        await this.prisma.shopBalance.create({
          data: {
            shopId,
            cashBalance: paymentMethod === PaymentMethod.CASH ? amount : 0,
            cardBalance: paymentMethod === PaymentMethod.CARD ? amount : 0,
            bankBalance: paymentMethod === PaymentMethod.BANK ? amount : 0,
          },
        });
        return;
      }

      // Update existing shop balance
      switch (paymentMethod) {
        case PaymentMethod.CASH:
          await this.prisma.shopBalance.update({
            where: { shopId },
            data: { cashBalance: { increment: amount } },
          });
          break;
        case PaymentMethod.CARD:
          await this.prisma.shopBalance.update({
            where: { shopId },
            data: { cardBalance: { increment: amount } },
          });
          break;
        case PaymentMethod.BANK:
          await this.prisma.shopBalance.update({
            where: { shopId },
            data: { bankBalance: { increment: amount } },
          });
          break;
      }
    } catch (error) {
      this.logger.error('Error updating shop balance:', error);
      throw new Error('Failed to update shop balance');
    }
  }

  async updateCustomerWallet(
    customerId: string,
    shopId: string,
    amount: number,
    loyaltyPoints: number = 0,
  ): Promise<void> {
    try {
      const wallet = await this.prisma.customerWallet.findUnique({
        where: {
          customerId_shopId: {
            customerId,
            shopId,
          },
        },
      });

      if (!wallet) {
        // Create a new wallet
        await this.prisma.customerWallet.create({
          data: {
            customerId,
            shopId,
            balance: amount,
            loyaltyPoints,
          },
        });
        return;
      }

      // Update existing wallet
      await this.prisma.customerWallet.update({
        where: {
          customerId_shopId: {
            customerId,
            shopId,
          },
        },
        data: {
          balance: { increment: amount },
          loyaltyPoints: { increment: loyaltyPoints },
        },
      });
    } catch (error) {
      this.logger.error('Error updating customer wallet:', error);
      throw new Error('Failed to update customer wallet');
    }
  }

  async getCustomerWalletBalance(
    customerId: string,
    shopId: string,
  ): Promise<number> {
    try {
      const wallet = await this.prisma.customerWallet.findUnique({
        where: {
          customerId_shopId: {
            customerId,
            shopId,
          },
        },
      });

      return wallet?.balance || 0;
    } catch (error) {
      this.logger.error('Error fetching customer wallet balance:', error);
      return 0;
    }
  }

  async createOrder(
    userId: string,
    createOrderDto: CreateOrderDto,
  ): Promise<any> {
    const shopId = await this.getShopForUser(userId, createOrderDto.shopId);

    // Process customer info
    let customerId = createOrderDto.customerId;

    if (
      !customerId &&
      (createOrderDto.customerName ||
        createOrderDto.customerEmail ||
        createOrderDto.customerPhone)
    ) {
      customerId = await this.createCustomerIfNotExists({
        name: createOrderDto.customerName,
        email: createOrderDto.customerEmail,
        phone: createOrderDto.customerPhone,
      });
    }

    // Calculate the total ourselves instead of trusting the client
    let subtotal = 0;
    const orderItemsData = [];

    // Fetch and validate all items first
    for (const orderItem of createOrderDto.items) {
      const product = await this.prisma.product.findUnique({
        where: { id: orderItem.productId },
      });

      if (!product) {
        throw new NotFoundException(
          `Product with ID ${orderItem.productId} not found`,
        );
      }

      let itemSubtotal = 0;
      for (const barcode of orderItem.barcodes) {
        const item = await this.prisma.item.findUnique({
          where: { barcode },
        });

        if (!item) {
          throw new NotFoundException(`Item with barcode ${barcode} not found`);
        }

        if (item.productId !== orderItem.productId) {
          throw new BadRequestException(
            `Item with barcode ${barcode} does not belong to product ${orderItem.productId}`,
          );
        }

        // Calculate price for this item
        const itemPrice = orderItem.customPrice || item.sellPrice;
        itemSubtotal += itemPrice;

        orderItemsData.push({
          id: crypto.randomUUID(),
          productId: orderItem.productId,
          itemId: item.id,
          quantity: 1,
          originalPrice: item.sellPrice,
          sellingPrice: orderItem.customPrice || item.sellPrice,
        });
      }

      subtotal += itemSubtotal;
    }

    // Generate unique order number
    const orderNumber = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // Calculate discount
    let discount = createOrderDto.discount || 0;

    if (
      createOrderDto.discountType === DiscountType.PERCENTAGE &&
      discount > 0
    ) {
      discount = (subtotal * discount) / 100;
    }

    // Calculate the final total with discount
    const finalTotal = subtotal - discount;

    // Calculate total payment amount
    const totalPayment = createOrderDto.payments.reduce(
      (sum, payment) => sum + payment.amount,
      0,
    );

    // Check for payment due
    let paymentDue = 0;
    let useWalletToPayDue = false;

    if (customerId) {
      // If a custom due amount is specified, use that
      if (createOrderDto.customDueAmount !== undefined) {
        paymentDue = createOrderDto.customDueAmount;
        useWalletToPayDue = true;
      } else {
        // Otherwise check if customer has payment due (negative wallet balance)
        const walletBalance = await this.getCustomerWalletBalance(
          customerId,
          shopId,
        );

        if (walletBalance < 0) {
          // Only include payment due if duePaidAmount is specified
          if (createOrderDto.duePaidAmount !== undefined) {
            paymentDue = Math.min(
              Math.abs(walletBalance),
              createOrderDto.duePaidAmount,
            );
            useWalletToPayDue = true;
          }
        }
      }
    }

    // Check if payment is sufficient
    const totalWithDue = finalTotal + paymentDue;
    if (totalPayment < totalWithDue) {
      throw new BadRequestException(
        `Total payment (${totalPayment}) is less than order total plus dues (${totalWithDue})`,
      );
    }

    // Calculate extra payment amount
    // If extraWalletAmount is specified, use that exact amount
    // Otherwise use any excess payment
    const extraPayment =
      createOrderDto.extraWalletAmount !== undefined
        ? createOrderDto.extraWalletAmount
        : totalPayment - totalWithDue;

    try {
      // Use a single transaction for everything
      return await this.prisma.$transaction(async (tx) => {
        // Create the order
        const orderId = crypto.randomUUID();

        // Update order items with orderId
        for (const itemData of orderItemsData) {
          itemData.orderId = orderId;
        }

        // Prepare payments data
        const paymentsData = createOrderDto.payments.map((payment) => ({
          id: crypto.randomUUID(),
          orderId,
          amount: payment.amount,
          method: payment.method,
          reference: payment.reference || null,
        }));

        // Create order
        await tx.order.create({
          data: {
            id: orderId,
            orderNumber,
            shopId,
            customerId,
            status: OrderStatus.COMPLETED,
            subtotal,
            discount,
            discountType: createOrderDto.discountType || DiscountType.FIXED,
            total: finalTotal,
            paid: totalPayment,
            note: createOrderDto.note,
          },
        });

        // Create order items
        for (const itemData of orderItemsData) {
          await tx.orderItem.create({
            data: itemData,
          });
        }

        // Create payments
        for (const paymentData of paymentsData) {
          await tx.payment.create({
            data: paymentData,
          });

          // Update shop balance for non-wallet payments
          if (paymentData.method !== PaymentMethod.WALLET) {
            await this.updateShopBalance(
              shopId,
              paymentData.method,
              paymentData.amount,
            );
          }
        }

        // Handle payment due
        if (useWalletToPayDue && customerId) {
          // Only adjust the wallet balance by the amount due being paid
          const wallet = await tx.customerWallet.findUnique({
            where: {
              customerId_shopId: {
                customerId,
                shopId,
              },
            },
          });

          if (wallet) {
            // If using duePaidAmount, only adjust by that amount
            // Otherwise clear the balance completely
            if (createOrderDto.duePaidAmount !== undefined) {
              const newBalance = Math.min(
                0,
                wallet.balance + createOrderDto.duePaidAmount,
              );
              await tx.customerWallet.update({
                where: {
                  customerId_shopId: {
                    customerId,
                    shopId,
                  },
                },
                data: {
                  balance: newBalance,
                },
              });
            } else {
              // Clear the payment due by setting wallet balance to 0
              await tx.customerWallet.update({
                where: {
                  customerId_shopId: {
                    customerId,
                    shopId,
                  },
                },
                data: {
                  balance: 0,
                },
              });
            }
          }
        }

        // Add extra payment to wallet if requested and customer exists
        if (
          extraPayment > 0 &&
          customerId &&
          (createOrderDto.storeExtraInWallet ||
            createOrderDto.extraWalletAmount !== undefined)
        ) {
          await this.updateCustomerWallet(customerId, shopId, extraPayment, 0);
        }

        // Get the complete order with all relations
        const completedOrder = await tx.order.findUnique({
          where: { id: orderId },
          include: {
            customer: {
              select: {
                id: true,
                name: true,
                email: true,
                contactNumber: true,
              },
            },
            orderItems: {
              include: {
                product: {
                  select: {
                    name: true,
                    imageUrls: true,
                  },
                },
              },
            },
            payments: true,
          },
        });

        return completedOrder;
      });
    } catch (error) {
      this.logger.error('Error creating order:', error);
      throw error;
    }
  }

  async getOrders(userId: string, query: OrderQueryDto): Promise<any> {
    const shopId = await this.getShopForUser(userId, query.shopId);

    // Build the query conditions
    const where: any = { shopId };

    if (query.customerId) {
      where.customerId = query.customerId;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.startDate) {
      where.createdAt = {
        ...(where.createdAt || {}),
        gte: new Date(query.startDate),
      };
    }

    if (query.endDate) {
      where.createdAt = {
        ...(where.createdAt || {}),
        lte: new Date(query.endDate),
      };
    }

    try {
      // Use Prisma's built-in methods
      const orders = await this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              email: true,
              contactNumber: true,
            },
          },
          orderItems: {
            include: {
              product: {
                select: {
                  name: true,
                  imageUrls: true,
                },
              },
            },
          },
          payments: true,
        },
      });

      return orders;
    } catch (error) {
      this.logger.error('Error fetching orders:', error);
      throw error;
    }
  }

  async getOrderById(userId: string, orderId: string): Promise<any> {
    try {
      // Since we just added these models to the schema but haven't generated the client yet,
      // we'll need to use $queryRaw for now
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              email: true,
              contactNumber: true,
            },
          },
          orderItems: {
            include: {
              product: {
                select: {
                  name: true,
                  imageUrls: true,
                },
              },
            },
          },
          payments: true,
        },
      });

      if (!order) {
        throw new NotFoundException(`Order with ID ${orderId} not found`);
      }

      // Verify user has access to this shop
      await this.getShopForUser(userId, order.shopId);

      return order;
    } catch (error) {
      this.logger.error('Error fetching order by ID:', error);
      throw error;
    }
  }
}
