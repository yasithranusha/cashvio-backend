import { Module, forwardRef } from '@nestjs/common';
import { DatabaseModule } from '@app/common';
import { CashFlowIntegrationController } from './cash-flow-integration.controller';
import { CashFlowIntegrationService } from './cash-flow-integration.service';
import { OrderModule } from '../order.module';
import { UpcomingPaymentController } from './upcoming-payment.controller';

@Module({
  imports: [DatabaseModule, forwardRef(() => OrderModule)],
  controllers: [CashFlowIntegrationController, UpcomingPaymentController],
  providers: [CashFlowIntegrationService],
  exports: [CashFlowIntegrationService],
})
export class CashFlowIntegrationModule {}
