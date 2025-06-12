# Order Service

## Overview

The Order Service handles order processing, customer management, receipt generation, cashflow tracking, and financial data encryption for the Cashvio platform. It supports multiple payment methods, customer wallets, and comprehensive financial reporting.

## Key Features

- **Order Processing**: Multi-item orders with multiple payment methods
- **Customer Wallets**: Credit/debit tracking per shop and globally
- **Payment Methods**: Cash, Card, Bank, and Wallet payments
- **Financial Encryption**: AWS KMS encryption for sensitive financial data
- **Cashflow Management**: Comprehensive financial tracking and reporting
- **Receipt Generation**: Email receipts and order confirmations
- **Draft Orders**: Save incomplete orders for later completion
- **Warranty Tracking**: Customer warranty management

## Endpoints

### Order Management

#### POST /orders
Create a new order with multiple payment methods support.

**Request:**
```json
{
  "shopId": "shop-uuid-here",
  "customerId": "customer-uuid-here",
  "customerName": "John Doe",
  "customerEmail": "john@example.com",
  "customerPhone": "1234567890",
  "items": [
    {
      "productId": "product-uuid-here",
      "barcodes": ["barcode1", "barcode2"],
      "customPrice": 135000.0
    }
  ],
  "discount": 10,
  "discountType": "FIXED",
  "payments": [
    {
      "amount": 135000,
      "method": "CASH",
      "reference": "TXN123"
    }
  ],
  "note": "Test order",
  "draft": false,
  "sendReceiptEmail": true,
  "customDueAmount": 5,
  "duePaidAmount": 5,
  "extraWalletAmount": 10
}
```

**Response:**
```json
{
  "id": "order-uuid",
  "orderNumber": "ORD-2025-001",
  "status": "COMPLETED",
  "total": 135000,
  "customer": {
    "id": "customer-uuid",
    "name": "John Doe",
    "email": "john@example.com"
  },
  "items": [...],
  "payments": [...],
  "createdAt": "2025-06-11T10:00:00Z"
}
```

#### GET /orders
Get orders with filtering and pagination.

**Query Parameters:**
- `shopId`: Filter by shop (required)
- `status`: Filter by status (COMPLETED, DRAFT, CANCELLED)
- `startDate`: Start date filter (ISO string)
- `endDate`: End date filter (ISO string)
- `customerId`: Filter by customer
- `page`: Page number
- `limit`: Items per page

#### GET /orders/:orderId
Get order details by ID.

### Customer Wallets & History

#### GET /customer-orders/:customerId/shop/:shopId/history
Get customer's order history and wallet balance for a specific shop.

**Response:**
```json
{
  "customer": {
    "id": "customer-uuid",
    "name": "John Doe",
    "email": "john@example.com"
  },
  "walletBalance": 150.00,
  "orders": [...],
  "totalSpent": 5000.00,
  "orderCount": 15
}
```

#### GET /customer-orders/all/:customerId/history
Get customer's complete order history across all shops.

#### GET /customer-wallet/:shopId/:customerId
Get customer's wallet balance for a specific shop.

#### GET /customer-wallet/all/:customerId
Get customer's wallet balances across all shops.

#### GET /customer-orders/:customerId/shop/:shopId/warranty
Get customer's warranty items for a specific shop.

#### GET /customer-orders/all/:customerId/warranty
Get customer's warranty items across all shops.

### Shop Financial Management

#### GET /shop-balance/:shopId
Get shop's financial balance and summary.

**Response:**
```json
{
  "shopId": "shop-uuid",
  "totalRevenue": 150000.00,
  "totalProfit": 45000.00,
  "totalOrders": 125,
  "averageOrderValue": 1200.00,
  "topSellingProducts": [...],
  "paymentMethodBreakdown": {
    "CASH": 80000.00,
    "CARD": 50000.00,
    "BANK": 20000.00
  }
}
```

### Cashflow Management

#### POST /upcoming-payments
Add upcoming payment obligation.

**Request:**
```json
{
  "description": "Office Supplies",
  "amount": 15000,
  "dueDate": "2025-06-01",
  "shopId": "shop-uuid-here",
  "isRecurring": false
}
```

#### GET /upcoming-payments
Get upcoming payments list.

**Query Parameters:**
- `shopId`: Filter by shop
- `status`: Filter by status (PENDING, PAID)
- `page`: Page number
- `limit`: Items per page

#### GET /upcoming-payments/:paymentId
Get upcoming payment by ID.

#### PUT /upcoming-payments/:paymentId
Update upcoming payment.

#### PUT /upcoming-payments/:paymentId/pay
Mark upcoming payment as paid.

#### DELETE /upcoming-payments/:paymentId
Delete upcoming payment.

#### GET /cash-flow/comprehensive/:shopId
Get comprehensive cashflow analysis for shop.

**Response:**
```json
{
  "shopId": "shop-uuid",
  "currentBalance": 45000.00,
  "monthlyRevenue": 25000.00,
  "monthlyExpenses": 8000.00,
  "netCashflow": 17000.00,
  "upcomingPayments": [...],
  "revenueByMonth": [...],
  "expensesByCategory": [...],
  "customerDues": 2500.00,
  "projectedCashflow": [...]
}
```

