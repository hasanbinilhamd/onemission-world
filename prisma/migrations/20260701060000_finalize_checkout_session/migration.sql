-- AlterTable
ALTER TABLE "CheckoutSession"
ADD COLUMN "customerCode" TEXT NOT NULL DEFAULT '',
ADD COLUMN "customerName" TEXT NOT NULL DEFAULT '',
ADD COLUMN "customerEmail" TEXT NOT NULL DEFAULT '',
ADD COLUMN "customerPhone" TEXT NOT NULL DEFAULT '',
ADD COLUMN "salesChannelCode" TEXT NOT NULL DEFAULT '',
ADD COLUMN "salesChannelName" TEXT NOT NULL DEFAULT '',
ADD COLUMN "processingKey" TEXT,
ADD COLUMN "processingStartedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "CheckoutSession_processingKey_idx" ON "CheckoutSession"("processingKey");
