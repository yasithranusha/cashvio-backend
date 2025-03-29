import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UploaderController } from './uploader.controller';
import { UploaderService } from './uploader.service';

@Module({
  imports: [ConfigModule],
  controllers: [UploaderController],
  providers: [UploaderService],
  exports: [UploaderService],
})
export class UploaderModule {}
