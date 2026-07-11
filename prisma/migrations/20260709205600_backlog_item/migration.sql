-- CreateTable
CREATE TABLE "BacklogItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "deadline" TIMESTAMP(3),
    "priority" TEXT NOT NULL,

    CONSTRAINT "BacklogItem_pkey" PRIMARY KEY ("id")
);
