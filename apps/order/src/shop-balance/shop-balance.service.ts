import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@app/common/database/prisma.service';
import { KMS } from '@aws-sdk/client-kms';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class ShopBalanceService {
  private readonly logger = new Logger(ShopBalanceService.name);
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
    if (!text) {
      this.logger.warn(
        'Attempting to decrypt null or empty value, returning "0"',
      );
      return '0';
    }

    if (text === '0') return text;

    if (!this.kmsKeyId && !this.kmsKeyAlias) {
      this.logger.debug('No KMS key configured, returning text as-is');
      return text;
    }

    if (text.startsWith('fb:')) {
      return this.decryptLocal(text);
    }

    try {
      const encryptedBuffer = Buffer.from(text, 'base64');
      const response = await this.kmsClient.decrypt({
        CiphertextBlob: encryptedBuffer,
      });
      return Buffer.from(response.Plaintext).toString('utf8');
    } catch (error) {
      this.logger.error(
        `KMS Decryption error for value: ${text.substring(0, 10)}...`,
        error,
      );
      if (text.startsWith('fb:')) {
        return this.decryptLocal(text);
      }
      this.logger.warn('Returning original text due to decryption failure');
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
      this.logger.error(
        `Local decryption error for value: ${encryptedText.substring(0, 20)}...`,
        error,
      );
      return '0'; // Return '0' instead of the original encrypted text on failure
    }
  }

  private async decryptPaymentData(payment: any): Promise<any> {
    const decryptedPayment = { ...payment };

    if (decryptedPayment.amount) {
      try {
        const decryptedAmount = await this.decrypt(decryptedPayment.amount);
        decryptedPayment.amount = parseFloat(decryptedAmount);
      } catch (error) {
        this.logger.error(`Error decrypting payment amount: ${error.message}`);
        decryptedPayment.amount = 0; // Default to 0 on error
      }
    }

    return decryptedPayment;
  }

  /**
   * Get shop balance information
   * @param shopId Shop ID
   * @returns Shop balance and payment history
   */
  async getShopBalance(shopId: string) {
    try {
      // Get shop balance
      const shopBalance = await this.prisma.shopBalance.findUnique({
        where: {
          shopId,
        },
      });

      if (!shopBalance) {
        return {
          balance: {
            cashBalance: 0,
            cardBalance: 0,
            bankBalance: 0,
          },
          payments: [],
        };
      }

      // Decrypt balance data
      let decryptedCashBalance = 0;
      let decryptedCardBalance = 0;
      let decryptedBankBalance = 0;

      try {
        decryptedCashBalance = parseFloat(
          await this.decrypt(shopBalance.cashBalance || '0'),
        );
      } catch (e) {
        this.logger.error(`Failed to decrypt cashBalance: ${e.message}`);
      }

      try {
        decryptedCardBalance = parseFloat(
          await this.decrypt(shopBalance.cardBalance || '0'),
        );
      } catch (e) {
        this.logger.error(`Failed to decrypt cardBalance: ${e.message}`);
      }

      try {
        decryptedBankBalance = parseFloat(
          await this.decrypt(shopBalance.bankBalance || '0'),
        );
      } catch (e) {
        this.logger.error(`Failed to decrypt bankBalance: ${e.message}`);
      }

      const decryptedBalance = {
        ...shopBalance,
        cashBalance: decryptedCashBalance,
        cardBalance: decryptedCardBalance,
        bankBalance: decryptedBankBalance,
      };

      // Calculate total from payments as a verification
      const payments = await this.prisma.payment.findMany({
        where: {
          order: {
            shopId,
          },
        },
        include: {
          order: {
            select: {
              orderNumber: true,
              customerId: true,
              createdAt: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      // Decrypt payment data
      const decryptedPayments = await Promise.all(
        payments.map((payment) => this.decryptPaymentData(payment)),
      );

      // Calculate totals by payment method for verification
      const totals = {
        CASH: 0,
        CARD: 0,
        BANK: 0,
        WALLET: 0,
      };

      for (const payment of decryptedPayments) {
        if (payment.method && payment.amount) {
          totals[payment.method] += payment.amount;
        }
      }

      // Log any discrepancies
      if (Math.abs(totals.CASH - decryptedCashBalance) > 1) {
        this.logger.warn(
          `Cash balance discrepancy: DB shows ${decryptedCashBalance}, payments total ${totals.CASH}`,
        );
      }
      if (Math.abs(totals.CARD - decryptedCardBalance) > 1) {
        this.logger.warn(
          `Card balance discrepancy: DB shows ${decryptedCardBalance}, payments total ${totals.CARD}`,
        );
      }
      if (Math.abs(totals.BANK - decryptedBankBalance) > 1) {
        this.logger.warn(
          `Bank balance discrepancy: DB shows ${decryptedBankBalance}, payments total ${totals.BANK}`,
        );
      }

      return {
        balance: decryptedBalance,
        payments: decryptedPayments,
        calculatedTotals: totals, // Include calculated totals for comparison
      };
    } catch (error) {
      this.logger.error('Error getting shop balance:', error);
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
}
