/*
  Warnings:

  - You are about to drop the column `alternativeProductId` on the `RoutineStep` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "RoutineStep" DROP CONSTRAINT "RoutineStep_alternativeProductId_fkey";

-- DropForeignKey
ALTER TABLE "RoutineStep" DROP CONSTRAINT "RoutineStep_productId_fkey";

-- AlterTable
ALTER TABLE "RoutineStep" DROP COLUMN "alternativeProductId",
ADD COLUMN     "suggestedCategory" "ProductStep",
ADD COLUMN     "suggestedDescription" TEXT,
ALTER COLUMN "productId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "RoutineStep" ADD CONSTRAINT "RoutineStep_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
