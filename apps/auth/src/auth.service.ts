import {
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { SellerRegisterDto } from './dto/seller.dto';
import { MAILER_SERVICE } from './constants/services';
import { ClientProxy } from '@nestjs/microservices';
import { ShopRepository } from './repositories/shop.repository';
import { lastValueFrom } from 'rxjs';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { Logger } from '@nestjs/common';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly shopRepository: ShopRepository,
    @Inject(MAILER_SERVICE) private mailerClient: ClientProxy,
  ) {}

  async createShopWithOwner(data: SellerRegisterDto) {
    try {
      return await this.shopRepository.executeTransaction(async (tx) => {
        this.logger.debug('Starting shop creation transaction');

        const shop = await this.shopRepository.create(
          'shop',
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
                password: data.password,
                dob: data.dob,
                profileImage: data.profileImage,
                role: Role.SHOP_OWNER,
              },
            },
          },
          {
            users: true,
          },
          tx,
        );

        this.logger.debug('Shop created, emitting event');

        try {
          await lastValueFrom(
            this.mailerClient.emit('shop_created', {
              shop,
              timestamp: new Date(),
            }),
          );
          this.logger.debug('Event emitted successfully');
        } catch (rmqError) {
          this.logger.error('Failed to emit shop_created event:', rmqError);
          // Continue anyway since shop was created successfully
        }

        return shop;
      });
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
