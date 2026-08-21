/*
  Warnings:

  - Added the required column `rationale` to the `RoutineStep` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "RoutineStep" ADD COLUMN     "rationale" TEXT NOT NULL;
