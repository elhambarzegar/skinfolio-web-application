-- CreateEnum
CREATE TYPE "ChangeKind" AS ENUM ('USE_PRODUCT', 'PRESCRIBED', 'SWAP', 'RECHECK');

-- CreateEnum
CREATE TYPE "ChangeStatus" AS ENUM ('PENDING', 'APPLIED', 'DISMISSED', 'STALE');

-- AlterTable
ALTER TABLE "ShelfItem" ADD COLUMN     "directions" TEXT,
ADD COLUMN     "prescribed" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "RoutineChange" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "routineId" TEXT NOT NULL,
    "kind" "ChangeKind" NOT NULL,
    "status" "ChangeStatus" NOT NULL DEFAULT 'PENDING',
    "trigger" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "consequences" JSONB NOT NULL,
    "risk" TEXT NOT NULL DEFAULT 'none',
    "ops" JSONB NOT NULL,
    "diff" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "RoutineChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RoutineChange_userId_status_idx" ON "RoutineChange"("userId", "status");

-- AddForeignKey
ALTER TABLE "RoutineChange" ADD CONSTRAINT "RoutineChange_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutineChange" ADD CONSTRAINT "RoutineChange_routineId_fkey" FOREIGN KEY ("routineId") REFERENCES "Routine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
