/*
  Warnings:

  - You are about to alter the column `marketFit` on the `FutureCareer` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Integer`.
  - Made the column `marketFit` on table `FutureCareer` required. This step will fail if there are existing NULL values in that column.
  - Made the column `salaryMax` on table `FutureCareer` required. This step will fail if there are existing NULL values in that column.
  - Made the column `salaryMin` on table `FutureCareer` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX "public"."FutureCareer_userId_idx";

-- AlterTable
ALTER TABLE "FutureCareer" ALTER COLUMN "marketFit" SET NOT NULL,
ALTER COLUMN "marketFit" SET DATA TYPE INTEGER,
ALTER COLUMN "salaryMax" SET NOT NULL,
ALTER COLUMN "salaryMin" SET NOT NULL;
