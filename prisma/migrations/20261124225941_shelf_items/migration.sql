-- CreateEnum
CREATE TYPE "ShelfStatus" AS ENUM ('ACTIVE', 'RAN_OUT');

-- CreateTable
CREATE TABLE "ShelfItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "status" "ShelfStatus" NOT NULL DEFAULT 'ACTIVE',
    "ranOutAt" TIMESTAMP(3),
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "photoSourceId" TEXT,

    CONSTRAINT "ShelfItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShelfItem_photoSourceId_key" ON "ShelfItem"("photoSourceId");

-- CreateIndex
CREATE INDEX "ShelfItem_userId_status_idx" ON "ShelfItem"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ShelfItem_userId_productId_key" ON "ShelfItem"("userId", "productId");

-- AddForeignKey
ALTER TABLE "ShelfItem" ADD CONSTRAINT "ShelfItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShelfItem" ADD CONSTRAINT "ShelfItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShelfItem" ADD CONSTRAINT "ShelfItem_photoSourceId_fkey" FOREIGN KEY ("photoSourceId") REFERENCES "ProductSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────
-- Move existing data over.
--
-- 1. Everyone's shelf = every product they ever listed in an intake.
-- 2. A label photo used to replace the shared library entry for everybody.
--    Hand each such photo to one person's shelf item (the earliest person to
--    have the product), and put the library back to what it was before the
--    photo (or empty). Photos nobody on a shelf owns are left alone.
-- ─────────────────────────────────────────────────────────────────

INSERT INTO "ShelfItem" ("id", "userId", "productId", "status", "addedAt")
SELECT 'sh' || substr(md5(random()::text || i."userId" || j."B"), 1, 22),
       i."userId", j."B", 'ACTIVE', MIN(i."createdAt")
FROM "_IntakeOwnedProducts" j
JOIN "IntakeResponse" i ON i."id" = j."A"
GROUP BY i."userId", j."B";

CREATE TEMP TABLE _photo_owners AS
SELECT DISTINCT ON (s."productId") s."id" AS shelf_id, s."productId" AS product_id, p."currentSourceId" AS source_id
FROM "ShelfItem" s
JOIN "Product" p ON p."id" = s."productId"
JOIN "ProductSource" ps ON ps."id" = p."currentSourceId"
WHERE ps."origin" = 'USER_PHOTO'
ORDER BY s."productId", s."addedAt";

CREATE TEMP TABLE _photo_prev AS
SELECT prev."id" AS prev_id, o.product_id
FROM "ProductSource" prev
JOIN _photo_owners o ON prev."supersededById" = o.source_id
WHERE prev."origin" <> 'USER_PHOTO';

UPDATE "Product" p SET "currentSourceId" = NULL FROM _photo_owners o WHERE p."id" = o.product_id;
UPDATE "ShelfItem" s SET "photoSourceId" = o.source_id FROM _photo_owners o WHERE s."id" = o.shelf_id;
UPDATE "ProductSource" ps SET "status" = 'PENDING', "supersededById" = NULL FROM _photo_prev pv WHERE ps."id" = pv.prev_id;
UPDATE "Product" p SET "currentSourceId" = pv.prev_id FROM _photo_prev pv WHERE p."id" = pv.product_id;

DROP TABLE _photo_owners;
DROP TABLE _photo_prev;
