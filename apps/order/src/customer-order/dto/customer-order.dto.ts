export class CustomerOrderHistoryResponseDto {
  wallet: {
    balance: number;
    loyaltyPoints: number;
    transactions: Array<{
      id: string;
      type: string;
      amount: number;
      createdAt: Date;
      orderId?: string;
    }>;
  } | null;

  orders: Array<{
    id: string;
    orderNumber: string;
    status: string;
    subtotal: number;
    discount: number;
    total: number;
    paid: number;
    paymentDue: number;
    createdAt: Date;
    items: Array<{
      product: {
        name: string;
        imageUrls: string[];
      };
      quantity: number;
      originalPrice: number;
      sellingPrice: number;
    }>;
    payments: Array<{
      method: string;
      amount: number;
      reference?: string;
    }>;
    walletModifications: {
      walletUsed: number;
      duePaid: number;
      extraAdded: number;
      loyaltyGained: number;
    };
  }>;
}

export class CustomerWarrantyResponseDto {
  activeWarranty: Array<{
    orderId: string;
    orderNumber: string;
    orderDate: Date;
    productName: string;
    warrantyMonths: number;
    warrantyEndDate: Date;
    isWarrantyActive: boolean;
  }>;

  expiredWarranty: Array<{
    orderId: string;
    orderNumber: string;
    orderDate: Date;
    productName: string;
    warrantyMonths: number;
    warrantyEndDate: Date;
    isWarrantyActive: boolean;
  }>;
}
