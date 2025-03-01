import { Test } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '@app/common/database/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { MAILER_SERVICE } from './constants/services';
import { Role, Status, User } from '@prisma/client';
import {
  UnauthorizedException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';

describe('AuthService', () => {
  let authService: AuthService;
  let prismaService: PrismaService;
  let jwtService: JwtService;
  let configService: ConfigService;

  const mockUser: User = {
    id: '1',
    email: 'test@example.com',
    password: 'hashedPassword',
    name: 'Test User',
    role: Role.SHOP_OWNER,
    status: Status.ACTIVE,
    dob: null,
    profileImage: null,
    contactNumber: null,
    shopId: null,
    refreshToken: null,
    refreshTokenExp: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
              update: jest.fn(),
              create: jest.fn(),
            },
            shop: {
              create: jest.fn(),
              findUnique: jest.fn(),
            },
            otp: {
              findUnique: jest.fn(),
              create: jest.fn(),
              delete: jest.fn(),
            },
            $transaction: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
        {
          provide: MAILER_SERVICE,
          useValue: {
            send: jest.fn(),
          },
        },
        {
          provide: Logger,
          useValue: {
            debug: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
          },
        },
      ],
    }).compile();

    authService = moduleRef.get<AuthService>(AuthService);
    prismaService = moduleRef.get<PrismaService>(PrismaService);
    jwtService = moduleRef.get<JwtService>(JwtService);
    configService = moduleRef.get<ConfigService>(ConfigService);
  });

  describe('generateOtp', () => {
    it('should generate and save OTP successfully', async () => {
      const email = 'new@example.com';
      const name = 'New User';
      const mockOtpData = {
        id: '1',
        email,
        otp: '123456',
        expiresAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue(null);
      jest.spyOn(prismaService.otp, 'findUnique').mockResolvedValue(null);
      jest.spyOn(prismaService.otp, 'create').mockResolvedValue(mockOtpData);

      const result = await authService.generateOtp(email, name);

      expect(prismaService.otp.create).toHaveBeenCalled();
      expect(result).toEqual({ message: 'OTP sent to your email' });
    });

    it('should throw ConflictException for existing user', async () => {
      const email = 'existing@example.com';
      const name = 'Existing User';

      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue(mockUser);

      await expect(authService.generateOtp(email, name)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('generateTokens', () => {
    it('should generate access and refresh tokens', async () => {
      const user = mockUser;
      const rememberMe = false;

      jest
        .spyOn(jwtService, 'signAsync')
        .mockResolvedValueOnce('access-token') // First call for access token
        .mockResolvedValueOnce('refresh-token'); // Second call for refresh token

      jest.spyOn(configService, 'get').mockReturnValue('secret');

      jest.spyOn(prismaService.user, 'update').mockResolvedValue(user);

      const result = await authService['generateTokens'](user, rememberMe);

      expect(result).toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
        },
      });
    });

    it('should use extended expiration for remember me', async () => {
      const user = mockUser;
      const rememberMe = true;

      jest
        .spyOn(jwtService, 'signAsync')
        .mockResolvedValueOnce('access-token')
        .mockResolvedValueOnce('refresh-token');

      jest.spyOn(configService, 'get').mockImplementation((key) => {
        switch (key) {
          case 'REFRESH_JWT_EXTENDED_EXPIRES_IN':
            return '30d';
          default:
            return 'secret';
        }
      });

      const result = await authService['generateTokens'](user, rememberMe);
      expect(result.refreshToken).toBeDefined();
    });
  });

  describe('createShopWithOwner', () => {
    const mockShopData = {
      name: 'Test User',
      email: 'test@example.com',
      password: 'password123',
      businessName: 'Test Shop',
      address: '123 Test St',
      otp: '123456',
      contactPhone: '1234567890',
      shopLogo: 'logo.png',
      shopBanner: 'banner.png',
    };

    it('should create shop with owner successfully', async () => {
      const mockOtp = {
        id: '1',
        email: mockShopData.email,
        otp: mockShopData.otp,
        expiresAt: new Date(Date.now() + 1000 * 60 * 5),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockShop = {
        id: '1',
        businessName: mockShopData.businessName,
        address: mockShopData.address,
        contactPhone: mockShopData.contactPhone,
        shopLogo: mockShopData.shopLogo,
        shopBanner: mockShopData.shopBanner,
        status: Status.ACTIVE,
        createdAt: new Date(),
        updatedAt: new Date(),
        users: [mockUser],
      };

      jest.spyOn(prismaService.otp, 'findUnique').mockResolvedValue(mockOtp);
      jest.spyOn(prismaService.otp, 'delete').mockResolvedValue(mockOtp);
      jest.spyOn(prismaService.shop, 'create').mockResolvedValue(mockShop);
      jest.spyOn(prismaService.shop, 'findUnique').mockResolvedValue(mockShop);
      jest
        .spyOn(prismaService, '$transaction')
        .mockImplementation(async (callback) => callback(prismaService));

      const result = await authService.createShopWithOwner(mockShopData);

      expect(result.businessName).toBe(mockShopData.businessName);
      expect(result.users[0].email).toBe(mockShopData.email);
      expect(result.shopLogo).toBe(mockShopData.shopLogo);
      expect(result.shopBanner).toBe(mockShopData.shopBanner);
    });
  });

  describe('validateUser', () => {
    it('should throw BadRequestException for invalid password', async () => {
      const email = 'test@example.com';
      const password = 'wrongpassword';
      const hashedPassword = await bcrypt.hash('password123', 10);

      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue({
        ...mockUser,
        password: hashedPassword,
      });

      await expect(authService.validateUser(email, password)).rejects.toThrow(
        BadRequestException,
      );
      await expect(authService.validateUser(email, password)).rejects.toThrow(
        'Invalid email or password',
      );
    });

    it('should throw BadRequestException for non-existent user', async () => {
      const email = 'nonexistent@example.com';
      const password = 'password123';

      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue(null);

      await expect(authService.validateUser(email, password)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for inactive user', async () => {
      const email = 'inactive@example.com';
      const password = 'password123';
      const hashedPassword = await bcrypt.hash(password, 10);

      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue({
        ...mockUser,
        status: Status.INACTIVE,
        password: hashedPassword,
      });

      await expect(authService.validateUser(email, password)).rejects.toThrow(
        BadRequestException,
      );
      await expect(authService.validateUser(email, password)).rejects.toThrow(
        'Account is Blocked',
      );
    });
  });

  describe('validateRefreshToken', () => {
    it('should validate refresh token successfully', async () => {
      const refreshToken = 'validRefreshToken';
      const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);

      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue({
        ...mockUser,
        refreshToken: hashedRefreshToken,
        refreshTokenExp: futureDate,
      });

      jest.spyOn(jwtService, 'signAsync').mockResolvedValue('newToken');
      jest.spyOn(configService, 'get').mockReturnValue('secret');

      const result = await authService.validateRefreshToken(
        mockUser.id,
        refreshToken,
      );

      expect(result).toBeDefined();
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
    });

    it('should throw UnauthorizedException for expired refresh token', async () => {
      const refreshToken = 'validRefreshToken';
      const hashedRefreshToken = await bcrypt.hash(refreshToken, 10);
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);

      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue({
        ...mockUser,
        refreshToken: hashedRefreshToken,
        refreshTokenExp: pastDate,
      });

      await expect(
        authService.validateRefreshToken(mockUser.id, refreshToken),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('signIn', () => {
    it('should sign in user and return tokens', async () => {
      const signInDto = {
        email: 'test@example.com',
        password: 'password123',
        rememberMe: false,
      };

      const hashedPassword = await bcrypt.hash(signInDto.password, 10);

      jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue({
        ...mockUser,
        password: hashedPassword,
      });

      jest.spyOn(jwtService, 'signAsync').mockResolvedValue('token');
      jest.spyOn(configService, 'get').mockReturnValue('secret');

      const result = await authService.signIn(signInDto);

      expect(result).toBeDefined();
      expect(result.accessToken).toBeDefined();
      expect(result.user).toBeDefined();
      expect(result.user.email).toBe(signInDto.email);
    });
  });
});
