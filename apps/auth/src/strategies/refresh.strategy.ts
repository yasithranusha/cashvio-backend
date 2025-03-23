import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { AuthService } from '../auth.service';
import { JwtPayload } from '../types/user';

@Injectable()
export class RefreshStrategy extends PassportStrategy(Strategy, 'refresh-jwt') {
  constructor(
    private configService: ConfigService,
    private authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: configService.get<string>('REFRESH_JWT_SECRET'),
      ignoreExpiration: false,
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: JwtPayload) {
    const refreshToken = req.headers.authorization?.split(' ')[1];

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token not found in header');
    }

    try {
      const result = await this.authService.validateRefreshToken(
        payload.sub,
        refreshToken,
      );
      return { ...result, sub: payload.sub };
    } catch (error) {
      throw error;
    }
  }
}
