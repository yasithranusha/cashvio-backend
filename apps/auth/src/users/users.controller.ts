import {
  Controller,
  Get,
  Query,
  Param,
  Put,
  Body,
  Delete,
  Logger,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { GetAllUsers, UpdateUserDto } from './dto/user.dto';
import { PaginatedResponse } from '@app/common/types/response';
import { UserWithoutPassword } from '../types/user';

@Controller('users')
export class UsersController {
  private readonly logger = new Logger(UsersController.name);

  constructor(private readonly usersService: UsersService) {}

  @Get()
  async findAll(
    @Query() query: GetAllUsers,
  ): Promise<PaginatedResponse<UserWithoutPassword>> {
    this.logger.debug('GET /users', query);
    return this.usersService.getAllUsers(query);
  }

  @Get(':id')
  async findById(@Param('id') id: string): Promise<UserWithoutPassword> {
    this.logger.debug(`GET /users/${id}`);
    return this.usersService.findById(id);
  }

  @Get('email/:email')
  @Roles(Role.ADMIN, Role.SHOP_OWNER)
  async findByEmail(
    @Param('email') email: string,
  ): Promise<UserWithoutPassword> {
    this.logger.debug(`GET /users/email/${email}`);
    return this.usersService.findByEmail(email);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
  ): Promise<UserWithoutPassword> {
    this.logger.debug(`PUT /users/${id}`, updateUserDto);
    return this.usersService.updateUserInfo(id, updateUserDto);
  }

  @Delete(':id')
  async delete(@Param('id') id: string): Promise<UserWithoutPassword> {
    this.logger.debug(`DELETE /users/${id}`);
    return this.usersService.deleteUser(id);
  }
}
