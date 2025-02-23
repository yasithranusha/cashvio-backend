import { Role, User } from '@prisma/client';

export type UserWithoutPassword = Omit<User, 'password'>;

export const userSelectFeilds = {
  id: true,
  name: true,
  email: true,
  dob: true,
  profileImage: true,
  contactNumber: true,
  status: true,
  role: true,
  shopId: true,
  createdAt: true,
  updatedAt: true,
} as const;

export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
}

export interface AuthResponse {
  accessToken: string;
  user: {
    id: string;
    email: string;
    role: Role;
  };
}
