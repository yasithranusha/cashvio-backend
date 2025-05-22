import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '@app/common';
import {
  PaymentFrequency,
  PaymentType,
  TransactionCategory,
  TransactionType,
} from '@prisma/client';
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
  CashflowSummaryDto,
} from './dto/cashflow.dto';

@Injectable()
export class CashflowService {
  private readonly logger = new Logger(CashflowService.name);

  constructor(private readonly prismaService: PrismaService) {}

  // Transaction methods
  async createTransaction(createTransactionDto: CreateTransactionDto) {
    const { frequency, nextDate, ...transactionData } = createTransactionDto;

    // Create the transaction
    const transaction = await this.prismaService.transaction.create({
      data: transactionData,
    });

    // If it's a recurring transaction, create a recurring payment record
    if (transaction.isRecurring && frequency && nextDate) {
      await this.prismaService.recurringPayment.create({
        data: {
          description: transaction.description,
          amount: transaction.amount,
          frequency,
          nextDate,
          transactionId: transaction.id,
          shopId: transaction.shopId,
        },
      });
    }

    return transaction;
  }

  async getTransactions(getTransactionsDto: GetTransactionsDto) {
    const {
      page = 1,
      limit = 10,
      shopId,
      type,
      category,
      startDate,
      endDate,
    } = getTransactionsDto;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (shopId) where.shopId = shopId;
    if (type) where.type = type;
    if (category) where.category = category;

    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = startDate;
      if (endDate) where.date.lte = endDate;
    }

