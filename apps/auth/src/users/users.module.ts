import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { DatabaseModule, RmqModule } from '@app/common';
import { MAILER_SERVICE } from './../constants/services';
import { ShopRepository } from './../repositories/shop.repository';
import { UserRepository } from './../repositories/user.repository';

@Module({
  imports: [
    DatabaseModule,
    RmqModule.register({ name: MAILER_SERVICE }),
    UsersModule,
  ],
  controllers: [UsersController],
  providers: [UsersService, ShopRepository, UserRepository],
})
export class UsersModule {}
