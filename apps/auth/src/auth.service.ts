import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { Role, Shop, Status, User, Prisma } from '@prisma/client';
import { SellerRegisterDto } from './dto/seller.dto';
import { MAILER_SERVICE } from './constants/services';
import { ClientProxy } from '@nestjs/microservices';
import { lastValueFrom, timeout, catchError, of } from 'rxjs';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import * as bcrypt from 'bcrypt';
import { registerMail } from './mail-templates/auth';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SignInDto } from './dto/auth.dto';
import { userSelectFeilds } from './types/user';
import { PrismaService } from '@app/common/database/prisma.service';
import { JwtPayload } from './types/jwt';
import { JwtService } from '@nestjs/jwt';
import { AuthResponse } from './types/auth';

export interface ShopWithUsers extends Shop {
  users: Array<Omit<User, 'password'>>;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    @Inject(MAILER_SERVICE) private readonly mailerClient: ClientProxy,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async cleanupExpiredOtps() {
    try {
      const result = await this.prisma.otp.deleteMany({
        where: {
          expiresAt: {
            lt: new Date(),
          },
        },
      });
      this.logger.debug(`Cleaned up ${result.count} expired OTPs`);
    } catch (error) {
      this.logger.error('Failed to cleanup expired OTPs:', error);
    }
  }

  private async sendWelcomeEmail(
    user: {
      email: string;
      name: string;
    },
    otp: string,
  ): Promise<void> {
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
                  otp: otp,
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
              return of({ success: false, error: error.message });
            }),
          ),
      );
      this.logger.debug('Email notification sent:', emailResult);
    } catch (error) {
      this.logger.error('Failed to send welcome email:', error);
    }
  }

  async generateOtp(email: string, name: string) {
    try {
      // Check if user already exists
      const existingUser = await this.prisma.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        throw new ConflictException('Email already exists');
      }

      // Check for existing OTP
      const existingOtp = await this.prisma.otp.findUnique({
        where: { email },
      });

      if (existingOtp) {
        const remainingTime = Math.ceil(
          (existingOtp.expiresAt.getTime() - Date.now()) / (1000 * 60),
        );
        throw new BadRequestException(
          `Please wait ${remainingTime} minutes before requesting a new OTP`,
        );
      }

      // Generate new OTP
      const otp = Math.floor(Math.random() * 1000000)
        .toString()
        .padStart(6, '0');
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes expiry

      // Save OTP
      await this.prisma.otp.create({
        data: {
          email,
          otp,
          expiresAt,
        },
      });

      await this.sendWelcomeEmail({ email, name }, otp);

      return { message: 'OTP sent to your email' };
    } catch (error) {
      this.logger.error('Error generating OTP:', error);
      throw error;
    }
  }

  async validateJwtUser(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: userSelectFeilds,
    });
  }

  async signIn(signInDto: SignInDto): Promise<AuthResponse> {
    const user = await this.validateUser(signInDto.email, signInDto.password);

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    };
  }

  async createShopWithOwner(data: SellerRegisterDto): Promise<ShopWithUsers> {
    try {
      // Verify OTP
      const otpRecord = await this.prisma.otp.findUnique({
        where: { email: data.email },
      });

      if (!otpRecord) {
        throw new BadRequestException('Invalid OTP');
      }

      if (otpRecord.otp !== data.otp) {
        throw new BadRequestException('Invalid OTP');
      }

      if (otpRecord.expiresAt < new Date()) {
        throw new BadRequestException('OTP has expired');
      }

      // Delete used OTP
      await this.prisma.otp.delete({
        where: { email: data.email },
      });

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(data.password, salt);

      return await this.prisma.$transaction(
        async (tx) => {
          const shop = await tx.shop.create({
            data: {
              businessName: data.businessName,
              address: data.address,
              contactPhone: data.contactPhone,
              shopLogo: data.shopLogo,
              shopBanner: data.shopBanner,
            },
          });

          await tx.user.create({
            data: {
              name: data.name,
              email: data.email,
              password: hashedPassword,
              dob: data.dob,
              contactNumber: data.contactNumber,
              profileImage: data.profileImage,
              role: Role.SHOP_OWNER,
              shopId: shop.id,
            },
            select: userSelectFeilds,
          });
          const result = await tx.shop.findUnique({
            where: { id: shop.id },
            include: { users: { select: userSelectFeilds } },
          });

          if (!result) {
            throw new InternalServerErrorException('Failed to create shop');
          }
          return result;
        },
        {
          maxWait: 5000,
          timeout: 10000,
          isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        },
      );
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
