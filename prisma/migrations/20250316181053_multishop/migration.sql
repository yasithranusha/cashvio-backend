/*
  Warnings:

  - You are about to drop the column `shop_id` on the `users` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "users" DROP CONSTRAINT "users_shop_id_fkey";

-- DropIndex
DROP INDEX "users_shop_id_idx";

-- AlterTable
ALTER TABLE "users" DROP COLUMN "shop_id",
ADD COLUMN     "default_shop_id" TEXT;

-- CreateTable
CREATE TABLE "user_shops" (
    "user_id" TEXT NOT NULL,
    "shop_id" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'SHOP_STAFF',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_shops_pkey" PRIMARY KEY ("user_id","shop_id")
);

-- CreateIndex
CREATE INDEX "user_shops_user_id_idx" ON "user_shops"("user_id");

-- CreateIndex
CREATE INDEX "user_shops_shop_id_idx" ON "user_shops"("shop_id");

-- CreateIndex
CREATE INDEX "users_default_shop_id_idx" ON "users"("default_shop_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_default_shop_id_fkey" FOREIGN KEY ("default_shop_id") REFERENCES "shops"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_shops" ADD CONSTRAINT "user_shops_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_shops" ADD CONSTRAINT "user_shops_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE CASCADE ON UPDATE CASCADE;
