import { Test } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { Role } from '@prisma/client';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

describe('AuthController', () => {
  let authController: AuthController;
  let authService: AuthService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot()],
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            signIn: jest.fn(),
            generateOtp: jest.fn(),
            createShopWithOwner: jest.fn(),
            refreshTokens: jest.fn(),
            logout: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              switch (key) {
                case 'CUSTOMER_CLIENT_URL':
                  return 'http://localhost:3001';
                default:
                  return null;
              }
            }),
          },
        },
      ],
    }).compile();

    authController = moduleRef.get<AuthController>(AuthController);
    authService = moduleRef.get<AuthService>(AuthService);
  });

  describe('login', () => {
    it('should return auth tokens', async () => {
      const result = {
        accessToken: 'accessToken',
        refreshToken: 'refreshToken',
        user: {
          id: '1',
          email: 'test@example.com',
          role: Role.SHOP_OWNER,
        },
      };

      jest.spyOn(authService, 'signIn').mockResolvedValue(result);

      const req = {
        user: {
          email: 'test@example.com',
          password: 'password123',
        },
      };

      expect(await authController.login(req)).toBe(result);
    });

    it('should handle invalid credentials', async () => {
      jest
        .spyOn(authService, 'signIn')
        .mockRejectedValue(new UnauthorizedException('Invalid credentials'));

      const req = {
        user: {
          email: 'wrong@example.com',
          password: 'wrongpass',
        },
      };

      await expect(authController.login(req)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should handle missing user data', async () => {
      const req = { user: null };
      jest
        .spyOn(authService, 'signIn')
        .mockRejectedValue(
          new BadRequestException('Email and password are required'),
        );

      await expect(authController.login(req)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('logout', () => {
    it('should successfully logout user', async () => {
      const req = { user: { id: '1' } };

      await authController.logout(req);

      expect(authService.logout).toHaveBeenCalledWith('1');
    });
  });

  describe('refreshTokens', () => {
    it('should refresh tokens', async () => {
      const result = {
        accessToken: 'newAccessToken',
        refreshToken: 'newRefreshToken',
        user: {
          id: '1',
          email: 'test@example.com',
          role: Role.SHOP_OWNER,
        },
      };

      jest.spyOn(authService, 'refreshTokens').mockResolvedValue(result);

      const req = {
        user: { sub: '1' },
        headers: {
          authorization: 'Bearer oldRefreshToken',
        },
      };

      expect(await authController.refreshTokens(req)).toBe(result);
    });
  });
});
