-- CreateEnum
CREATE TYPE "StepProposal" AS ENUM ('KEEP', 'REMOVE', 'ADD', 'CHANGE');

-- CreateEnum
CREATE TYPE "ProductOwnership" AS ENUM ('OWNED', 'NEW');

-- CreateEnum
CREATE TYPE "BudgetAdjustment" AS ENUM ('NONE', 'FREQUENCY_REDUCED', 'DROPPED_FOR_BUDGET');

-- CreateEnum
CREATE TYPE "ProTipAction" AS ENUM ('ADD', 'REMOVE', 'CHANGE', 'KEEP');

-- CreateEnum
CREATE TYPE "ProTipStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- AlterTable
ALTER TABLE "Routine" ADD COLUMN     "overviewSources" INTEGER[];

-- AlterTable
ALTER TABLE "RoutineStep" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "alternativeFrequency" INTEGER,
ADD COLUMN     "alternativeProductId" TEXT,
ADD COLUMN     "budgetAdjustment" "BudgetAdjustment" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "budgetAdjustmentReason" TEXT,
ADD COLUMN     "frequencyPerWeek" INTEGER NOT NULL DEFAULT 7,
ADD COLUMN     "ownership" "ProductOwnership" NOT NULL DEFAULT 'OWNED',
ADD COLUMN     "proposal" "StepProposal" NOT NULL DEFAULT 'KEEP',
ADD COLUMN     "proposalReason" TEXT,
ADD COLUMN     "ruleCitation" INTEGER,
ADD COLUMN     "timeCostMinutes" INTEGER;

-- CreateTable
CREATE TABLE "ProTip" (
    "id" TEXT NOT NULL,
    "routineId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "actionType" "ProTipAction" NOT NULL,
    "ruleCitation" INTEGER,
    "primaryStepId" TEXT NOT NULL,
    "status" "ProTipStatus" NOT NULL DEFAULT 'PENDING',
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProTip_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "RoutineStep" ADD CONSTRAINT "RoutineStep_alternativeProductId_fkey" FOREIGN KEY ("alternativeProductId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProTip" ADD CONSTRAINT "ProTip_routineId_fkey" FOREIGN KEY ("routineId") REFERENCES "Routine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProTip" ADD CONSTRAINT "ProTip_primaryStepId_fkey" FOREIGN KEY ("primaryStepId") REFERENCES "RoutineStep"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
