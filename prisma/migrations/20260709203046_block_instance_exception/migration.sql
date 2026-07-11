-- CreateTable
CREATE TABLE "BlockInstanceException" (
    "id" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT,
    "endTime" TEXT,
    "cancelled" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "BlockInstanceException_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BlockInstanceException_blockId_date_key" ON "BlockInstanceException"("blockId", "date");

-- AddForeignKey
ALTER TABLE "BlockInstanceException" ADD CONSTRAINT "BlockInstanceException_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "RecurringBlock"("id") ON DELETE CASCADE ON UPDATE CASCADE;
