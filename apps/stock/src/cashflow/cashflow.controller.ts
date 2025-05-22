import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Put,
  Query,
  Request,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '@app/common';
import { CashflowService } from './cashflow.service';
import {
  CreateTransactionDto,
  UpdateTransactionDto,
  GetTransactionsDto,
  CreateRecurringPaymentDto,
  UpdateRecurringPaymentDto,
  GetRecurringPaymentsDto,
  CreateUpcomingPaymentDto,
  UpdateUpcomingPaymentDto,
  GetUpcomingPaymentsDto,
} from './dto/cashflow.dto';

@Controller('cashflow')
export class CashflowController {
  constructor(private readonly cashflowService: CashflowService) {}

  // Cash flow summary
  @Get('summary/:shopId')
  @Roles(Role.SHOP_OWNER, Role.SHOP_STAFF)
  async getCashFlowSummary(@Request() req, @Param('shopId') shopId: string) {
    return this.cashflowService.getCashFlowSummary(shopId);
  }

  // Note: The following endpoints have been moved to CashFlowIntegrationService in the order module
  // and are commented out here to avoid duplicate functionality.

  /* 
  // Comprehensive cash flow report
  @Get('comprehensive/:shopId')
  @Roles(Role.SHOP_OWNER, Role.SHOP_STAFF)
  async getComprehensiveCashFlow(
    @Request() req,
    @Param('shopId') shopId: string,
  ) {
    return this.cashflowService.getComprehensiveCashFlow(shopId);
  }

  // Customer dues as assets
  @Get('customer-dues/:shopId')
  async getCustomerDuesAsAssets(@Param('shopId') shopId: string) {
    return this.cashflowService.getCustomerDuesAsAssets(shopId);
  }

  // Sync due payment with cash flow
  @Post('sync/due-payment')
  async syncDuePaymentWithCashFlow(
    @Body()
    data: {
      customerId: string;
      shopId: string;
      amount: string;
      date: Date;
    },
  ) {
    return this.cashflowService.syncDuePaymentWithCashFlow(
      data.customerId,
      data.shopId,
      data.amount,
      data.date,
    );
  }
  */

  // Transaction endpoints
  @Post('transactions')
  async createTransaction(@Body() createTransactionDto: CreateTransactionDto) {
    return this.cashflowService.createTransaction(createTransactionDto);
  }

  @Get('transactions')
  async getTransactions(@Query() getTransactionsDto: GetTransactionsDto) {
    return this.cashflowService.getTransactions(getTransactionsDto);
  }

  @Get('transactions/:id')
  async getTransactionById(@Param('id') id: string) {
    return this.cashflowService.getTransactionById(id);
  }

  @Put('transactions/:id')
  async updateTransaction(
    @Param('id') id: string,
    @Body() updateTransactionDto: UpdateTransactionDto,
  ) {
    return this.cashflowService.updateTransaction(id, updateTransactionDto);
  }

  @Delete('transactions/:id')
  async deleteTransaction(@Param('id') id: string) {
    return this.cashflowService.deleteTransaction(id);
  }

  // Recurring payment endpoints
  @Post('recurring-payments')
  async createRecurringPayment(
    @Body() createRecurringPaymentDto: CreateRecurringPaymentDto,
  ) {
    return this.cashflowService.createRecurringPayment(
      createRecurringPaymentDto,
    );
  }

  @Get('recurring-payments')
  async getRecurringPayments(
    @Query() getRecurringPaymentsDto: GetRecurringPaymentsDto,
  ) {
    return this.cashflowService.getRecurringPayments(getRecurringPaymentsDto);
  }

  @Get('recurring-payments/:id')
  async getRecurringPaymentById(@Param('id') id: string) {
    return this.cashflowService.getRecurringPaymentById(id);
  }

  @Put('recurring-payments/:id')
  async updateRecurringPayment(
    @Param('id') id: string,
    @Body() updateRecurringPaymentDto: UpdateRecurringPaymentDto,
  ) {
    return this.cashflowService.updateRecurringPayment(
      id,
      updateRecurringPaymentDto,
    );
  }

  @Delete('recurring-payments/:id')
  async deleteRecurringPayment(@Param('id') id: string) {
    return this.cashflowService.deleteRecurringPayment(id);
  }

  // Upcoming payment endpoints
  @Post('upcoming-payments')
  async createUpcomingPayment(
    @Body() createUpcomingPaymentDto: CreateUpcomingPaymentDto,
  ) {
    return this.cashflowService.createUpcomingPayment(createUpcomingPaymentDto);
  }

  @Get('upcoming-payments')
  async getUpcomingPayments(
    @Query() getUpcomingPaymentsDto: GetUpcomingPaymentsDto,
  ) {
    return this.cashflowService.getUpcomingPayments(getUpcomingPaymentsDto);
  }

  @Get('upcoming-payments/:id')
  async getUpcomingPaymentById(@Param('id') id: string) {
    return this.cashflowService.getUpcomingPaymentById(id);
  }

  @Put('upcoming-payments/:id')
  async updateUpcomingPayment(
    @Param('id') id: string,
    @Body() updateUpcomingPaymentDto: UpdateUpcomingPaymentDto,
  ) {
    return this.cashflowService.updateUpcomingPayment(
      id,
      updateUpcomingPaymentDto,
    );
  }

  @Delete('upcoming-payments/:id')
  async deleteUpcomingPayment(@Param('id') id: string) {
    return this.cashflowService.deleteUpcomingPayment(id);
  }

  // Process recurring payments
  @Post('process-recurring-payments')
  async processRecurringPayments() {
    return this.cashflowService.processRecurringPayments();
  }
}
