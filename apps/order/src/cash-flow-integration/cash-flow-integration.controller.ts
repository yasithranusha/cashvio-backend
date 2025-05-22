import { Controller, Get, Param, Request } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '@app/common';
import { CashFlowIntegrationService } from './cash-flow-integration.service';

@Controller('cash-flow')
export class CashFlowIntegrationController {
  constructor(private readonly cashFlowService: CashFlowIntegrationService) {}

  /**
   * Get customer dues as assets
   */
  @Get('customer-dues/:shopId')
  @Roles(Role.SHOP_OWNER, Role.SHOP_STAFF)
  getCustomerDuesAsAssets(@Request() req, @Param('shopId') shopId: string) {
    return this.cashFlowService.getCustomerDuesAsAssets(shopId);
  }

  /**
   * Get comprehensive cash flow report
   */
  @Get('comprehensive/:shopId')
  @Roles(Role.SHOP_OWNER, Role.SHOP_STAFF)
  getComprehensiveCashFlow(@Request() req, @Param('shopId') shopId: string) {
    return this.cashFlowService.getComprehensiveCashFlow(shopId);
  }
}
