import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
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
export class OrderService implements OnModuleInit {
  private readonly logger = new Logger(OrderService.name);
  private kmsClient: KMS;
  private kmsKeyId: string;
  private kmsKeyAlias: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    // Debug logging to check environment variables
    this.logger.debug('AWS Configuration:');
    this.logger.debug(
      `Region: ${this.configService.get<string>('AWS_REGION')}`,
    );
    this.logger.debug(
      `Key ID: ${this.configService.get<string>('AWS_KMS_KEY_ID')}`,
    );
    this.logger.debug(
      `Key Alias: ${this.configService.get<string>('AWS_KMS_KEY_ALIAS')}`,
    );
    this.logger.debug(
      `Has Access Key: ${!!this.configService.get<string>('AWS_ACCESS_KEY_ID')}`,
    );
    this.logger.debug(
      `Has Secret Key: ${!!this.configService.get<string>('AWS_SECRET_ACCESS_KEY')}`,
    );

    this.kmsKeyId = this.configService.get<string>('AWS_KMS_KEY_ID');
    this.kmsKeyAlias = this.configService.get<string>('AWS_KMS_KEY_ALIAS');

    // Only initialize AWS KMS client if credentials are available
    if (
      this.configService.get<string>('AWS_ACCESS_KEY_ID') &&
      this.configService.get<string>('AWS_SECRET_ACCESS_KEY')
    ) {
      try {
        this.kmsClient = new KMS({
          region: this.configService.get<string>('AWS_REGION', 'us-east-1'),
          credentials: {
            accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID'),
            secretAccessKey: this.configService.get<string>(
              'AWS_SECRET_ACCESS_KEY',
            ),
          },
        });
        this.logger.log('AWS KMS client initialized successfully');
      } catch (error) {
        this.logger.error(
          'Failed to initialize AWS KMS client, using local encryption fallback',
          error,
        );
        this.kmsKeyId = null;
        this.kmsKeyAlias = null;
      }
    } else {
      this.logger.warn(
        'AWS credentials not found, using local encryption fallback',
      );
      // Initialize an empty KMS client to avoid null reference errors
      this.kmsClient = new KMS({ region: 'us-east-1' });
    }
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
      this.logger.warn('KMS Key ID not configured, using local encryption');
      return this.encryptLocal(text);
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
      // Use local encryption as fallback
      return this.encryptLocal(text);
    }
  }

  /**
   * Local encryption fallback using AES-256-CBC
   * @param text Data to encrypt
   * @returns Encrypted data with format: fb:{iv}:{key}:{encrypted}
   */
  private encryptLocal(text: string): string {
    try {
      const key = crypto.randomBytes(32);
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);

      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      return `fb:${iv.toString('hex')}:${key.toString('hex')}:${encrypted}`;
    } catch (error) {
      this.logger.error('Local encryption error:', error);
      // If all encryption fails, return the original text
      // This is not ideal for security but prevents application failure
      return text;
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
      if (!encryptedText.startsWith('fb:')) {
        return encryptedText;
      }
    }

    try {
      // Handle fallback encryption
      if (encryptedText.startsWith('fb:')) {
        return this.decryptLocal(encryptedText);
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

      // If it's a fallback encrypted value, try to decrypt it locally
      if (encryptedText.startsWith('fb:')) {
        return this.decryptLocal(encryptedText);
      }

      return encryptedText; // Return original on failure
    }
  }

  /**
   * Local decryption for fallback encrypted data
   * @param encryptedText Encrypted data with format: fb:{iv}:{key}:{encrypted}
   * @returns Decrypted data
   */
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
      return encryptedText; // Return original on failure
    }
  }

  /**
   * Encrypt a numeric value for storage in the database
   * This is used for fields that are not yet string types in the database schema
   * @param value The numeric value to encrypt
   * @returns The encrypted value or the original value if encryption fails
   */
  private async encryptNumeric(value: number): Promise<number> {
    try {
      // For now, we just log that we would encrypt this but return the original value
      // since the schema still expects a number
      this.logger.debug(`Would encrypt: ${value}`);
      return value;
    } catch (error) {
      this.logger.error('Error encrypting numeric value:', error);
      return value;
    }
  }

  /**
   * Decrypt a numeric value from the database
   * This is used for fields that are not yet string types in the database schema
   * @param value The value to decrypt
   * @returns The decrypted value as a number
   */
  private async decryptNumeric(value: number): Promise<number> {
    try {
      // For now, return the original value since the schema still expects a number
      // Once schema is updated, this will decrypt the string and convert to number
      return value;
    } catch (error) {
      this.logger.error('Error decrypting numeric value:', error);
      return value;
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
        // Create a new shop balance record with encrypted values
        const encryptedCashBalance =
          paymentMethod === PaymentMethod.CASH
            ? await this.encrypt(amount.toString())
            : await this.encrypt('0');
        const encryptedCardBalance =
          paymentMethod === PaymentMethod.CARD
            ? await this.encrypt(amount.toString())
            : await this.encrypt('0');
        const encryptedBankBalance =
          paymentMethod === PaymentMethod.BANK
            ? await this.encrypt(amount.toString())
            : await this.encrypt('0');

        await this.prisma.shopBalance.create({
          data: {
            shopId,
            cashBalance: encryptedCashBalance,
            cardBalance: encryptedCardBalance,
            bankBalance: encryptedBankBalance,
          },
        });
        return;
      }

      // Update existing shop balance with encrypted values
      switch (paymentMethod) {
        case PaymentMethod.CASH:
          // Decrypt existing balance, add the amount, then encrypt again
          const currentCashBalance = await this.decrypt(
            shopBalance.cashBalance,
          );
          const newCashBalance = parseFloat(currentCashBalance) + amount;
          const encryptedCashBalance = await this.encrypt(
            newCashBalance.toString(),
          );

          await this.prisma.shopBalance.update({
            where: { shopId },
            data: { cashBalance: encryptedCashBalance },
          });
          break;
        case PaymentMethod.CARD:
          // Decrypt existing balance, add the amount, then encrypt again
          const currentCardBalance = await this.decrypt(
            shopBalance.cardBalance,
          );
          const newCardBalance = parseFloat(currentCardBalance) + amount;
          const encryptedCardBalance = await this.encrypt(
            newCardBalance.toString(),
          );

          await this.prisma.shopBalance.update({
            where: { shopId },
            data: { cardBalance: encryptedCardBalance },
          });
          break;
        case PaymentMethod.BANK:
          // Decrypt existing balance, add the amount, then encrypt again
          const currentBankBalance = await this.decrypt(
            shopBalance.bankBalance,
          );
          const newBankBalance = parseFloat(currentBankBalance) + amount;
          const encryptedBankBalance = await this.encrypt(
            newBankBalance.toString(),
          );

          await this.prisma.shopBalance.update({
            where: { shopId },
            data: { bankBalance: encryptedBankBalance },
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
        // Create a new wallet with encrypted values
        const encryptedBalance = await this.encrypt(amount.toString());
        const encryptedLoyaltyPoints = await this.encrypt(
          loyaltyPoints.toString(),
        );

        await this.prisma.customerWallet.create({
          data: {
            customerId,
            shopId,
            balance: encryptedBalance,
            loyaltyPoints: encryptedLoyaltyPoints,
          },
        });
        return;
      }

      // Update existing wallet with encryption
      const currentBalance = await this.decrypt(wallet.balance);
      const currentLoyaltyPoints = await this.decrypt(wallet.loyaltyPoints);

      const newBalance = parseFloat(currentBalance) + amount;
      const newLoyaltyPoints = parseInt(currentLoyaltyPoints) + loyaltyPoints;

      const encryptedBalance = await this.encrypt(newBalance.toString());
      const encryptedLoyaltyPoints = await this.encrypt(
        newLoyaltyPoints.toString(),
      );

      await this.prisma.customerWallet.update({
        where: {
          customerId_shopId: {
            customerId,
            shopId,
          },
        },
        data: {
          balance: encryptedBalance,
          loyaltyPoints: encryptedLoyaltyPoints,
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

      if (!wallet) {
        return 0;
      }

      // Decrypt the balance
      const decryptedBalance = await this.decrypt(wallet.balance);
      return parseFloat(decryptedBalance);
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
        let itemPrice: number;
        if (orderItem.customPrice !== undefined) {
          itemPrice = parseFloat(orderItem.customPrice.toString());
        } else {
          const sellPrice =
            typeof item.sellPrice === 'string'
              ? parseFloat(item.sellPrice)
              : item.sellPrice;
          itemPrice = sellPrice;
        }
        itemSubtotal += itemPrice;

        orderItemsData.push({
          id: crypto.randomUUID(),
          productId: orderItem.productId,
          itemId: item.id,
          quantity: 1,
          originalPrice: item.sellPrice,
          sellingPrice:
            orderItem.customPrice !== undefined
              ? orderItem.customPrice
              : item.sellPrice,
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
      // Pre-encrypt data outside of the transaction to reduce transaction time
      const orderData = await this.prepareOrderData({
        id: crypto.randomUUID(),
        orderNumber,
        shopId,
        customerId,
        status: OrderStatus.COMPLETED,
        subtotal,
        discount,
        discountType: createOrderDto.discountType || DiscountType.FIXED,
        total: finalTotal,
        paid: totalPayment,
        paymentDue,
        note: createOrderDto.note,
      });

      // Pre-encrypt order items data
      const preparedOrderItems = await Promise.all(
        orderItemsData.map(async (item) => {
          item.orderId = orderData.id;
          return await this.prepareOrderItemData(item);
        }),
      );

      // Pre-encrypt payments data
      const paymentsData = createOrderDto.payments.map((payment) => ({
        id: crypto.randomUUID(),
        orderId: orderData.id,
        amount: payment.amount,
        method: payment.method,
        reference: payment.reference || null,
      }));

      const preparedPayments = await Promise.all(
        paymentsData.map(
          async (payment) => await this.preparePaymentData(payment),
        ),
      );

      // Use a single transaction with increased timeout for everything
      return await this.prisma.$transaction(
        async (tx) => {
          // Create order
          await tx.order.create({
            data: orderData,
          });

          // Create order items
          for (const itemData of preparedOrderItems) {
            await tx.orderItem.create({
              data: itemData,
            });
          }

          // Create payments
          for (const paymentData of preparedPayments) {
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
                // Calculate new balance - can't go above 0 if it was negative
                const currentBalance = await this.decrypt(wallet.balance);
                const parsedBalance = parseFloat(currentBalance);
                const newBalance = Math.min(
                  0,
                  parsedBalance + createOrderDto.duePaidAmount,
                );
                const encryptedBalance = await this.encrypt(
                  newBalance.toString(),
                );

                await tx.customerWallet.update({
                  where: {
                    customerId_shopId: {
                      customerId,
                      shopId,
                    },
                  },
                  data: {
                    balance: encryptedBalance,
                  },
                });
              } else {
                // Clear the payment due by setting wallet balance to 0
                const encryptedZero = await this.encrypt('0');
                await tx.customerWallet.update({
                  where: {
                    customerId_shopId: {
                      customerId,
                      shopId,
                    },
                  },
                  data: {
                    balance: encryptedZero,
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
            await this.updateCustomerWallet(
              customerId,
              shopId,
              extraPayment,
              0,
            );
          }

          // Get the complete order with all relations
          const completedOrder = await tx.order.findUnique({
            where: { id: orderData.id },
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
        },
        {
          // Increase transaction timeout to 30 seconds to accommodate encryption operations
          timeout: 30000,
        },
      );
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

      // Decrypt all financial data
      const decryptedOrders = await Promise.all(
        orders.map(async (order) => {
          // Decrypt order data
          const decryptedOrder = await this.decryptOrderData(order);

          // Decrypt order items
          if (
            decryptedOrder.orderItems &&
            decryptedOrder.orderItems.length > 0
          ) {
            decryptedOrder.orderItems = await Promise.all(
              decryptedOrder.orderItems.map(
                async (item) => await this.decryptOrderItemData(item),
              ),
            );
          }

          // Decrypt payments
          if (decryptedOrder.payments && decryptedOrder.payments.length > 0) {
            decryptedOrder.payments = await Promise.all(
              decryptedOrder.payments.map(
                async (payment) => await this.decryptPaymentData(payment),
              ),
            );
          }

          return decryptedOrder;
        }),
      );

      return decryptedOrders;
    } catch (error) {
      this.logger.error('Error fetching orders:', error);
      throw error;
    }
  }

  async getOrderById(userId: string, orderId: string): Promise<any> {
    try {
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

      // Decrypt order data
      const decryptedOrder = await this.decryptOrderData(order);

      // Decrypt order items
      if (decryptedOrder.orderItems && decryptedOrder.orderItems.length > 0) {
        decryptedOrder.orderItems = await Promise.all(
          decryptedOrder.orderItems.map(
            async (item) => await this.decryptOrderItemData(item),
          ),
        );
      }

      // Decrypt payments
      if (decryptedOrder.payments && decryptedOrder.payments.length > 0) {
        decryptedOrder.payments = await Promise.all(
          decryptedOrder.payments.map(
            async (payment) => await this.decryptPaymentData(payment),
          ),
        );
      }

      return decryptedOrder;
    } catch (error) {
      this.logger.error('Error fetching order by ID:', error);
      throw error;
    }
  }

  /**
   * Helper method to prepare OrderItem data with encryption
   * @param item Original order item data
   * @returns Prepared order item data
   */
  private async prepareOrderItemData(item: any): Promise<any> {
    return {
      ...item,
      originalPrice: await this.encrypt(item.originalPrice.toString()),
      sellingPrice: await this.encrypt(item.sellingPrice.toString()),
    };
  }

  /**
   * Helper method to prepare Payment data with encryption
   * @param payment Original payment data
   * @returns Prepared payment data
   */
  private async preparePaymentData(payment: any): Promise<any> {
    return {
      ...payment,
      amount: await this.encrypt(payment.amount.toString()),
    };
  }

  /**
   * Helper method to prepare Order data with encryption
   * @param order Original order data
   * @returns Prepared order data
   */
  private async prepareOrderData(order: any): Promise<any> {
    return {
      ...order,
      subtotal: await this.encrypt(order.subtotal.toString()),
      discount: await this.encrypt(order.discount.toString()),
      total: await this.encrypt(order.total.toString()),
      paid: await this.encrypt(order.paid.toString()),
      paymentDue: await this.encrypt(order.paymentDue.toString()),
    };
  }

  /**
   * Helper method to decrypt Order data fields
   * @param order Encrypted order data
   * @returns Order with decrypted financial fields
   */
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

  /**
   * Helper method to decrypt OrderItem data fields
   * @param item Encrypted order item data
   * @returns Order item with decrypted financial fields
   */
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

  /**
   * Helper method to decrypt Payment data fields
   * @param payment Encrypted payment data
   * @returns Payment with decrypted financial fields
   */
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
   * Verify KMS key permissions by attempting a test encryption
   * This helps identify permission issues early
   */
  private async verifyKmsPermissions(): Promise<boolean> {
    if (!this.kmsKeyId && !this.kmsKeyAlias) {
      return false;
    }

    try {
      const testText = 'test-encryption';
      const encryptParams = {
        KeyId: this.kmsKeyId || `alias/${this.kmsKeyAlias}`,
        Plaintext: Buffer.from(testText),
      };

      const response = await this.kmsClient.encrypt(encryptParams);
      if (!response.CiphertextBlob) {
        throw new Error('Failed to encrypt test data with KMS');
      }

      this.logger.log('KMS permissions verified successfully');
      return true;
    } catch (error) {
      this.logger.error('KMS permission verification failed:', error);
      this.logger.warn('Switching to local encryption fallback');
      return false;
    }
  }

  async onModuleInit() {
    // Verify KMS permissions during application startup
    if (
      this.configService.get<string>('AWS_ACCESS_KEY_ID') &&
      this.configService.get<string>('AWS_SECRET_ACCESS_KEY')
    ) {
      const hasKmsPermissions = await this.verifyKmsPermissions();
      if (!hasKmsPermissions) {
        this.logger.warn(
          'KMS permissions check failed, using local encryption fallback',
        );
        this.kmsKeyId = null;
        this.kmsKeyAlias = null;
      }
    }
  }

  /**
   * Get shop balance with decrypted values
   * @param shopId Shop ID
   * @returns Shop balance with numeric values
   */
  async getShopBalance(shopId: string): Promise<any> {
    try {
      const shopBalance = await this.prisma.shopBalance.findUnique({
        where: { shopId },
      });

      if (!shopBalance) {
        return {
          cashBalance: 0,
          cardBalance: 0,
          bankBalance: 0,
        };
      }

      // Decrypt all balance values
      const cashBalance = parseFloat(
        await this.decrypt(shopBalance.cashBalance),
      );
      const cardBalance = parseFloat(
        await this.decrypt(shopBalance.cardBalance),
      );
      const bankBalance = parseFloat(
        await this.decrypt(shopBalance.bankBalance),
      );

      return {
        id: shopBalance.id,
        shopId: shopBalance.shopId,
        cashBalance,
        cardBalance,
        bankBalance,
        createdAt: shopBalance.createdAt,
        updatedAt: shopBalance.updatedAt,
      };
    } catch (error) {
      this.logger.error(
        `Error getting shop balance: ${error.message}`,
        error.stack,
      );
      throw new Error('Failed to get shop balance');
    }
  }

  /**
   * Get customer wallet with decrypted values
   * @param customerId Customer ID
   * @param shopId Shop ID
   * @returns Customer wallet with numeric values
   */
  async getCustomerWallet(customerId: string, shopId: string): Promise<any> {
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
        return {
          balance: 0,
          loyaltyPoints: 0,
        };
      }

      // Decrypt wallet values
      const balance = parseFloat(await this.decrypt(wallet.balance));
      const loyaltyPoints = parseInt(await this.decrypt(wallet.loyaltyPoints));

      return {
        customerId: wallet.customerId,
        shopId: wallet.shopId,
        balance,
        loyaltyPoints,
        createdAt: wallet.createdAt,
        updatedAt: wallet.updatedAt,
      };
    } catch (error) {
      this.logger.error(
        `Error getting customer wallet: ${error.message}`,
        error.stack,
      );
      throw new Error('Failed to get customer wallet');
    }
  }
}
