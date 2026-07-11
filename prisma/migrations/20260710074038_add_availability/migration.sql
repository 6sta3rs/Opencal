-- CreateTable
CREATE TABLE "Availability" (
    "dayOfWeek" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,

    CONSTRAINT "Availability_pkey" PRIMARY KEY ("dayOfWeek")
);
