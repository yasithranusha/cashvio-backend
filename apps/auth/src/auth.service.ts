import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Role, Shop, User, Prisma, Status } from '@prisma/client';
import { SellerRegisterDto } from './dto/seller.dto';
import { MAILER_SERVICE } from './constants/services';
import { ClientProxy } from '@nestjs/microservices';
import { lastValueFrom, timeout, catchError, of } from 'rxjs';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import * as bcrypt from 'bcrypt';
import { registerMail, passwordRest } from './mail-templates/auth';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SignInDto } from './dto/auth.dto';
import { AuthResponse, JwtPayload, userSelectFeilds } from './types/user';
import { PrismaService } from '@app/common/database/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

export interface ShopWithUsers extends Shop {
  users: Array<Omit<User, 'password'>>;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
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
        select: {
          id: true,
          email: true,
        },
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
    this.logger.debug(`Validating JWT user with ID: ${userId}`);
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: userSelectFeilds,
      });

      if (!user) {
        this.logger.warn(`No user found for JWT validation with ID: ${userId}`);
      } else {
        this.logger.debug(`JWT user validation successful for ID: ${userId}`);
      }

      return user;
    } catch (error) {
      this.logger.error(`Error validating JWT user: ${userId}`, error.stack);
      throw error;
    }
  }

  async validateUser(email: string, password: string): Promise<User> {
    if (!email || !password) {
      this.logger.error('Validation failed: Missing credentials');
      throw new BadRequestException('Email and password are required');
    }

    this.logger.debug(`Validating user credentials for email: ${email}`);

    try {
      const user = await this.prisma.user.findUnique({
        where: { email },
      });

      if (!user) {
        this.logger.warn(`User not found with email: ${email}`);
        throw new BadRequestException('Invalid email or password');
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);
      this.logger.debug(
        `Password validation result for ${email}: ${isPasswordValid}`,
      );

      if (!isPasswordValid) {
        this.logger.warn(`Invalid password attempt for user: ${email}`);
        throw new BadRequestException('Invalid email or password');
      }

      if (user.status === Status.INACTIVE) {
        this.logger.warn(`Inactive account access attempt: ${email}`);
        throw new BadRequestException('Account is Blocked');
      }

      this.logger.debug(`User validation successful for: ${email}`);
      return user;
    } catch (error) {
      this.logger.error(`Error validating user: ${email}`, error.stack);
      throw error;
    }
  }

  async generateTokens(user: User, rememberMe: boolean = false) {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get('JWT_SECRET'),
        expiresIn: this.configService.get('JWT_EXPIRES_IN'),
      }),
      this.jwtService.signAsync(
        { sub: user.id },
        {
          secret: this.configService.get('REFRESH_JWT_SECRET'),
          expiresIn: rememberMe
            ? this.configService.get('REFRESH_JWT_EXTENDED_EXPIRES_IN') // e.g., '30d'
            : this.configService.get('REFRESH_JWT_EXPIRES_IN'), // e.g., '7d'
        },
      ),
    ]);

    // Update refresh token in database with appropriate expiration
    const refreshTokenExp = new Date(
      Date.now() +
        (rememberMe
          ? 30 * 24 * 60 * 60 * 1000 // 30 days
          : 7 * 24 * 60 * 60 * 1000), // 7 days
    );

    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        refreshToken: hashedRefreshToken,
        refreshTokenExp,
      },
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    };
  }

  async signIn(signInDto: SignInDto): Promise<AuthResponse> {
    if (!signInDto?.email || !signInDto?.password) {
      this.logger.error('Invalid sign-in attempt: Missing credentials');
      throw new BadRequestException('Email and password are required');
    }

    this.logger.debug(`Sign-in attempt for email: ${signInDto.email}`);
    const user = await this.validateUser(signInDto.email, signInDto.password);

    return this.generateTokens(user, signInDto.rememberMe);
  }

  async validateRefreshToken(userId: string, refreshToken: string) {
    this.logger.debug(`Validating refresh token for userId: ${userId}`);
    this.logger.debug(`Refresh token: ${refreshToken}`);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user?.refreshToken || !user?.refreshTokenExp) {
      this.logger.warn(`No refresh token found for user: ${userId}`);
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Check if refresh token has expired in database
    if (user.refreshTokenExp < new Date()) {
      this.logger.warn(`Refresh token expired for user: ${userId}`);
      await this.logout(userId); // Use existing logout method
      throw new UnauthorizedException('Refresh token has expired');
    }

    const refreshTokenMatches = await bcrypt.compare(
      refreshToken,
      user.refreshToken,
    );

    if (!refreshTokenMatches) {
      this.logger.warn(`Invalid refresh token for user: ${userId}`);
      throw new UnauthorizedException('Invalid refresh token');
    }

    return this.generateTokens(user);
  }

  async updateRefreshToken(userId: string, refreshToken: string) {
    const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
    const refreshTokenExp = new Date(
      Date.now() + parseInt(process.env.REFRESH_TOKEN_TTL || '604800000'), // 7 days default
    );

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        refreshToken: hashedRefreshToken,
        refreshTokenExp,
      },
    });
  }

  async refreshTokens(userId: string, refreshToken: string) {
    this.logger.debug(`Refreshing tokens for userId: ${userId}`);
    this.logger.debug(`Refresh token: ${refreshToken}`);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.refreshToken) {
      this.logger.warn(`No refresh token found for user: ${userId}`);
      throw new UnauthorizedException('Access Denied');
    }

    const refreshTokenMatches = await bcrypt.compare(
      refreshToken,
      user.refreshToken,
    );
    if (!refreshTokenMatches) {
      this.logger.warn(`Invalid refresh token for user: ${userId}`);
      throw new UnauthorizedException('Access Denied');
    }

    return this.generateTokens(user);
  }

  async logout(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        refreshToken: null,
        refreshTokenExp: null,
      },
    });
  }

  async createShopWithOwner(data: SellerRegisterDto): Promise<ShopWithUsers> {
    try {
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
              defaultShopId: shop.id, // Set default shop
              refreshToken: null,
              refreshTokenExp: null,
              shopAccess: {
                create: {
                  shopId: shop.id,
                  role: Role.SHOP_OWNER,
                },
              },
            },
          });

          const result = await tx.shop.findUnique({
            where: { id: shop.id },
            include: {
              users: {
                include: {
                  user: {
                    select: {
                      ...userSelectFeilds,
                      refreshToken: true,
                      refreshTokenExp: true,
                    },
                  },
                },
              },
              defaultForUsers: {
                select: userSelectFeilds,
              },
            },
          });

          if (!result) {
            throw new InternalServerErrorException('Failed to create shop');
          }

          const formattedResult = {
            ...result,
            users: result.defaultForUsers.concat(
              result.users.map((userShop) => userShop.user),
            ),
          };

          return formattedResult as ShopWithUsers;
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

  async resetPassword(token: string, password: string) {
    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get('FORGET_PASSWORD_SECRET'),
      });

      const user = await this.prisma.user.findUnique({
        where: { email: payload.email },
      });

      if (!user) {
        throw new BadRequestException('User not found');
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      await this.prisma.user.update({
        where: { id: user.id },
        data: { password: hashedPassword },
      });

      return { message: 'Password updated successfully' };
    } catch (error) {
      if (error?.name === 'JsonWebTokenError') {
        throw new BadRequestException('Invalid or expired reset link');
      }
      throw error;
    }
  }

  async forgotPassword(email: string, role: Role) {
    const user = await this.prisma.user.findFirst({
      where: { email, role },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    const token = await this.jwtService.signAsync(
      { email },
      {
        secret: this.configService.get('FORGET_PASSWORD_SECRET'),
        expiresIn: this.configService.get('FORGET_PASSWORD_EXPIRES_IN'),
      },
    );

    // Get the appropriate client URL based on user role
    let clientUrl: string;
    switch (user.role) {
      case Role.ADMIN:
        clientUrl = this.configService.get('ADMIN_CLIENT_URL');
        break;
      case Role.SHOP_OWNER:
      case Role.SHOP_STAFF:
        clientUrl = this.configService.get('SHOP_CLIENT_URL');
        break;
      case Role.CUSTOMER:
      default:
        clientUrl = this.configService.get('CUSTOMER_CLIENT_URL');
        break;
    }

    await this.mailerClient.send('send_email', {
      recipients: [
        {
          address: email,
          name: user.name,
          variables: {
            resetLink: `${clientUrl}/reset-password?token=${token}`,
          },
        },
      ],
      subject: 'Password Reset Request',
      html: passwordRest,
    });

    return { message: 'Password reset link sent to email' };
  }

  async validateGoogleUser(profile: {
    email: string;
    name: string;
    profileImage?: string;
  }) {
    const user = await this.prisma.user.findUnique({
      where: { email: profile.email },
    });

    if (user) {
      if (user.status === Status.INACTIVE) {
        throw new UnauthorizedException('Account is blocked');
      }
      return user;
    }

    // Create new user if doesn't exist
    const newUser = await this.prisma.user.create({
      data: {
        email: profile.email,
        name: profile.name,
        profileImage: profile.profileImage,
        password: '',
        role: Role.CUSTOMER,
      },
    });

    return newUser;
  }

  //todo: send a invitation email to user which give a link to set password
  async createAdminUser(adminuser: {
    email: string;
    password: string;
    name: string;
  }): Promise<User> {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: adminuser.email },
    });
    if (existingUser) {
      throw new ConflictException('Email already exists');
    }
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(adminuser.password, salt);
    const newUser = await this.prisma.user.create({
      data: {
        email: adminuser.email,
        password: hashedPassword,
        name: adminuser.name,
        role: Role.SUPER_ADMIN,
        status: Status.ACTIVE,
      },
    });
    return newUser;
  }
}
