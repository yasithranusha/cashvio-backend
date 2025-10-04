import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Logger,
  ParseUUIDPipe,
} from '@nestjs/common';
import { EmployeesService } from './employees.service';
import {
  CreateEmployeeDto,
  UpdateEmployeeDto,
  GetEmployeesDto,
  EmployeeResponseDto,
} from './dto/employee.dto';
import { Roles } from '../decorators/roles.decorator';
import { Role } from '@prisma/client';
import { PaginatedResponse } from '@app/common/types/response';

@Controller('employees')
export class EmployeesController {
  private readonly logger = new Logger(EmployeesController.name);

  constructor(private readonly employeesService: EmployeesService) {}

  @Post()
  @Roles(Role.SHOP_OWNER, Role.ADMIN, Role.SUPER_ADMIN)
  async createEmployee(
    @Body() createEmployeeDto: CreateEmployeeDto,
  ): Promise<EmployeeResponseDto> {
    this.logger.debug('POST /employees', createEmployeeDto);
    return this.employeesService.createEmployee(createEmployeeDto);
  }

  @Get()
  @Roles(Role.SHOP_OWNER, Role.ADMIN, Role.SUPER_ADMIN, Role.SHOP_STAFF)
  async getEmployees(
    @Query() query: GetEmployeesDto,
  ): Promise<PaginatedResponse<EmployeeResponseDto>> {
    this.logger.debug('GET /employees', query);
    return this.employeesService.getEmployees(query);
  }

  @Get(':id')
  @Roles(Role.SHOP_OWNER, Role.ADMIN, Role.SUPER_ADMIN, Role.SHOP_STAFF)
  async getEmployeeById(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<EmployeeResponseDto> {
    this.logger.debug(`GET /employees/${id}`);
    return this.employeesService.getEmployeeById(id);
  }

  @Get('user/:userId/shop/:shopId')
  @Roles(Role.SHOP_OWNER, Role.ADMIN, Role.SUPER_ADMIN, Role.SHOP_STAFF)
  async getEmployeeByUserId(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('shopId', ParseUUIDPipe) shopId: string,
  ): Promise<EmployeeResponseDto> {
    this.logger.debug(`GET /employees/user/${userId}/shop/${shopId}`);
    return this.employeesService.getEmployeeByUserId(userId, shopId);
  }

  @Put(':id')
  @Roles(Role.SHOP_OWNER, Role.ADMIN, Role.SUPER_ADMIN)
  async updateEmployee(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateEmployeeDto: UpdateEmployeeDto,
  ): Promise<EmployeeResponseDto> {
    this.logger.debug(`PUT /employees/${id}`, updateEmployeeDto);
    return this.employeesService.updateEmployee(id, updateEmployeeDto);
  }

  @Delete(':id')
  @Roles(Role.SHOP_OWNER, Role.ADMIN, Role.SUPER_ADMIN)
  async deleteEmployee(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<EmployeeResponseDto> {
    this.logger.debug(`DELETE /employees/${id}`);
    return this.employeesService.deleteEmployee(id);
  }

  @Get('shop/:shopId/count')
  @Roles(Role.SHOP_OWNER, Role.ADMIN, Role.SUPER_ADMIN)
  async getShopEmployeeCount(
    @Param('shopId', ParseUUIDPipe) shopId: string,
  ): Promise<{ count: number }> {
    this.logger.debug(`GET /employees/shop/${shopId}/count`);
    const count = await this.employeesService.getShopEmployeeCount(shopId);
    return { count };
  }
}
