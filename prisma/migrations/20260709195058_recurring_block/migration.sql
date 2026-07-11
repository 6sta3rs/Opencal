-- CreateTable
CREATE TABLE "RecurringBlock" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,

    CONSTRAINT "RecurringBlock_pkey" PRIMARY KEY ("id")
);
