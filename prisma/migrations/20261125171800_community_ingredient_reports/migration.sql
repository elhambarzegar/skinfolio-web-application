-- AlterEnum
ALTER TYPE "SourceOrigin" ADD VALUE 'COMMUNITY';

-- AlterTable
ALTER TABLE "ProductSource" ADD COLUMN     "reporterId" TEXT;

-- CreateIndex
CREATE INDEX "ProductSource_productId_origin_idx" ON "ProductSource"("productId", "origin");

-- AddForeignKey
ALTER TABLE "ProductSource" ADD CONSTRAINT "ProductSource_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Existing label photos: whoever still has one on their shelf took it.
UPDATE "ProductSource" ps SET "reporterId" = s."userId"
FROM "ShelfItem" s WHERE s."photoSourceId" = ps."id" AND ps."reporterId" IS NULL;