#### GET /cash-flow/customer-dues/:shopId
Get customer dues report for shop.

**Response:**
```json
{
  "shopId": "shop-uuid",
  "totalDues": 2500.00,
  "customerDues": [
    {
      "customerId": "customer-uuid",
      "customerName": "John Doe",
      "dueAmount": 150.00,
      "lastOrderDate": "2025-06-01T10:00:00Z"
    }
  ]
}
```

## Payment Methods

### Supported Payment Types
- **CASH**: Physical cash payments
- **CARD**: Credit/debit card payments
- **BANK**: Bank transfer payments
- **WALLET**: Customer wallet balance

### Multiple Payment Support
Orders can be split across multiple payment methods:

```json
{
  "payments": [
    {
      "amount": 100.00,
      "method": "CASH"
    },
    {
      "amount": 50.00,
      "method": "CARD",
      "reference": "CARD-TXN-123"
    },
    {
      "amount": 25.00,
      "method": "WALLET"
    }
  ]
}
```

## Customer Wallet System

### Wallet Balance Management
- Customers have separate wallet balances per shop
- Positive balance = credit (customer has money in wallet)
- Negative balance = debt (customer owes money)
- Global wallet view across all shops

### Wallet Transactions
- **Credits**: Overpayments, refunds, manual additions
- **Debits**: Order payments, manual deductions
- **Due Payments**: Outstanding amounts owed by customers

## Financial Data Encryption

### AWS KMS Integration
- All financial amounts are encrypted using AWS KMS
- Encryption at rest for sensitive data
- Automatic decryption for authorized requests
- Audit trail for all financial data access

### Encrypted Fields
- Order totals and subtotals
- Payment amounts
- Customer wallet balances
- Product prices in orders
- Discount amounts

## Data Models

### Order Model
```typescript
{
  id: string;
  orderNumber: string;
  shopId: string;
  customerId?: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  status: 'DRAFT' | 'COMPLETED' | 'CANCELLED';
  total: number; // Encrypted
  subtotal: number; // Encrypted
  discount: number; // Encrypted
  discountType: 'FIXED' | 'PERCENTAGE';
  note?: string;
  createdAt: Date;
  updatedAt: Date;
  items: OrderItem[];
  payments: Payment[];
}
```

### OrderItem Model
```typescript
{
  id: string;
  orderId: string;
  productId: string;
  barcode: string;
  quantity: number;
  unitPrice: number; // Encrypted
  totalPrice: number; // Encrypted
  warrantyStartDate?: Date;
  warrantyEndDate?: Date;
}
```

### Payment Model
```typescript
{
  id: string;
  orderId: string;
  amount: number; // Encrypted
  method: 'CASH' | 'CARD' | 'BANK' | 'WALLET';
  reference?: string;
  createdAt: Date;
}
```

### UpcomingPayment Model
```typescript
{
  id: string;
  description: string;
  amount: number; // Encrypted
  dueDate: Date;
  shopId: string;
  status: 'PENDING' | 'PAID';
  isRecurring: boolean;
  createdAt: Date;
  paidAt?: Date;
}
```

## Business Logic

### Order Processing Flow
1. Validate customer and inventory
2. Calculate totals and apply discounts
3. Process multiple payments
4. Update inventory (via RabbitMQ)
5. Update customer wallet balance
6. Generate receipt and send email
7. Record financial transactions

### Wallet Management
- Automatic wallet updates on order completion
- Overpayment handling (excess goes to wallet)
- Underpayment handling (creates due amount)
- Cross-shop wallet aggregation

### Cashflow Tracking
- Real-time revenue and expense tracking
- Monthly/yearly financial summaries
- Upcoming payment reminders
- Customer due management
- Profit margin calculations

## Configuration

### Environment Variables
```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/cashvio

# AWS KMS for encryption
AWS_KMS_KEY_ID=your-kms-key-id
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_REGION=eu-north-1

# RabbitMQ
RABBITMQ_URL=amqp://localhost:5672

# Service Port
ORDER_SERVICE_PORT=8083

# Email notifications
SEND_RECEIPT_EMAILS=true
```

## Security & Compliance

### Data Encryption
- Financial data encrypted at rest using AWS KMS
- Encryption keys managed by AWS
- Automatic key rotation
- Audit logging for all financial operations

### Access Control
- JWT-based authentication required
- Role-based access to financial data
- Shop-level data isolation
- Customer data privacy protection

## Error Handling

### Common Errors
- `400`: Invalid order data or payment configuration
- `402`: Insufficient payment amount
- `404`: Order, customer, or product not found
- `409`: Inventory conflict (item already sold)
- `422`: Business rule validation failed

### Validation Rules
- Total payment amount must match order total (with wallet adjustments)
- Items must be available in inventory
- Customer wallet cannot exceed configured limits
- Orders cannot be modified after completion