    const [transactions, total] = await Promise.all([
      this.prismaService.transaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { date: 'desc' },
      }),
      this.prismaService.transaction.count({ where }),
    ]);

    return {
      data: transactions,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getTransactionById(id: string) {
    const transaction = await this.prismaService.transaction.findUnique({
      where: { id },
      include: { recurringPayment: true },
    });

    if (!transaction) {
      throw new NotFoundException(`Transaction with ID ${id} not found`);
    }

    return transaction;
  }

  async updateTransaction(
    id: string,
    updateTransactionDto: UpdateTransactionDto,
  ) {
    const transaction = await this.prismaService.transaction.findUnique({
      where: { id },
      include: { recurringPayment: true },
    });

    if (!transaction) {
      throw new NotFoundException(`Transaction with ID ${id} not found`);
    }

    return this.prismaService.transaction.update({
      where: { id },
      data: updateTransactionDto,
    });
  }

  async deleteTransaction(id: string) {
    const transaction = await this.prismaService.transaction.findUnique({
      where: { id },
    });

    if (!transaction) {
      throw new NotFoundException(`Transaction with ID ${id} not found`);
    }

    return this.prismaService.transaction.delete({
      where: { id },
    });
  }

  // Recurring Payment methods
  async createRecurringPayment(
    createRecurringPaymentDto: CreateRecurringPaymentDto,
  ) {
    const { transactionId, ...recurringPaymentData } =
      createRecurringPaymentDto;

    // If transactionId is provided, check if it exists
    if (transactionId) {
      const transaction = await this.prismaService.transaction.findUnique({
        where: { id: transactionId },
      });

      if (!transaction) {
        throw new NotFoundException(
          `Transaction with ID ${transactionId} not found`,
        );
      }

      // Create recurring payment with transaction reference
      return this.prismaService.recurringPayment.create({
        data: {
          ...recurringPaymentData,
          transactionId,
        },
      });
    }

    // Create a new transaction for this recurring payment
    const transaction = await this.prismaService.transaction.create({
      data: {
        description: recurringPaymentData.description,
        amount: recurringPaymentData.amount,
        date: new Date(),
        shopId: recurringPaymentData.shopId,
        type: TransactionType.DUE_PAYMENT,
        category: TransactionCategory.OTHER,
        isRecurring: true,
      },
    });

    // Create recurring payment linked to the new transaction
    return this.prismaService.recurringPayment.create({
      data: {
        ...recurringPaymentData,
        transactionId: transaction.id,
      },
    });
  }

  async getRecurringPayments(getRecurringPaymentsDto: GetRecurringPaymentsDto) {
    const { page = 1, limit = 10, shopId, frequency } = getRecurringPaymentsDto;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (shopId) where.shopId = shopId;
    if (frequency) where.frequency = frequency;

    const [recurringPayments, total] = await Promise.all([
      this.prismaService.recurringPayment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { nextDate: 'asc' },
        include: { transaction: true },
      }),
      this.prismaService.recurringPayment.count({ where }),
    ]);

    return {
      data: recurringPayments,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getRecurringPaymentById(id: string) {
    const recurringPayment =
      await this.prismaService.recurringPayment.findUnique({
        where: { id },
        include: { transaction: true },
      });

    if (!recurringPayment) {
      throw new NotFoundException(`Recurring payment with ID ${id} not found`);
    }

    return recurringPayment;
  }

  async updateRecurringPayment(
    id: string,
    updateRecurringPaymentDto: UpdateRecurringPaymentDto,
  ) {
    const recurringPayment =
      await this.prismaService.recurringPayment.findUnique({
        where: { id },
      });

    if (!recurringPayment) {
      throw new NotFoundException(`Recurring payment with ID ${id} not found`);
    }

    return this.prismaService.recurringPayment.update({
      where: { id },
      data: updateRecurringPaymentDto,
    });
  }

  async deleteRecurringPayment(id: string) {
    const recurringPayment =
      await this.prismaService.recurringPayment.findUnique({
        where: { id },
      });

    if (!recurringPayment) {
      throw new NotFoundException(`Recurring payment with ID ${id} not found`);
    }

    return this.prismaService.recurringPayment.delete({
      where: { id },
    });
  }

  // Upcoming Payment methods
  async createUpcomingPayment(
    createUpcomingPaymentDto: CreateUpcomingPaymentDto,
  ) {
    return this.prismaService.upcomingPayment.create({
      data: createUpcomingPaymentDto,
    });
  }

  async getUpcomingPayments(getUpcomingPaymentsDto: GetUpcomingPaymentsDto) {
    const {
      page = 1,
      limit = 10,
      shopId,
      paymentType,
      isPriority,
      startDate,
      endDate,
    } = getUpcomingPaymentsDto;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (shopId) where.shopId = shopId;
    if (paymentType) where.paymentType = paymentType;
    if (isPriority !== undefined) where.isPriority = isPriority;

    if (startDate || endDate) {
      where.dueDate = {};
      if (startDate) where.dueDate.gte = startDate;
      if (endDate) where.dueDate.lte = endDate;
    }

    const [upcomingPayments, total] = await Promise.all([
      this.prismaService.upcomingPayment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { dueDate: 'asc' },
      }),
      this.prismaService.upcomingPayment.count({ where }),
    ]);

    return {
      data: upcomingPayments,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getUpcomingPaymentById(id: string) {
    const upcomingPayment = await this.prismaService.upcomingPayment.findUnique(
      {
        where: { id },
      },
    );

    if (!upcomingPayment) {
      throw new NotFoundException(`Upcoming payment with ID ${id} not found`);
    }

    return upcomingPayment;
  }

  async updateUpcomingPayment(
    id: string,
    updateUpcomingPaymentDto: UpdateUpcomingPaymentDto,
  ) {
    const upcomingPayment = await this.prismaService.upcomingPayment.findUnique(
      {
        where: { id },
      },
    );

    if (!upcomingPayment) {
      throw new NotFoundException(`Upcoming payment with ID ${id} not found`);
    }

    return this.prismaService.upcomingPayment.update({
      where: { id },
      data: updateUpcomingPaymentDto,
    });
  }

  async deleteUpcomingPayment(id: string) {
    const upcomingPayment = await this.prismaService.upcomingPayment.findUnique(
      {
        where: { id },
      },
    );

    if (!upcomingPayment) {
      throw new NotFoundException(`Upcoming payment with ID ${id} not found`);
    }

    return this.prismaService.upcomingPayment.delete({
      where: { id },
    });
  }

  // Cash flow summary
  async getCashflowSummary(shopId: string): Promise<CashflowSummaryDto> {
    // Get shop balance
    const shopBalance = await this.prismaService.shopBalance.findUnique({
      where: { shopId },
    });

    const currentBalance = shopBalance ? shopBalance.cashBalance : '0';

    // Calculate total income (this month)
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const endOfMonth = new Date();
    endOfMonth.setMonth(endOfMonth.getMonth() + 1);
    endOfMonth.setDate(0);
    endOfMonth.setHours(23, 59, 59, 999);

    // Get income transactions for this month
    const incomeTransactions = await this.prismaService.transaction.findMany({
      where: {
        shopId,
        type: {
          in: [
            TransactionType.ORDER_PAYMENT,
            TransactionType.DUE_PAYMENT,
            TransactionType.EXTRA_PAYMENT,
          ],
        },
        date: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
    });

    // Get expense transactions for this month
    const expenseTransactions = await this.prismaService.transaction.findMany({
      where: {
        shopId,
        type: TransactionType.REFUND,
        date: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
    });

    // Calculate totals
    const totalIncome = incomeTransactions
      .reduce((sum, tx) => sum + parseFloat(tx.amount), 0)
      .toString();
    const totalExpenses = expenseTransactions
      .reduce((sum, tx) => sum + parseFloat(tx.amount), 0)
      .toString();

    // Get upcoming payments
    const upcomingPayments = await this.prismaService.upcomingPayment.findMany({
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

    // Calculate projected balance
    const totalUpcoming = upcomingPayments.reduce(
      (sum, payment) => sum + parseFloat(payment.amount),
      0,
    );
    const projectedBalance = (
      parseFloat(currentBalance) - totalUpcoming
    ).toString();

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
        ? (totalUpcoming / daysUntilNextPayment).toString()
        : '0';

    // Mock values for growth rates and progress
    const incomeGrowth = 20; // 20% growth
    const expenseGrowth = 15; // 15% growth
    const dailyProgress = 50; // 50% progress

    return {
      currentBalance,
      totalIncome,
      totalExpenses,
      projectedBalance,
      incomeGrowth,
      expenseGrowth,
      dailyTarget,
      dailyProgress,
      nextPaymentDue: daysUntilNextPayment,
    };
  }

  // Helper method to update recurring payments
  async processRecurringPayments() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find all recurring payments that are due
    const duePayments = await this.prismaService.recurringPayment.findMany({
      where: {
        nextDate: {
          lte: today,
        },
      },
      include: {
        transaction: true,
      },
    });

    // Process each due payment
    for (const payment of duePayments) {
      // Create an upcoming payment
      await this.prismaService.upcomingPayment.create({
        data: {
          description: payment.description,
          amount: payment.amount,
          dueDate: payment.nextDate,
          paymentType: PaymentType.RECURRING,
          isPriority: true,
          shopId: payment.shopId,
        },
      });

      // Calculate next date based on frequency
      const nextDate = new Date(payment.nextDate);

      switch (payment.frequency) {
        case PaymentFrequency.DAILY:
          nextDate.setDate(nextDate.getDate() + 1);
          break;
        case PaymentFrequency.WEEKLY:
          nextDate.setDate(nextDate.getDate() + 7);
          break;
        case PaymentFrequency.MONTHLY:
          nextDate.setMonth(nextDate.getMonth() + 1);
          break;
        case PaymentFrequency.QUARTERLY:
          nextDate.setMonth(nextDate.getMonth() + 3);
          break;
        case PaymentFrequency.ANNUALLY:
          nextDate.setFullYear(nextDate.getFullYear() + 1);
          break;
      }

      // Update the recurring payment with the new next date
      await this.prismaService.recurringPayment.update({
        where: { id: payment.id },
        data: { nextDate },
      });
    }

    return duePayments.length;
  }

  // Integration with Order System
  // These methods have been moved to CashFlowIntegrationService in the order module

  /**
   * Methods moved to CashFlowIntegrationService in the order module
   *
   * syncOrderPaymentWithCashFlow - For handling order payment synchronization
   * syncDuePaymentWithCashFlow - For handling due payment synchronization
   * getCustomerDuesAsAssets - For retrieving customer dues as assets
   * getComprehensiveCashFlow - For comprehensive cash flow reports
   */

  // Add uppercase alias for getCashflowSummary for controller compatibility
  async getCashFlowSummary(shopId: string): Promise<CashflowSummaryDto> {
    return this.getCashflowSummary(shopId);
  }
}
