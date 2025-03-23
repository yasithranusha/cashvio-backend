-- AlterTable
ALTER TABLE "users" ADD COLUMN     "refreshToken" TEXT,
ADD COLUMN     "refreshTokenExp" TIMESTAMP(3);
