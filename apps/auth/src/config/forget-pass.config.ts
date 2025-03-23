import { registerAs } from '@nestjs/config';
import { JwtSignOptions } from '@nestjs/jwt';

export default registerAs(
  'forget-jwt',
  (): JwtSignOptions => ({
    secret: process.env.FORGET_PASSWORD_SECRET,
    expiresIn: process.env.FORGET_PASSWORD_EXPIRES_IN,
  }),
);
