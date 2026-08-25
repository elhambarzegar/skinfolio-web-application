-- CreateEnum
CREATE TYPE "ExperienceLevel" AS ENUM ('NO_ROUTINE', 'INCONSISTENT', 'HAS_ROUTINE_UNSURE', 'KNOWLEDGEABLE');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('USE_OWNED', 'ONE_BETTER_PRODUCT', 'BEST_RESULTS', 'MINIMIZE_SPEND');

-- CreateEnum
CREATE TYPE "ComplexityPreference" AS ENUM ('SIMPLEST', 'FEW_EXTRA_OK', 'ENJOYS_SKINCARE');

-- AlterTable
ALTER TABLE "IntakeResponse" ADD COLUMN     "complexityPreference" "ComplexityPreference",
ADD COLUMN     "experienceLevel" "ExperienceLevel",
ADD COLUMN     "priority" "Priority",
ADD COLUMN     "safetyAcknowledged" BOOLEAN NOT NULL DEFAULT false;
