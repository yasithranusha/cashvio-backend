export class ShopBalanceResponseDto {
  shopBalance: {
    id: string;
    shopId: string;
    cashBalance: number;
    cardBalance: number;
    bankBalance: number;
    createdAt: Date;
    updatedAt: Date;
  } | null;

  payments: Array<{
    id: string;
    amount: number;
    method: string;
    reference?: string;
    createdAt: Date;
    order: {
      orderNumber: string;
      customerId: string;
      createdAt: Date;
    };
  }>;
}
