-- AlterTable
ALTER TABLE "Order"
ADD COLUMN "fulfillmentStatus" TEXT NOT NULL DEFAULT 'PENDING',
ADD COLUMN "shipmentCourier" TEXT NOT NULL DEFAULT '',
ADD COLUMN "shipmentService" TEXT NOT NULL DEFAULT '',
ADD COLUMN "trackingNumber" TEXT NOT NULL DEFAULT '',
ADD COLUMN "shippingDate" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "OrderTimeline" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "eventName" TEXT NOT NULL,
  "updatedBy" TEXT NOT NULL DEFAULT '',
  "notes" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "OrderTimeline_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Order_fulfillmentStatus_idx" ON "Order"("fulfillmentStatus");

-- CreateIndex
CREATE INDEX "OrderTimeline_orderId_idx" ON "OrderTimeline"("orderId");

-- CreateIndex
CREATE INDEX "OrderTimeline_createdAt_idx" ON "OrderTimeline"("createdAt");

-- AddForeignKey
ALTER TABLE "OrderTimeline"
ADD CONSTRAINT "OrderTimeline_orderId_fkey"
FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
