import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService } from '../auth.service';
import { JwtPayload } from '../types/user';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(
    configService: ConfigService,
    private authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: configService.get<string>('JWT_SECRET'),
      ignoreExpiration: false,
    });
  }

  async validate(payload: JwtPayload) {
    this.logger.debug(`Validating JWT payload: ${JSON.stringify(payload)}`);
    const user = await this.authService.validateJwtUser(payload.sub);
    if (!user) {
      this.logger.error(`User not found for sub: ${payload.sub}`);
      throw new UnauthorizedException();
    }
    this.logger.debug(`JWT validation successful for user: ${user.email}`);
    return user;
  }
}
