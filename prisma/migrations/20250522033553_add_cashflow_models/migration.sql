-- CreateEnum
CREATE TYPE "TransactionCategory" AS ENUM ('SHOP_RENT', 'UTILITIES', 'STOCK_PURCHASE', 'STAFF_WAGES', 'MARKETING', 'SALES', 'SERVICE_FEES', 'DELIVERY_CHARGES', 'VAT_PAYMENT', 'INSURANCE', 'EQUIPMENT', 'INTERNET', 'POS_SYSTEM_FEE', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentFrequency" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUALLY');

-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('ONE_TIME', 'RECURRING');

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "shop_id" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "category" "TransactionCategory" NOT NULL,
    "is_recurring" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recurring_payments" (
    "id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "frequency" "PaymentFrequency" NOT NULL,
    "next_date" TIMESTAMP(3) NOT NULL,
    "transaction_id" TEXT NOT NULL,
    "shop_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recurring_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "upcoming_payments" (
    "id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "due_date" TIMESTAMP(3) NOT NULL,
    "payment_type" "PaymentType" NOT NULL,
    "is_priority" BOOLEAN NOT NULL DEFAULT false,
    "shop_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "upcoming_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "transactions_shop_id_idx" ON "transactions"("shop_id");

-- CreateIndex
CREATE INDEX "transactions_type_idx" ON "transactions"("type");

-- CreateIndex
CREATE INDEX "transactions_category_idx" ON "transactions"("category");

-- CreateIndex
CREATE INDEX "transactions_date_idx" ON "transactions"("date");

-- CreateIndex
CREATE UNIQUE INDEX "recurring_payments_transaction_id_key" ON "recurring_payments"("transaction_id");

-- CreateIndex
CREATE INDEX "recurring_payments_shop_id_idx" ON "recurring_payments"("shop_id");

-- CreateIndex
CREATE INDEX "recurring_payments_next_date_idx" ON "recurring_payments"("next_date");

-- CreateIndex
CREATE INDEX "upcoming_payments_shop_id_idx" ON "upcoming_payments"("shop_id");

-- CreateIndex
CREATE INDEX "upcoming_payments_due_date_idx" ON "upcoming_payments"("due_date");

-- CreateIndex
CREATE INDEX "upcoming_payments_is_priority_idx" ON "upcoming_payments"("is_priority");

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_payments" ADD CONSTRAINT "recurring_payments_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_payments" ADD CONSTRAINT "recurring_payments_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "upcoming_payments" ADD CONSTRAINT "upcoming_payments_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;
