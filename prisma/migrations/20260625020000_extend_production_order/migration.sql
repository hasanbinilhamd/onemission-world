-- AlterTable ProductionOrder: add execution fields
ALTER TABLE "ProductionOrder"
  ADD COLUMN "actualQuantity" DOUBLE PRECISION,
  ADD COLUMN "startedAt" TIMESTAMP(3),
  ADD COLUMN "completedAt" TIMESTAMP(3);
