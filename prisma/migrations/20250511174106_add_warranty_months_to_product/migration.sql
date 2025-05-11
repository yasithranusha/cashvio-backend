-- AlterTable
ALTER TABLE "products" ADD COLUMN     "loyalty_points" INTEGER,
ADD COLUMN     "warranty_months" INTEGER;

-- AlterTable
ALTER TABLE "suppliers" ADD COLUMN     "have_whatsapp" BOOLEAN NOT NULL DEFAULT false;
