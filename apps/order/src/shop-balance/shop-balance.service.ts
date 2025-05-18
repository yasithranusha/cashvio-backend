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
          balance: null,
          payments: [],
        };
      }

      // Decrypt balance data
      const decryptedBalance = {
        ...shopBalance,
        cashBalance: parseFloat(await this.decrypt(shopBalance.cashBalance)),
        cardBalance: parseFloat(await this.decrypt(shopBalance.cardBalance)),
        bankBalance: parseFloat(await this.decrypt(shopBalance.bankBalance)),
      };

      // Get payment history
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

      return {
        balance: decryptedBalance,
        payments: decryptedPayments,
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
