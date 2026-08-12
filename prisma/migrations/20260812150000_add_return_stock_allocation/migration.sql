CREATE TABLE "ReturnStockAllocation" (
    "id" TEXT NOT NULL,
    "returnRequestId" TEXT NOT NULL,
    "returnRequestItemId" TEXT NOT NULL DEFAULT '',
    "productId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "allocationType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ALLOCATED',
    "stockMovementId" TEXT NOT NULL DEFAULT '',
    "createdBy" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ReturnStockAllocation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ReturnStockAllocation_returnRequestId_returnRequestItemId_allocationType_key" ON "ReturnStockAllocation"("returnRequestId", "returnRequestItemId", "allocationType");
CREATE INDEX "ReturnStockAllocation_returnRequestId_idx" ON "ReturnStockAllocation"("returnRequestId");
CREATE INDEX "ReturnStockAllocation_returnRequestItemId_idx" ON "ReturnStockAllocation"("returnRequestItemId");
CREATE INDEX "ReturnStockAllocation_variantId_idx" ON "ReturnStockAllocation"("variantId");
CREATE INDEX "ReturnStockAllocation_allocationType_idx" ON "ReturnStockAllocation"("allocationType");
CREATE INDEX "ReturnStockAllocation_stockMovementId_idx" ON "ReturnStockAllocation"("stockMovementId");
