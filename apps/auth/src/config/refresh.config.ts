import { registerAs } from '@nestjs/config';

export default registerAs('refresh-jwt', () => ({
  secret: process.env.REFRESH_JWT_SECRET,
  expiresIn: process.env.REFRESH_JWT_EXPIRES_IN,
}));
