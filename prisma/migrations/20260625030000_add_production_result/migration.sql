-- CreateTable ProductionResult
CREATE TABLE "ProductionResult" (
    "id" TEXT NOT NULL,
    "resultNumber" TEXT NOT NULL,
    "productionOrderId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductionResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductionResult_resultNumber_key" ON "ProductionResult"("resultNumber");
CREATE UNIQUE INDEX "ProductionResult_productionOrderId_key" ON "ProductionResult"("productionOrderId");
CREATE INDEX "ProductionResult_productionOrderId_idx" ON "ProductionResult"("productionOrderId");

-- AddForeignKey
ALTER TABLE "ProductionResult" ADD CONSTRAINT "ProductionResult_productionOrderId_fkey" FOREIGN KEY ("productionOrderId") REFERENCES "ProductionOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
