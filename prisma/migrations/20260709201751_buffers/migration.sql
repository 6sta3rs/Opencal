-- AlterTable
ALTER TABLE "RecurringBlock" ADD COLUMN     "bufferAfter" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "bufferBefore" INTEGER NOT NULL DEFAULT 0;
