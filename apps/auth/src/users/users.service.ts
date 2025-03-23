import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { GetAllUsers, UpdateUserDto } from './dto/user.dto';
import { PaginatedResponse } from '@app/common/types/response';
import { userSelectFeilds, UserWithoutPassword } from '../types/user';
import { PrismaService } from '@app/common/database/prisma.service';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string): Promise<UserWithoutPassword | null> {
    this.logger.debug(`Finding user by email: ${email}`);
    try {
      const user = await this.prisma.user.findUnique({
        where: { email },
        select: userSelectFeilds,
      });

      if (!user) {
        this.logger.warn(`User not found with email: ${email}`);
        throw new BadRequestException('User not found');
      }

      this.logger.debug(`User found with email: ${email}`);
      return user;
    } catch (error) {
      this.logger.error(`Error finding user by email: ${email}`, error.stack);
      throw error;
    }
  }

  async findById(id: string): Promise<UserWithoutPassword | null> {
    this.logger.debug(`Finding user by id: ${id}`);
    try {
      const user = await this.prisma.user.findUnique({
        where: { id },
        select: userSelectFeilds,
      });

      if (!user) {
        this.logger.warn(`User not found with id: ${id}`);
        throw new BadRequestException('User not found');
      }

      this.logger.debug(`User found with id: ${id}`);
      return user;
    } catch (error) {
      this.logger.error(`Error finding user by id: ${id}`, error.stack);
      throw error;
    }
  }

  async updateUserInfo(
    id: string,
    data: UpdateUserDto,
  ): Promise<UserWithoutPassword> {
    this.logger.debug(`Updating user info for id: ${id}`, data);
    try {
      const user = await this.prisma.user.update({
        where: { id },
        data: {
          name: data.name,
          dob: data.dob,
          profileImage: data.profileImage,
          contactNumber: data.contactNumber,
        },
        select: userSelectFeilds,
      });

      this.logger.debug(`Successfully updated user info for id: ${id}`);
      return user;
    } catch (error) {
      this.logger.error(`Error updating user info for id: ${id}`, error.stack);
      throw error;
    }
  }

  async deleteUser(id: string): Promise<UserWithoutPassword> {
    this.logger.debug(`Deleting user with id: ${id}`);
    try {
      const user = await this.prisma.user.delete({
        where: { id },
        select: userSelectFeilds,
      });
      this.logger.debug(`Successfully deleted user with id: ${id}`);
      return user;
    } catch (error) {
      this.logger.error(`Error deleting user with id: ${id}`, error.stack);
      throw error;
    }
  }

  async getAllUsers(
    paginationDto: GetAllUsers,
  ): Promise<PaginatedResponse<UserWithoutPassword>> {
    const page = Number(paginationDto.page || 1);
    const limit = Number(paginationDto.limit || 10);
    const skip = (page - 1) * limit;

    const where: any = {};
    if (paginationDto.role) where.role = paginationDto.role;
    if (paginationDto.status) where.status = paginationDto.status;

    this.logger.debug(`Getting all users with filters:`, {
      page,
      limit,
      role: paginationDto.role,
      status: paginationDto.status,
    });

    try {
      const [data, total] = await Promise.all([
        this.prisma.user.findMany({
          skip,
          take: limit,
          where,
          select: userSelectFeilds,
          orderBy: {
            createdAt: 'desc',
          },
        }),
        this.prisma.user.count({ where }),
      ]);

      return {
        data,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      this.logger.error('Error retrieving users:', error.stack);
      throw error;
    }
  }
}
