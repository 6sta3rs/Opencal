/*
  Warnings:

  - You are about to drop the column `dayOfWeek` on the `RecurringBlock` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "RecurringBlock" DROP COLUMN "dayOfWeek",
ADD COLUMN     "daysOfWeek" INTEGER[],
ADD COLUMN     "endDate" TIMESTAMP(3);
