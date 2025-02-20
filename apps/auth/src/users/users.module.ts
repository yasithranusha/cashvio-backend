import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { DatabaseModule, RmqModule } from '@app/common';
import { MAILER_SERVICE } from './../constants/services';

@Module({
  imports: [
    DatabaseModule,
    RmqModule.register({ name: MAILER_SERVICE }),
    UsersModule,
  ],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
