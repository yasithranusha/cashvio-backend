import { Module } from '@nestjs/common';
import { ItemController } from './item.controller';
import { ItemService } from './item.service';
import { DatabaseModule } from '@app/common';
import { ProductModule } from '../product/product.module';

@Module({
  imports: [DatabaseModule, ProductModule],
  controllers: [ItemController],
  providers: [ItemService],
  exports: [ItemService],
})
export class ItemModule {}
