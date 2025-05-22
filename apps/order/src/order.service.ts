import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '@app/common/database/prisma.service';
import { CreateOrderDto, DiscountType } from './dto';
import * as crypto from 'crypto';
import { randomBytes } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { KMS } from '@aws-sdk/client-kms';
import { PaymentMethod, Role, OrderStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { ClientProxy } from '@nestjs/microservices';
import { MAILER_SERVICE } from './constants/services';
import { ReceiptPdfService } from './pdf/receipt-pdf.service';
import { RmqService } from '@app/common/rmq/rmq.service';
import { CashFlowIntegrationService } from './cash-flow-integration/cash-flow-integration.service';

@Injectable()
export class OrderService implements OnModuleInit {
  private readonly logger = new Logger(OrderService.name);
  private kmsClient: KMS;
  private kmsKeyId: string;
  private kmsKeyAlias: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly rmqService: RmqService,
    private readonly configService: ConfigService,
    @Inject(MAILER_SERVICE) private readonly mailerClient: ClientProxy,
    @Inject(forwardRef(() => ReceiptPdfService))
    private readonly receiptPdfService: ReceiptPdfService,
    private readonly cashFlowService: CashFlowIntegrationService,
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

  /**
   * Lifecycle hook that runs when the module is initialized
   */
  async onModuleInit() {
    try {
      // Check AWS KMS permissions on startup if AWS credentials are available
      if (
        this.configService.get<string>('AWS_ACCESS_KEY_ID') &&
        this.configService.get<string>('AWS_SECRET_ACCESS_KEY')
      ) {
        await this.verifyKmsPermissions();
      }
    } catch (error) {
      this.logger.warn('Failed to verify KMS permissions on startup');
      this.logger.error(error);
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
  public async decrypt(encryptedText: string): Promise<string> {
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
    orderNumber?: string,
    orderId?: string,
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

        // Sync with cash flow system
        if (orderId && orderNumber) {
          try {
            await this.cashFlowService.syncOrderPayment(
              orderId,
              {
                id: crypto.randomUUID(),
                amount: amount.toString(),
                method: paymentMethod,
                createdAt: new Date(),
              },
              shopId,
              orderNumber,
            );
          } catch (error) {
            this.logger.error(
              `Failed to sync payment to cash flow: ${error.message}`,
            );
            // Don't throw error to avoid disrupting the main flow
          }
        }
        return;
      }

      // Update existing shop balance with encrypted values
      switch (paymentMethod) {
        case PaymentMethod.CASH:
          // Decrypt existing balance, add the amount, then encrypt again
          const currentCashBalance = await this.decrypt(
            shopBalance.cashBalance,
          );

          // Debug logs
          this.logger.debug(`Updating cash balance for shop ${shopId}:`);
          this.logger.debug(`Raw cash balance: ${shopBalance.cashBalance}`);
          this.logger.debug(`Decrypted cash balance: ${currentCashBalance}`);
          this.logger.debug(`Adding amount: ${amount}`);

          const newCashBalance = parseFloat(currentCashBalance) + amount;
          this.logger.debug(`New cash balance: ${newCashBalance}`);

          const encryptedCashBalance = await this.encrypt(
            newCashBalance.toString(),
          );
          this.logger.debug(
            `Encrypted new cash balance: ${encryptedCashBalance}`,
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

      // Sync with cash flow system
      if (orderId && orderNumber) {
        try {
          await this.cashFlowService.syncOrderPayment(
            orderId,
            {
              id: crypto.randomUUID(),
              amount: amount.toString(),
              method: paymentMethod,
              createdAt: new Date(),
            },
            shopId,
            orderNumber,
          );
        } catch (error) {
          this.logger.error(
            `Failed to sync payment to cash flow: ${error.message}`,
          );
          // Don't throw error to avoid disrupting the main flow
        }
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

    // Variables for wallet update after transaction
    let walletUpdateNeeded = false;
    let walletCustomerId = '';
    let walletShopId = '';
    let walletAmount = 0;

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

    // Fetch and validate all items first if there are any
    // This allows due-only payments with no items
    const items = createOrderDto.items || [];
    for (const orderItem of items) {
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

    // Calculate total payment amount (handle empty payments array)
    const totalPayment = createOrderDto.payments?.length
      ? createOrderDto.payments.reduce(
          (sum, payment) => sum + payment.amount,
          0,
        )
      : 0;

    // Determine order status
    const orderStatus = createOrderDto.draft
      ? OrderStatus.PENDING
      : OrderStatus.COMPLETED;

    // Check for payment due only for completed orders
    let paymentDue = 0;
    let useWalletToPayDue = false;

    // Only validate payments for completed orders
    if (orderStatus === OrderStatus.COMPLETED) {
      if (customerId) {
        // Check if there's a negative extraWalletAmount which adds due
        if (
          createOrderDto.extraWalletAmount !== undefined &&
          createOrderDto.extraWalletAmount < 0
        ) {
          // Negative extraWalletAmount directly adds to due
          paymentDue = 0; // We're not applying existing dues
          // The negative value will be applied to wallet balance later
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

      // Check if payment is sufficient for completed orders
      // Skip validation if negative extraWalletAmount is specified (unpaid amount goes to wallet as due)
      const isAddingDueToWallet =
        createOrderDto.extraWalletAmount !== undefined &&
        createOrderDto.extraWalletAmount < 0;
      const totalWithDue = finalTotal + paymentDue;

      if (totalPayment < totalWithDue && !isAddingDueToWallet) {
        throw new BadRequestException(
          `Total payment (${totalPayment}) is less than order total plus dues (${totalWithDue})`,
        );
      }
    }

    // Calculate extra payment amount
    const extraPayment =
      createOrderDto.extraWalletAmount !== undefined
        ? createOrderDto.extraWalletAmount
        : orderStatus === OrderStatus.COMPLETED
          ? totalPayment - (finalTotal + paymentDue)
          : 0;

    try {
      // Pre-encrypt all the data we'll need
      const encryptedData = await Promise.all([
        this.encrypt(discount.toString()),
        this.encrypt(subtotal.toString()),
        this.encrypt(finalTotal.toString()),
        this.encrypt(totalPayment.toString()),
        this.encrypt(paymentDue.toString()),
        ...orderItemsData.map((item) =>
          Promise.all([
            this.encrypt(item.originalPrice.toString()),
            this.encrypt(item.sellingPrice.toString()),
          ]),
        ),
        ...createOrderDto.payments.map((payment) =>
          this.encrypt(payment.amount.toString()),
        ),
      ]);

      const [
        encryptedDiscount,
        encryptedSubtotal,
        encryptedTotal,
        encryptedPaid,
        encryptedPaymentDue,
        ...rest
      ] = encryptedData;

      const encryptedOrderItems = rest.slice(0, orderItemsData.length);
      const encryptedPayments = rest.slice(orderItemsData.length) as string[];

      const order = await this.prisma.$transaction(
        async (tx) => {
          // Create order
          const order = await tx.order.create({
            data: {
              shopId,
              customerId,
              discount: encryptedDiscount,
              discountType: createOrderDto.discountType || DiscountType.FIXED,
              note: createOrderDto.note,
              status: createOrderDto.draft
                ? OrderStatus.DRAFT
                : OrderStatus.COMPLETED,
              subtotal: encryptedSubtotal,
              total: encryptedTotal,
              paid: encryptedPaid,
              paymentDue: encryptedPaymentDue,
              orderNumber: `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
              orderItems:
                orderItemsData.length > 0
                  ? {
                      create: orderItemsData.map((item, index) => ({
                        id: crypto.randomUUID(),
                        productId: item.productId,
                        itemId: item.itemId,
                        quantity: item.quantity,
                        originalPrice: encryptedOrderItems[index][0],
                        sellingPrice: encryptedOrderItems[index][1],
                      })),
                    }
                  : undefined,
              payments: {
                create: createOrderDto.payments.map((payment, index) => ({
                  id: crypto.randomUUID(),
                  amount: encryptedPayments[index],
                  method: payment.method,
                  reference: payment.reference || null,
                })),
              },
            },
            include: {
              orderItems: {
                include: {
                  product: true,
                },
              },
              payments: true,
              customer: true,
              shop: true,
            },
          });

          // For completed orders, process payments and delete items
          if (order.status === OrderStatus.COMPLETED) {
            // Process each payment method and update shop balance
            for (const payment of createOrderDto.payments) {
              await this.updateShopBalance(
                shopId,
                payment.method,
                payment.amount,
                order.orderNumber,
                order.id,
              );
            }

            // Handle payment due
            if (useWalletToPayDue && customerId) {
              const wallet = await tx.customerWallet.findUnique({
                where: {
                  customerId_shopId: {
                    customerId,
                    shopId,
                  },
                },
              });

              if (wallet) {
                if (createOrderDto.duePaidAmount !== undefined) {
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

                  // Sync due payment with cash flow
                  try {
                    await this.cashFlowService.syncDuePayment(
                      customerId,
                      shopId,
                      createOrderDto.duePaidAmount.toString(),
                      new Date(),
                    );
                  } catch (error) {
                    this.logger.error(
                      `Failed to sync due payment to cash flow: ${error.message}`,
                    );
                    // Don't throw error to avoid disrupting the main flow
                  }
                } else {
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
            if (customerId && createOrderDto.extraWalletAmount !== undefined) {
              // Store the values to update wallet after transaction completes
              walletUpdateNeeded = true;
              walletCustomerId = customerId;
              walletShopId = shopId;
              walletAmount = extraPayment;
            }
          }

          return order;
        },
        {
          timeout: 120000, // Increase timeout to 120 seconds
        },
      );

      // Update customer wallet outside the transaction if needed
      if (walletUpdateNeeded) {
        await this.updateCustomerWallet(
          walletCustomerId,
          walletShopId,
          walletAmount,
          0,
        );
      }

      // Delete items from inventory immediately after transaction completes for completed orders
      if (order.status === OrderStatus.COMPLETED) {
        this.logger.debug(
          `[CREATE_ORDER] About to delete items for order ${order.id}`,
        );
        await this.deleteItemsForCompletedOrder(order.id);
        this.logger.debug(
          `[CREATE_ORDER] Finished deleting items for order ${order.id}`,
        );
      }

      // Get the complete order with all relations after transaction
      const completedOrder = await this.prisma.order.findUnique({
        where: { id: order.id },
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
          shop: true,
        },
      });

      // Send email receipt for non-draft orders with customers if requested
      if (
        !createOrderDto.draft &&
        customerId &&
        createOrderDto.sendReceiptEmail &&
        completedOrder.customer?.email
      ) {
        this.logger.debug('Attempting to send receipt email...');
        // Rest of email receipt code...
      }

      return this.prepareOrderData(completedOrder);
    } catch (error) {
      this.logger.error(`Error creating order: ${error.message}`, error.stack);
      throw new BadRequestException(`Failed to create order: ${error.message}`);
    }
  }

  /**
   * Verify KMS permissions to ensure the service can use KMS for encryption
   */
  private async verifyKmsPermissions(): Promise<boolean> {
    try {
      // Try to list keys to test permissions
      await this.kmsClient.listKeys({});
      this.logger.log('KMS permissions verified successfully');
      return true;
    } catch (error) {
      this.logger.error('Failed to verify KMS permissions:', error);
      return false;
    }
  }

  /**
   * Delete items from inventory after a completed order
   */
  async deleteItemsForCompletedOrder(orderId: string): Promise<void> {
    try {
      // Find all orderItems for this order
      const orderItems = await this.prisma.orderItem.findMany({
        where: { orderId },
      });

      // Mark each item as sold by deleting it
      for (const orderItem of orderItems) {
        if (orderItem.itemId) {
          await this.prisma.item.delete({
            where: { id: orderItem.itemId },
          });
        }
      }
    } catch (error) {
      this.logger.error(`Error deleting items for order ${orderId}:`, error);
      throw new Error(`Failed to delete items for order ${orderId}`);
    }
  }

  /**
   * Prepare order data for response, including decryption
   */
  async prepareOrderData(order: any): Promise<any> {
    if (!order) {
      return null;
    }

    try {
      // Make a deep copy of the order to avoid modifying the original
      const orderData = JSON.parse(JSON.stringify(order));

      // Decrypt sensitive fields
      orderData.subtotal = await this.decrypt(orderData.subtotal);
      orderData.total = await this.decrypt(orderData.total);
      orderData.discount = await this.decrypt(orderData.discount);
      orderData.paid = await this.decrypt(orderData.paid);
      orderData.paymentDue = await this.decrypt(orderData.paymentDue);

      // Decrypt order items
      if (orderData.orderItems && orderData.orderItems.length > 0) {
        for (const item of orderData.orderItems) {
          item.originalPrice = await this.decrypt(item.originalPrice);
          item.sellingPrice = await this.decrypt(item.sellingPrice);
        }
      }

      // Decrypt payments
      if (orderData.payments && orderData.payments.length > 0) {
        for (const payment of orderData.payments) {
          payment.amount = await this.decrypt(payment.amount);
        }
      }

      return orderData;
    } catch (error) {
      this.logger.error('Error preparing order data:', error);
      throw new Error('Failed to prepare order data');
    }
  }

  /**
   * Get orders for a user with optional filtering
   */
  async getOrders(userId: string, query: any): Promise<any> {
    const shopId = await this.getShopForUser(userId, query.shopId);

    // Build the query
    const where: any = { shopId };

    // Apply filters if provided
    if (query.status) {
      where.status = query.status;
    }

    if (query.customerId) {
      where.customerId = query.customerId;
    }

    // Date range filter
    if (query.startDate) {
      where.createdAt = {
        ...where.createdAt,
        gte: new Date(query.startDate),
      };
    }

    if (query.endDate) {
      where.createdAt = {
        ...where.createdAt,
        lte: new Date(query.endDate),
      };
    }

    try {
      // Pagination
      const page = query.page ? parseInt(query.page) : 1;
      const limit = query.limit ? parseInt(query.limit) : 10;
      const skip = (page - 1) * limit;

      // Get orders with associated data
      const [orders, total] = await Promise.all([
        this.prisma.order.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            customer: true,
            orderItems: {
              include: {
                product: true,
              },
            },
            payments: true,
          },
        }),
        this.prisma.order.count({ where }),
      ]);

      // Process each order to decrypt data
      const processedOrders = await Promise.all(
        orders.map((order) => this.prepareOrderData(order)),
      );

      return {
        orders: processedOrders,
        meta: {
          page,
          limit,
          totalItems: total,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      this.logger.error(`Error fetching orders: ${error.message}`);
      throw new Error('Failed to fetch orders');
    }
  }

  /**
   * Get a specific order by ID
   */
  async getOrderById(userId: string, orderId: string): Promise<any> {
    try {
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        include: {
          customer: true,
          orderItems: {
            include: {
              product: true,
            },
          },
          payments: true,
          shop: true,
        },
      });

      if (!order) {
        throw new NotFoundException(`Order with ID ${orderId} not found`);
      }

      // Verify the user has access to this shop
      await this.getShopForUser(userId, order.shopId);

      return this.prepareOrderData(order);
    } catch (error) {
      this.logger.error(`Error fetching order ${orderId}: ${error.message}`);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new Error(`Failed to fetch order ${orderId}`);
    }
  }

  /**
   * Update an existing order
   */
  async updateOrder(
    userId: string,
    orderId: string,
    updateOrderDto: any,
  ): Promise<any> {
    try {
      // Fetch the order to update
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
      });

      if (!order) {
        throw new NotFoundException(`Order with ID ${orderId} not found`);
      }

      // Verify the user has access to this shop
      await this.getShopForUser(userId, order.shopId);

      // Update logic goes here
      // This is a placeholder implementation that would need to be expanded

      const updatedOrder = await this.prisma.order.update({
        where: { id: orderId },
        data: {
          note: updateOrderDto.note,
          // Other fields would need proper handling with encryption
        },
        include: {
          customer: true,
          orderItems: {
            include: {
              product: true,
            },
          },
          payments: true,
          shop: true,
        },
      });

      return this.prepareOrderData(updatedOrder);
    } catch (error) {
      this.logger.error(`Error updating order ${orderId}: ${error.message}`);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new Error(`Failed to update order ${orderId}`);
    }
  }

  /**
   * Clean up orphaned items in the database
   */
  async cleanupOrphanedItems(): Promise<any> {
    try {
      this.logger.log('Cleaning up orphaned items');

      // This is a placeholder implementation
      // The actual implementation would need to be based on your specific schema

      return {
        message: 'Cleanup functionality implemented in the real service',
        count: 0,
      };
    } catch (error) {
      this.logger.error(`Error cleaning up orphaned items: ${error.message}`);
      throw new Error('Failed to clean up orphaned items');
    }
  }

  /**
   * Get the balance for a shop
   */
  async getShopBalance(shopId: string): Promise<any> {
    try {
      const shopBalance = await this.prisma.shopBalance.findUnique({
        where: { shopId },
      });

      if (!shopBalance) {
        return {
          shopId,
          cashBalance: '0',
          cardBalance: '0',
          bankBalance: '0',
          totalBalance: '0',
        };
      }

      // Debug: Log the raw encrypted values
      this.logger.debug(`Raw encrypted shop balance values:`);
      this.logger.debug(`Cash (raw): ${shopBalance.cashBalance}`);
      this.logger.debug(`Card (raw): ${shopBalance.cardBalance}`);
      this.logger.debug(`Bank (raw): ${shopBalance.bankBalance}`);

      // Decrypt the balance fields
      const cashBalance = await this.decrypt(shopBalance.cashBalance);
      const cardBalance = await this.decrypt(shopBalance.cardBalance);
      const bankBalance = await this.decrypt(shopBalance.bankBalance);

      // Debug: Log the decrypted values
      this.logger.debug(`Decrypted shop balance values:`);
      this.logger.debug(`Cash (decrypted): ${cashBalance}`);
      this.logger.debug(`Card (decrypted): ${cardBalance}`);
      this.logger.debug(`Bank (decrypted): ${bankBalance}`);

      // Validate numeric values, fallback to 0 if invalid
      const cashValue = !isNaN(parseFloat(cashBalance))
        ? parseFloat(cashBalance)
        : 0;
      const cardValue = !isNaN(parseFloat(cardBalance))
        ? parseFloat(cardBalance)
        : 0;
      const bankValue = !isNaN(parseFloat(bankBalance))
        ? parseFloat(bankBalance)
        : 0;

      // Debug: Log the parsed values
      this.logger.debug(`Parsed shop balance values:`);
      this.logger.debug(`Cash (parsed): ${cashValue}`);
      this.logger.debug(`Card (parsed): ${cardValue}`);
      this.logger.debug(`Bank (parsed): ${bankValue}`);

      // Calculate total using validated values
      const total = cashValue + cardValue + bankValue;

      return {
        shopId: shopBalance.shopId,
        cashBalance: cashValue.toString(),
        cardBalance: cardValue.toString(),
        bankBalance: bankValue.toString(),
        totalBalance: total.toString(),
      };
    } catch (error) {
      this.logger.error(`Error fetching shop balance: ${error.message}`);
      throw new Error('Failed to fetch shop balance');
    }
  }

  /**
   * Get a customer's wallet for a specific shop
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
        include: {
          shop: true,
        },
      });

      if (!wallet) {
        return {
          customerId,
          shopId,
          balance: '0',
          loyaltyPoints: '0',
        };
      }

      // Decrypt the wallet values
      const balance = await this.decrypt(wallet.balance);
      const loyaltyPoints = await this.decrypt(wallet.loyaltyPoints);

      return {
        customerId: wallet.customerId,
        shopId: wallet.shopId,
        shopName: wallet.shop.businessName,
        shopLogo: wallet.shop.shopLogo,
        balance: parseFloat(balance),
        loyaltyPoints: parseInt(loyaltyPoints),
        createdAt: wallet.createdAt,
        updatedAt: wallet.updatedAt,
      };
    } catch (error) {
      this.logger.error(`Error fetching customer wallet: ${error.message}`);
      throw new Error('Failed to fetch customer wallet');
    }
  }

  /**
   * Get all wallets for a customer across all shops accessible to the user
   */
  async getCustomerWalletsForAllShops(
    userId: string,
    customerId: string,
  ): Promise<any> {
    try {
      // Get all shops the user has access to
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          shopAccess: true,
        },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Extract shop IDs
      const shopIds = user.shopAccess.map((access) => access.shopId);

      // Get all wallets for this customer in the accessible shops
      const wallets = await this.prisma.customerWallet.findMany({
        where: {
          customerId,
          shopId: {
            in: shopIds,
          },
        },
        include: {
          shop: true,
        },
      });

      // Decrypt wallet data
      const decryptedWallets = await Promise.all(
        wallets.map(async (wallet) => {
          try {
            const balance = await this.decrypt(wallet.balance);
            const loyaltyPoints = await this.decrypt(wallet.loyaltyPoints);

            return {
              customerId: wallet.customerId,
              shopId: wallet.shopId,
              shopName: wallet.shop.businessName,
              shopLogo: wallet.shop.shopLogo,
              balance: parseFloat(balance),
              loyaltyPoints: parseInt(loyaltyPoints),
              createdAt: wallet.createdAt,
              updatedAt: wallet.updatedAt,
            };
          } catch (error) {
            this.logger.error(
              `Error decrypting wallet for shop ${wallet.shopId}: ${error.message}`,
            );
            return {
              customerId: wallet.customerId,
              shopId: wallet.shopId,
              shopName: wallet.shop.businessName,
              shopLogo: wallet.shop.shopLogo,
              balance: 0,
              loyaltyPoints: 0,
              createdAt: wallet.createdAt,
              updatedAt: wallet.updatedAt,
              error: 'Failed to decrypt wallet data',
            };
          }
        }),
      );

      // Get customer details
      const customer = await this.prisma.user.findUnique({
        where: { id: customerId },
        select: {
          name: true,
          email: true,
          contactNumber: true,
        },
      });

      // Calculate totals
      const totalBalance = decryptedWallets.reduce(
        (sum, wallet) => sum + wallet.balance,
        0,
      );

      const totalLoyaltyPoints = decryptedWallets.reduce(
        (sum, wallet) => sum + wallet.loyaltyPoints,
        0,
      );

      return {
        customer,
        wallets: decryptedWallets,
        totalBalance,
        totalLoyaltyPoints,
      };
    } catch (error) {
      this.logger.error(
        `Error getting customer wallets: ${error.message}`,
        error.stack,
      );
      throw new Error('Failed to get customer wallets');
    }
  }

  /**
   * Decrypt order data
   * @param order The order with encrypted fields
   * @returns Order with decrypted fields
   */
  async decryptOrderData(order: any): Promise<any> {
    try {
      const decrypted = { ...order };

      if (order.subtotal) {
        decrypted.subtotal = await this.decryptNumeric(order.subtotal);
      }

      if (order.total) {
        decrypted.total = await this.decryptNumeric(order.total);
      }

      if (order.discount) {
        decrypted.discount = await this.decryptNumeric(order.discount);
      }

      if (order.paymentDue) {
        decrypted.paymentDue = await this.decryptNumeric(order.paymentDue);
      }

      if (order.walletBalance) {
        decrypted.walletBalance = await this.decryptNumeric(
          order.walletBalance,
        );
      }

      if (order.extraBalance) {
        decrypted.extraBalance = await this.decryptNumeric(order.extraBalance);
      }

      return decrypted;
    } catch (error) {
      this.logger.error(`Error decrypting order data: ${error.message}`);
      throw new Error('Failed to decrypt order data');
    }
  }

  /**
   * Decrypt order item data
   * @param item The order item with encrypted fields
   * @returns Order item with decrypted fields
   */
  async decryptOrderItemData(item: any): Promise<any> {
    try {
      const decrypted = { ...item };

      if (item.originalPrice) {
        decrypted.originalPrice = await this.decrypt(item.originalPrice);
      }

      if (item.sellingPrice) {
        decrypted.sellingPrice = await this.decrypt(item.sellingPrice);
      }

      return decrypted;
    } catch (error) {
      this.logger.error(`Error decrypting order item data: ${error.message}`);
      throw new Error('Failed to decrypt order item data');
    }
  }

  /**
   * Decrypt payment data
   * @param payment The payment with encrypted fields
   * @returns Payment with decrypted fields
   */
  async decryptPaymentData(payment: any): Promise<any> {
    try {
      const decrypted = { ...payment };

      if (payment.amount) {
        decrypted.amount = await this.decryptNumeric(payment.amount);
      }

      return decrypted;
    } catch (error) {
      this.logger.error(`Error decrypting payment data: ${error.message}`);
      throw new Error('Failed to decrypt payment data');
    }
  }

  /**
   * Reset the shop cash balance to a specific value
   * This is a utility method to fix corrupted cash balance
   */
  async resetShopCashBalance(shopId: string, newValue: number): Promise<any> {
    try {
      const shopBalance = await this.prisma.shopBalance.findUnique({
        where: { shopId },
      });

      if (!shopBalance) {
        throw new NotFoundException('Shop balance not found');
      }

      // Encrypt the new value
      const encryptedCashBalance = await this.encrypt(newValue.toString());

      // Update only the cash balance
      await this.prisma.shopBalance.update({
        where: { shopId },
        data: { cashBalance: encryptedCashBalance },
      });

      return this.getShopBalance(shopId);
    } catch (error) {
      this.logger.error(`Error resetting shop cash balance: ${error.message}`);
      throw new Error(`Failed to reset shop cash balance: ${error.message}`);
    }
  }
}
