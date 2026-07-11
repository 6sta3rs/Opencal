-- AlterTable
ALTER TABLE "TimeEntry" ADD COLUMN     "isDraft" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE UNIQUE INDEX "TimeEntry_blockId_start_key" ON "TimeEntry"("blockId", "start");

