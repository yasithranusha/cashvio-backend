-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('ORDER_PAYMENT', 'DUE_PAYMENT', 'EXTRA_PAYMENT', 'LOYALTY_POINTS', 'REFUND');

-- CreateTable
CREATE TABLE "wallet_transactions" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "shop_id" TEXT NOT NULL,
    "order_id" TEXT,
    "amount" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wallet_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "wallet_transactions_customer_id_idx" ON "wallet_transactions"("customer_id");

-- CreateIndex
CREATE INDEX "wallet_transactions_shop_id_idx" ON "wallet_transactions"("shop_id");

-- CreateIndex
CREATE INDEX "wallet_transactions_order_id_idx" ON "wallet_transactions"("order_id");

-- AddForeignKey
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_customer_id_shop_id_fkey" FOREIGN KEY ("customer_id", "shop_id") REFERENCES "customer_wallets"("customer_id", "shop_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
