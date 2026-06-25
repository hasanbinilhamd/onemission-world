-- CreateTable ProductionOrder
CREATE TABLE "ProductionOrder" (
    "id" TEXT NOT NULL,
    "productionOrderNumber" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "bomId" TEXT NOT NULL,
    "plannedQuantity" DOUBLE PRECISION NOT NULL,
    "plannedDate" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductionOrder_productionOrderNumber_key" ON "ProductionOrder"("productionOrderNumber");
CREATE INDEX "ProductionOrder_productId_idx" ON "ProductionOrder"("productId");
CREATE INDEX "ProductionOrder_bomId_idx" ON "ProductionOrder"("bomId");
CREATE INDEX "ProductionOrder_status_idx" ON "ProductionOrder"("status");

-- AddForeignKey
ALTER TABLE "ProductionOrder" ADD CONSTRAINT "ProductionOrder_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductionOrder" ADD CONSTRAINT "ProductionOrder_bomId_fkey" FOREIGN KEY ("bomId") REFERENCES "BOM"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
