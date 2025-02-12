import {
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { Role, Shop, User } from '@prisma/client';
import { SellerRegisterDto } from './dto/seller.dto';
import { MAILER_SERVICE } from './constants/services';
import { ClientProxy } from '@nestjs/microservices';
import { ShopRepository } from './repositories/shop.repository';
import { UserRepository } from './repositories/user.repository';
import { lastValueFrom, timeout, catchError, of } from 'rxjs';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import * as bcrypt from 'bcrypt';
import { registerMail } from './mail-templates/auth';

interface ShopWithUsers extends Shop {
  users: Array<Omit<User, 'password'>>;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly shopRepository: ShopRepository,
    private readonly userRepository: UserRepository,
    @Inject(MAILER_SERVICE) private mailerClient: ClientProxy,
  ) {}

  private async sendWelcomeEmail(user: {
    email: string;
    name: string;
  }): Promise<void> {
    try {
      const emailResult = await lastValueFrom(
        this.mailerClient
          .send('send_email', {
            recipients: [
              {
                address: user.email,
                name: user.name,
                variables: {
                  name: user.name,
                },
              },
            ],
            subject: 'Welcome to cashvio',
            html: registerMail,
          })
          .pipe(
            timeout(4000),
            catchError((error) => {
              this.logger.error('Failed to send email:', error);
              return of(null);
            }),
          ),
      );
      this.logger.debug('Email notification sent:', !!emailResult);
    } catch (error) {
      this.logger.error('Failed to send welcome email:', error);
      // Don't throw - email sending failure shouldn't affect registration
    }
  }

  async createShopWithOwner(data: SellerRegisterDto): Promise<ShopWithUsers> {
    try {
      // Execute database transaction
      const shop = await this.shopRepository.executeTransaction(async (tx) => {
        this.logger.debug('Starting shop creation transaction');

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(data.password, salt);

        return await this.shopRepository.create<ShopWithUsers>(
          {
            businessName: data.businessName,
            address: data.address,
            contactPhone: data.contactPhone,
            shopLogo: data.shopLogo,
            shopBanner: data.shopBanner,
            users: {
              create: {
                name: data.name,
                email: data.email,
                password: hashedPassword,
                dob: data.dob,
                profileImage: data.profileImage,
                role: Role.SHOP_OWNER,
              },
            },
          },
          {
            users: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
                dob: true,
                profileImage: true,
                status: true,
                createdAt: true,
                updatedAt: true,
              },
            },
          },
          tx,
        );
      });

      // Send welcome email after successful transaction
      if (shop.users[0]) {
        await this.sendWelcomeEmail(shop.users[0]);
      }

      return shop;
    } catch (error) {
      this.logger.error('Error in createShopWithOwner:', error);
      if (
        error instanceof PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Email already exists');
      }
      throw new InternalServerErrorException('Failed to create shop');
    }
  }
}
