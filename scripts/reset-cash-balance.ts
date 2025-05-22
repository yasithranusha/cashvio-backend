import { NestFactory } from '@nestjs/core';
import { OrderModule } from '../apps/order/src/order.module';
import { OrderService } from '../apps/order/src/order.service';

async function bootstrap() {
  const shopId = process.argv[2];
  const newBalance = parseFloat(process.argv[3]);

  if (!shopId || isNaN(newBalance)) {
    console.error(
      'Usage: npx ts-node -r tsconfig-paths/register scripts/reset-cash-balance.ts <shopId> <newBalance>',
    );
    process.exit(1);
  }

  console.log(`Resetting cash balance for shop ${shopId} to ${newBalance}...`);

  try {
    const app = await NestFactory.createApplicationContext(OrderModule);
    const orderService = app.get(OrderService);

    const result = await orderService.resetShopCashBalance(shopId, newBalance);
    console.log('Reset successful!');
    console.log('New shop balance:', result);

    await app.close();
  } catch (error) {
    console.error('Error resetting cash balance:', error.message);
    process.exit(1);
  }
}

bootstrap();
