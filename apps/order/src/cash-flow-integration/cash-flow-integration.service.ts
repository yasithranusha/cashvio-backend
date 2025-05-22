import {
  Injectable,
  Logger,
  Inject,
  forwardRef,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentMethod } from '@prisma/client';
import { PrismaService } from '@app/common/database/prisma.service';
import { OrderService } from '../order.service';
import {
  CreateUpcomingPaymentDto,
  GetUpcomingPaymentsDto,
  UpdateUpcomingPaymentDto,
} from './dto/upcoming-payment.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class CashFlowIntegrationService {
  private readonly logger = new Logger(CashFlowIntegrationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => OrderService))
    private readonly orderService: OrderService,
  ) {}

  /**
   * Sync an order payment with the cash flow system
   */
  async syncOrderPayment(
    orderId: string,
    payment: {
      id: string;
      amount: string;
      method: PaymentMethod;
      reference?: string;
      createdAt: Date;
    },
    shopId: string,
    orderNumber: string,
    customerId?: string,
  ): Promise<void> {
    try {
      // Create a transaction record for this payment directly in the database
      await this.prisma.transaction.create({
        data: {
          description: customerId
            ? `Order #${orderNumber} Payment (Customer ID: ${customerId})`
            : `Order #${orderNumber} Payment`,
          amount: payment.amount,
          date: payment.createdAt,
          shopId,
          type: 'ORDER_PAYMENT',
          category: 'SALES',
          isRecurring: false,
        },
      });
      this.logger.log(`Successfully synced payment ${payment.id} to cash flow`);
    } catch (error) {
      this.logger.error(
        `Failed to sync payment ${payment.id} to cash flow: ${error.message}`,
      );
      // Don't throw error to avoid disrupting the main order flow
    }
  }

  /**
   * Sync a due payment with the cash flow system
   */
  async syncDuePayment(
    customerId: string,
    shopId: string,
    amount: string,
    date: Date = new Date(),
  ): Promise<void> {
    try {
      // Get customer info for better description
      const customer = await this.prisma.user.findUnique({
        where: { id: customerId },
        select: { name: true },
      });

      // Create a transaction record for this payment directly in the database
      await this.prisma.transaction.create({
        data: {
          description: `Due Payment from ${customer?.name || 'Customer'}`,
          amount,
          date,
          shopId,
          type: 'DUE_PAYMENT',
          category: 'SALES',
          isRecurring: false,
        },
      });
      this.logger.log(
        `Successfully synced due payment for customer ${customerId} to cash flow`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to sync due payment for customer ${customerId} to cash flow: ${error.message}`,
      );
      // Don't throw error to avoid disrupting the main order flow
    }
  }

  /**
   * Get all customer dues as financial assets
   */
  async getCustomerDuesAsAssets(shopId: string): Promise<any> {
    try {
      // Find all wallets with negative balances (dues)
      const customerWallets = await this.prisma.customerWallet.findMany({
        where: {
          shopId,
        },
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              email: true,
              contactNumber: true,
            },
          },
        },
      });

      this.logger.debug(
        `Found ${customerWallets.length} wallets for shop ${shopId}`,
      );

      // Filter and format customer dues
      const duesList = await Promise.all(
        customerWallets.map(async (wallet) => {
          // Handle encryption if needed
          let balance;
          try {
            // Decrypt using order service
            this.logger.debug(
              `Processing wallet for customer ${wallet.customerId}`,
            );
            const decryptedBalance = await this.orderService.decrypt(
              wallet.balance,
            );
            balance = parseFloat(decryptedBalance);

            // If balance is NaN, try again with a direct parsing approach
            if (isNaN(balance)) {
              this.logger.debug(`Balance is NaN, trying direct parse`);
              balance = 0;
            }
          } catch (e) {
            this.logger.error(`Error parsing wallet balance: ${e.message}`);
            balance = 0;
          }

          const isDue = balance < 0;
          const dueAmount = isDue ? Math.abs(balance) : 0;

          return {
            customerId: wallet.customer?.id || wallet.customerId,
            customerName: wallet.customer?.name || 'Unknown Customer',
            contactInfo:
              wallet.customer?.contactNumber ||
              wallet.customer?.email ||
              'No contact info',
            balance,
            dueAmount,
            isDue,
          };
        }),
      );

      // Filter only dues and calculate total
      const onlyDues = duesList.filter((due) => due.isDue);

      const totalDues = onlyDues.reduce((sum, due) => sum + due.dueAmount, 0);

      return {
        totalDues,
        duesList: onlyDues,
        count: onlyDues.length,
      };
    } catch (error) {
      this.logger.error(`Failed to get customer dues: ${error.message}`);
      throw new Error('Failed to get customer dues');
    }
  }

  /**
   * Get comprehensive cash flow report including shop balance, wallet dues, and upcoming payments
   */
  async getComprehensiveCashFlow(shopId: string): Promise<any> {
    try {
      // Get shop balance
      const shopBalance = await this.prisma.shopBalance.findUnique({
        where: { shopId },
      });

      let currentBalance = 0;
      if (shopBalance) {
        try {
          // Decrypt cash balance using the order service
          const decryptedBalance = await this.orderService.decrypt(
            shopBalance.cashBalance,
          );
          currentBalance = parseFloat(decryptedBalance);
          if (isNaN(currentBalance)) currentBalance = 0;
        } catch (error) {
          this.logger.error(`Error decrypting shop balance: ${error.message}`);
        }
      }

      // Calculate total income (this month)
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const endOfMonth = new Date();
      endOfMonth.setMonth(endOfMonth.getMonth() + 1);
      endOfMonth.setDate(0);
      endOfMonth.setHours(23, 59, 59, 999);

      // Get all transactions for the shop
      const allTransactions = await this.prisma.transaction.findMany({
        where: {
          shopId,
        },
        orderBy: {
          date: 'desc',
        },
      });

      // Get income transactions for this month
      const incomeTransactions = await this.prisma.transaction.findMany({
        where: {
          shopId,
          type: {
            in: ['ORDER_PAYMENT', 'DUE_PAYMENT', 'EXTRA_PAYMENT'],
          },
          date: {
            gte: startOfMonth,
            lte: endOfMonth,
          },
        },
      });

      // Get expense transactions for this month
      const expenseTransactions = await this.prisma.transaction.findMany({
        where: {
          shopId,
          type: 'REFUND',
          date: {
            gte: startOfMonth,
            lte: endOfMonth,
          },
        },
      });

      // Calculate totals
      const totalIncome = incomeTransactions.reduce(
        (sum, tx) => sum + parseFloat(tx.amount),
        0,
      );

      const totalExpenses = expenseTransactions.reduce(
        (sum, tx) => sum + parseFloat(tx.amount),
        0,
      );

      // Group transactions by type for summary
      const transactionsByType = allTransactions.reduce((groups, item) => {
        const group = groups[item.type] || [];
        group.push(item);
        groups[item.type] = group;
        return groups;
      }, {});

      // Create summary by transaction type
      const transactionSummary = {};
      Object.keys(transactionsByType).forEach((type) => {
        transactionSummary[type] = {
          count: transactionsByType[type].length,
          total: transactionsByType[type].reduce(
            (sum, tx) => sum + parseFloat(tx.amount),
            0,
          ),
        };
      });

      // Group transactions by month for trend analysis
      const transactionsByMonth = allTransactions.reduce((groups, item) => {
        const date = new Date(item.date);
        const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

        if (!groups[monthYear]) {
          groups[monthYear] = {
            income: 0,
            expense: 0,
          };
        }

        if (
          ['ORDER_PAYMENT', 'DUE_PAYMENT', 'EXTRA_PAYMENT'].includes(item.type)
        ) {
          groups[monthYear].income += parseFloat(item.amount);
        } else {
          groups[monthYear].expense += parseFloat(item.amount);
        }

        return groups;
      }, {});

      // Convert to array and sort by month
      const monthlyTrends = Object.entries(transactionsByMonth)
        .map(
          ([month, data]: [string, { income: number; expense: number }]) => ({
            month,
            income: data.income,
            expense: data.expense,
            net: data.income - data.expense,
          }),
        )
        .sort((a, b) => a.month.localeCompare(b.month));

      // Get customer dues
      const customerDues = await this.getCustomerDuesAsAssets(shopId);

      // Get upcoming payments
      const upcomingPayments = await this.prisma.upcomingPayment.findMany({
        where: {
          shopId,
          dueDate: {
            gte: new Date(),
          },
        },
        orderBy: {
          dueDate: 'asc',
        },
      });

      // Calculate total upcoming expenses
      const totalUpcoming = upcomingPayments.reduce(
        (sum, payment) => sum + parseFloat(payment.amount),
        0,
      );

      // Calculate projected balance
      const projectedBalance = currentBalance - totalUpcoming;

      // Calculate daily target
      const nextPaymentDate = upcomingPayments[0]?.dueDate;
      const daysUntilNextPayment = nextPaymentDate
        ? Math.ceil(
            (nextPaymentDate.getTime() - new Date().getTime()) /
              (1000 * 60 * 60 * 24),
          )
        : 30;

      const dailyTarget =
        totalUpcoming > 0 && daysUntilNextPayment > 0
          ? totalUpcoming / daysUntilNextPayment
          : 0;

      // Calculate adjusted balance (current balance + dues - upcoming payments)
      const adjustedBalance =
        currentBalance + customerDues.totalDues - totalUpcoming;

      // Income/expense growth rates based on last two months of data
      let incomeGrowth = 0;
      let expenseGrowth = 0;

      if (monthlyTrends.length >= 2) {
        const current = monthlyTrends[monthlyTrends.length - 1];
        const previous = monthlyTrends[monthlyTrends.length - 2];

        if (previous.income > 0) {
          incomeGrowth = Math.round(
            ((current.income - previous.income) / previous.income) * 100,
          );
        }

        if (previous.expense > 0) {
          expenseGrowth = Math.round(
            ((current.expense - previous.expense) / previous.expense) * 100,
          );
        }
      } else {
        // Mock values if not enough data
        incomeGrowth = 20;
        expenseGrowth = 15;
      }

      const dailyProgress = 50; // This should be calculated based on actual daily sales

      return {
        currentBalance,
        totalIncome,
        totalExpenses,
        projectedBalance,
        customerDues,
        totalUpcoming,
        upcomingPayments,
        transactions: {
          recent: allTransactions.slice(0, 10), // Return only 10 most recent
          summary: transactionSummary,
          monthlyTrends,
          count: allTransactions.length,
        },
        dailyTarget,
        dailyProgress,
        daysUntilNextPayment,
        incomeGrowth,
        expenseGrowth,
        adjustedBalance,
        healthStatus: adjustedBalance > 0 ? 'HEALTHY' : 'AT_RISK',
      };
    } catch (error) {
      this.logger.error(
        `Failed to get comprehensive cash flow: ${error.message}`,
      );
      throw new Error('Failed to get comprehensive cash flow');
    }
  }

  /**
   * Create a new upcoming payment
   */
  async createUpcomingPayment(dto: CreateUpcomingPaymentDto) {
    try {
      return await this.prisma.upcomingPayment.create({
        data: {
          id: uuidv4(),
          description: dto.description,
          amount: dto.amount,
          dueDate: new Date(dto.dueDate),
          shopId: dto.shopId,
          isPriority: dto.isRecurring || false,
          paymentType: dto.isRecurring ? 'RECURRING' : 'ONE_TIME',
        },
      });
    } catch (error) {
      this.logger.error(`Failed to create upcoming payment: ${error.message}`);
      throw new Error(`Failed to create upcoming payment: ${error.message}`);
    }
  }

  /**
   * Get upcoming payments for a shop
   */
  async getUpcomingPayments(query: GetUpcomingPaymentsDto) {
    try {
      const dateFilter: any = {};

      if (query.startDate) {
        dateFilter.gte = new Date(query.startDate);
      }

      if (query.endDate) {
        dateFilter.lte = new Date(query.endDate);
      }

      const whereClause: any = {
        shopId: query.shopId,
      };

      if (Object.keys(dateFilter).length > 0) {
        whereClause.dueDate = dateFilter;
      }

      const upcomingPayments = await this.prisma.upcomingPayment.findMany({
        where: whereClause,
        orderBy: {
          dueDate: 'asc',
        },
      });

      return {
        data: upcomingPayments,
        count: upcomingPayments.length,
      };
    } catch (error) {
      this.logger.error(`Failed to get upcoming payments: ${error.message}`);
      throw new Error(`Failed to get upcoming payments: ${error.message}`);
    }
  }

  /**
   * Get upcoming payment by ID
   */
  async getUpcomingPaymentById(id: string) {
    try {
      const upcomingPayment = await this.prisma.upcomingPayment.findUnique({
        where: { id },
      });

      if (!upcomingPayment) {
        return null;
      }

      return upcomingPayment;
    } catch (error) {
      this.logger.error(`Failed to get upcoming payment: ${error.message}`);
      throw new Error(`Failed to get upcoming payment: ${error.message}`);
    }
  }

  /**
   * Update an upcoming payment
   */
  async updateUpcomingPayment(id: string, dto: UpdateUpcomingPaymentDto) {
    try {
      // Check if payment exists
      const payment = await this.prisma.upcomingPayment.findUnique({
        where: { id },
      });

      if (!payment) {
        throw new NotFoundException(`Upcoming payment with ID ${id} not found`);
      }

      // Update the payment
      return await this.prisma.upcomingPayment.update({
        where: { id },
        data: {
          description: dto.description,
          amount: dto.amount,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
          isPriority: dto.isRecurring,
          paymentType: dto.isRecurring ? 'RECURRING' : 'ONE_TIME',
        },
      });
    } catch (error) {
      this.logger.error(`Failed to update upcoming payment: ${error.message}`);
      throw new Error(`Failed to update upcoming payment: ${error.message}`);
    }
  }

  /**
   * Delete an upcoming payment
   */
  async deleteUpcomingPayment(id: string) {
    try {
      // Check if payment exists
      const payment = await this.prisma.upcomingPayment.findUnique({
        where: { id },
      });

      if (!payment) {
        throw new NotFoundException(`Upcoming payment with ID ${id} not found`);
      }

      // Delete the payment
      return await this.prisma.upcomingPayment.delete({
        where: { id },
      });
    } catch (error) {
      this.logger.error(`Failed to delete upcoming payment: ${error.message}`);
      throw new Error(`Failed to delete upcoming payment: ${error.message}`);
    }
  }

  /**
   * Mark an upcoming payment as paid
   */
  async markUpcomingPaymentAsPaid(id: string) {
    try {
      // Check if payment exists
      const payment = await this.prisma.upcomingPayment.findUnique({
        where: { id },
      });

      if (!payment) {
        throw new NotFoundException(`Upcoming payment with ID ${id} not found`);
      }

      // Map payment type to transaction category
      let category:
        | 'SHOP_RENT'
        | 'UTILITIES'
        | 'STOCK_PURCHASE'
        | 'STAFF_WAGES'
        | 'MARKETING'
        | 'SALES'
        | 'SERVICE_FEES'
        | 'DELIVERY_CHARGES'
        | 'VAT_PAYMENT'
        | 'INSURANCE';
      switch (payment.paymentType) {
        case 'RECURRING':
          category = 'UTILITIES';
          break;
        default:
          category = 'SHOP_RENT';
          break;
      }

      // Create a transaction record for this paid expense
      await this.prisma.transaction.create({
        data: {
          description: payment.description,
          amount: payment.amount,
          date: new Date(),
          shopId: payment.shopId,
          type: 'ORDER_PAYMENT',
          category,
          isRecurring: payment.paymentType === 'RECURRING',
        },
      });

      // If it's treated as a recurring payment
      if (payment.paymentType === 'RECURRING') {
        // Create next occurrence - 1 month later by default
        const nextDueDate = this.calculateNextDueDate(
          payment.dueDate,
          'MONTHLY',
        );

        await this.prisma.upcomingPayment.create({
          data: {
            id: uuidv4(),
            description: payment.description,
            amount: payment.amount,
            dueDate: nextDueDate,
            shopId: payment.shopId,
            isPriority: true,
            paymentType: 'RECURRING',
          },
        });
      }

      // Delete the original payment since it's now paid
      return await this.prisma.upcomingPayment.delete({
        where: { id },
      });
    } catch (error) {
      this.logger.error(
        `Failed to mark upcoming payment as paid: ${error.message}`,
      );
      throw new Error(
        `Failed to mark upcoming payment as paid: ${error.message}`,
      );
    }
  }

  /**
   * Helper to calculate next due date for recurring payments
   */
  private calculateNextDueDate(dueDate: Date, frequency: string): Date {
    const nextDate = new Date(dueDate);

    switch (frequency.toUpperCase()) {
      case 'DAILY':
        nextDate.setDate(nextDate.getDate() + 1);
        break;
      case 'WEEKLY':
        nextDate.setDate(nextDate.getDate() + 7);
        break;
      case 'BIWEEKLY':
        nextDate.setDate(nextDate.getDate() + 14);
        break;
      case 'MONTHLY':
        nextDate.setMonth(nextDate.getMonth() + 1);
        break;
      case 'QUARTERLY':
        nextDate.setMonth(nextDate.getMonth() + 3);
        break;
      case 'YEARLY':
        nextDate.setFullYear(nextDate.getFullYear() + 1);
        break;
      default:
        nextDate.setMonth(nextDate.getMonth() + 1); // Default to monthly
    }

    return nextDate;
  }
}
