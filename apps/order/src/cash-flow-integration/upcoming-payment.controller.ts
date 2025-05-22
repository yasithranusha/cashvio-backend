import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
  Query,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '@app/common';
import { CashFlowIntegrationService } from './cash-flow-integration.service';
import {
  CreateUpcomingPaymentDto,
  UpdateUpcomingPaymentDto,
  GetUpcomingPaymentsDto,
} from './dto/upcoming-payment.dto';

@Controller('upcoming-payments')
export class UpcomingPaymentController {
  private readonly logger = new Logger(UpcomingPaymentController.name);

  constructor(private readonly cashFlowService: CashFlowIntegrationService) {}

  /**
   * Create a new upcoming payment
   */
  @Post()
  @Roles(Role.SHOP_OWNER, Role.SHOP_STAFF)
  createUpcomingPayment(@Body() dto: CreateUpcomingPaymentDto) {
    this.logger.debug(`Creating upcoming payment: ${JSON.stringify(dto)}`);
    return this.cashFlowService.createUpcomingPayment(dto);
  }

  /**
   * Get all upcoming payments for a shop
   */
  @Get()
  @Roles(Role.SHOP_OWNER, Role.SHOP_STAFF)
  getUpcomingPayments(@Query() query: GetUpcomingPaymentsDto) {
    this.logger.debug(`Getting upcoming payments: ${JSON.stringify(query)}`);
    return this.cashFlowService.getUpcomingPayments(query);
  }

  /**
   * Get an upcoming payment by ID
   */
  @Get(':id')
  @Roles(Role.SHOP_OWNER, Role.SHOP_STAFF)
  async getUpcomingPaymentById(@Param('id') id: string) {
    this.logger.debug(`Getting upcoming payment by ID: ${id}`);
    const payment = await this.cashFlowService.getUpcomingPaymentById(id);
    if (!payment) {
      throw new NotFoundException(`Upcoming payment with ID ${id} not found`);
    }
    return payment;
  }

  /**
   * Update an upcoming payment
   */
  @Put(':id')
  @Roles(Role.SHOP_OWNER, Role.SHOP_STAFF)
  updateUpcomingPayment(
    @Param('id') id: string,
    @Body() dto: UpdateUpcomingPaymentDto,
  ) {
    this.logger.debug(
      `Updating upcoming payment ${id}: ${JSON.stringify(dto)}`,
    );
    return this.cashFlowService.updateUpcomingPayment(id, dto);
  }

  /**
   * Delete an upcoming payment
   */
  @Delete(':id')
  @Roles(Role.SHOP_OWNER, Role.SHOP_STAFF)
  deleteUpcomingPayment(@Param('id') id: string) {
    this.logger.debug(`Deleting upcoming payment ${id}`);
    return this.cashFlowService.deleteUpcomingPayment(id);
  }

  /**
   * Mark an upcoming payment as paid
   */
  @Put(':id/pay')
  @Roles(Role.SHOP_OWNER, Role.SHOP_STAFF)
  markUpcomingPaymentAsPaid(@Param('id') id: string) {
    this.logger.debug(`Marking upcoming payment ${id} as paid`);
    return this.cashFlowService.markUpcomingPaymentAsPaid(id);
  }
}
