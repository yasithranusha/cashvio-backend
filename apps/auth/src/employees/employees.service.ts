import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import {
  CreateEmployeeDto,
  UpdateEmployeeDto,
  GetEmployeesDto,
  EmployeeResponseDto,
} from './dto/employee.dto';
import { PrismaService } from '@app/common/database/prisma.service';
import { PaginatedResponse } from '@app/common/types/response';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

@Injectable()
export class EmployeesService {
  private readonly logger = new Logger(EmployeesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createEmployee(
    dto: CreateEmployeeDto,
  ): Promise<EmployeeResponseDto> {
    this.logger.debug('Creating employee', dto);

    try {
      // Check if user exists
      const user = await this.prisma.user.findUnique({
        where: { id: dto.userId },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Check if shop exists
      const shop = await this.prisma.shop.findUnique({
        where: { id: dto.shopId },
      });

      if (!shop) {
        throw new NotFoundException('Shop not found');
      }

      // Check if employee already exists for this user-shop combination
      const existingEmployee = await this.prisma.employee.findUnique({
        where: {
          userId_shopId: {
            userId: dto.userId,
            shopId: dto.shopId,
          },
        },
      });

      if (existingEmployee) {
        throw new ConflictException(
          'Employee record already exists for this user in this shop',
        );
      }

      const employee = await this.prisma.employee.create({
        data: {
          userId: dto.userId,
          shopId: dto.shopId,
          designation: dto.designation,
          department: dto.department,
          salary: dto.salary,
          hireDate: dto.hireDate,
          emergencyContact: dto.emergencyContact,
          address: dto.address,
          notes: dto.notes,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              contactNumber: true,
              profileImage: true,
            },
          },
          shop: {
            select: {
              id: true,
              businessName: true,
            },
          },
        },
      });

      this.logger.debug('Successfully created employee', employee.id);
      return employee;
    } catch (error) {
      this.logger.error('Error creating employee', error.stack);
      if (error instanceof PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ConflictException(
            'Employee record already exists for this user in this shop',
          );
        }
      }
      throw error;
    }
  }

  async getEmployees(
    dto: GetEmployeesDto,
  ): Promise<PaginatedResponse<EmployeeResponseDto>> {
    const page = Number(dto.page || 1);
    const limit = Number(dto.limit || 10);
    const skip = (page - 1) * limit;

    const where: any = {};

    if (dto.shopId) {
      where.shopId = dto.shopId;
    }

    if (dto.status) {
      where.status = dto.status;
    }

    if (dto.department) {
      where.department = dto.department;
    }

    if (dto.search) {
      where.OR = [
        { user: { name: { contains: dto.search, mode: 'insensitive' } } },
        { user: { email: { contains: dto.search, mode: 'insensitive' } } },
      ];
    }

    this.logger.debug('Getting employees with filters:', {
      page,
      limit,
      shopId: dto.shopId,
      status: dto.status,
      department: dto.department,
      search: dto.search,
    });

    try {
      const [data, total] = await Promise.all([
        this.prisma.employee.findMany({
          skip,
          take: limit,
          where,
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                contactNumber: true,
                profileImage: true,
              },
            },
            shop: {
              select: {
                id: true,
                businessName: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        }),
        this.prisma.employee.count({ where }),
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
      this.logger.error('Error getting employees', error.stack);
      throw error;
    }
  }

  async getEmployeeById(id: string): Promise<EmployeeResponseDto> {
    this.logger.debug(`Getting employee by id: ${id}`);

    try {
      const employee = await this.prisma.employee.findUnique({
        where: { id },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              contactNumber: true,
              profileImage: true,
            },
          },
          shop: {
            select: {
              id: true,
              businessName: true,
            },
          },
        },
      });

      if (!employee) {
        throw new NotFoundException('Employee not found');
      }

      this.logger.debug(`Employee found with id: ${id}`);
      return employee;
    } catch (error) {
      this.logger.error(`Error getting employee by id: ${id}`, error.stack);
      throw error;
    }
  }

  async getEmployeeByUserId(
    userId: string,
    shopId: string,
  ): Promise<EmployeeResponseDto> {
    this.logger.debug(
      `Getting employee by userId: ${userId} and shopId: ${shopId}`,
    );

    try {
      const employee = await this.prisma.employee.findUnique({
        where: {
          userId_shopId: {
            userId,
            shopId,
          },
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              contactNumber: true,
              profileImage: true,
            },
          },
          shop: {
            select: {
              id: true,
              businessName: true,
            },
          },
        },
      });

      if (!employee) {
        throw new NotFoundException('Employee not found');
      }

      this.logger.debug(
        `Employee found for userId: ${userId} and shopId: ${shopId}`,
      );
      return employee;
    } catch (error) {
      this.logger.error(
        `Error getting employee by userId: ${userId} and shopId: ${shopId}`,
        error.stack,
      );
      throw error;
    }
  }

  async updateEmployee(
    id: string,
    dto: UpdateEmployeeDto,
  ): Promise<EmployeeResponseDto> {
    this.logger.debug(`Updating employee with id: ${id}`, dto);

    try {
      // Check if employee exists
      const existingEmployee = await this.prisma.employee.findUnique({
        where: { id },
      });

      if (!existingEmployee) {
        throw new NotFoundException('Employee not found');
      }

      const employee = await this.prisma.employee.update({
        where: { id },
        data: {
          designation: dto.designation,
          department: dto.department,
          salary: dto.salary,
          hireDate: dto.hireDate,
          status: dto.status,
          emergencyContact: dto.emergencyContact,
          address: dto.address,
          notes: dto.notes,
        },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              contactNumber: true,
              profileImage: true,
            },
          },
          shop: {
            select: {
              id: true,
              businessName: true,
            },
          },
        },
      });

      this.logger.debug(`Successfully updated employee with id: ${id}`);
      return employee;
    } catch (error) {
      this.logger.error(`Error updating employee with id: ${id}`, error.stack);
      throw error;
    }
  }

  async deleteEmployee(id: string): Promise<EmployeeResponseDto> {
    this.logger.debug(`Deleting employee with id: ${id}`);

    try {
      const employee = await this.prisma.employee.delete({
        where: { id },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              contactNumber: true,
              profileImage: true,
            },
          },
          shop: {
            select: {
              id: true,
              businessName: true,
            },
          },
        },
      });

      this.logger.debug(`Successfully deleted employee with id: ${id}`);
      return employee;
    } catch (error) {
      this.logger.error(`Error deleting employee with id: ${id}`, error.stack);
      if (error instanceof PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new NotFoundException('Employee not found');
        }
      }
      throw error;
    }
  }

  async getShopEmployeeCount(shopId: string): Promise<number> {
    this.logger.debug(`Getting employee count for shop: ${shopId}`);

    try {
      const count = await this.prisma.employee.count({
        where: {
          shopId,
          status: 'ACTIVE',
        },
      });

      this.logger.debug(`Found ${count} active employees for shop: ${shopId}`);
      return count;
    } catch (error) {
      this.logger.error(
        `Error getting employee count for shop: ${shopId}`,
        error.stack,
      );
      throw error;
    }
  }
}
