-- CreateTable
CREATE TABLE "EarningsLineItem" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "EarningsLineItem_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "EarningsLineItem" ADD CONSTRAINT "EarningsLineItem_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "TimeEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
