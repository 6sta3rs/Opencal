-- AlterTable
ALTER TABLE "RecurringBlock" ADD COLUMN     "departureTime" TIMESTAMP(3),
ADD COLUMN     "staysOvernight" BOOLEAN NOT NULL DEFAULT false;
