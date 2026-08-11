-- CreateTable
CREATE TABLE "ManualOrder" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "salesChannelId" TEXT NOT NULL,
    "customerId" TEXT,
    "subtotal" DOUBLE PRECISION NOT NULL,
    "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tax" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "paymentStatus" TEXT NOT NULL DEFAULT 'PAID',
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdBy" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManualOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManualOrderItem" (
    "id" TEXT NOT NULL,
    "manualOrderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "inventoryId" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '',
    "size" TEXT NOT NULL DEFAULT '',
    "quantity" INTEGER NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "subtotal" DOUBLE PRECISION NOT NULL,
    "costPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "productName" TEXT NOT NULL DEFAULT '',
    "sku" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManualOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ManualOrder_orderNumber_key" ON "ManualOrder"("orderNumber");
CREATE INDEX "ManualOrder_salesChannelId_idx" ON "ManualOrder"("salesChannelId");
CREATE INDEX "ManualOrder_customerId_idx" ON "ManualOrder"("customerId");
CREATE INDEX "ManualOrder_status_idx" ON "ManualOrder"("status");
CREATE INDEX "ManualOrder_createdAt_idx" ON "ManualOrder"("createdAt");
CREATE INDEX "ManualOrderItem_manualOrderId_idx" ON "ManualOrderItem"("manualOrderId");
CREATE INDEX "ManualOrderItem_productId_idx" ON "ManualOrderItem"("productId");
CREATE INDEX "ManualOrderItem_inventoryId_idx" ON "ManualOrderItem"("inventoryId");

-- AddForeignKey
ALTER TABLE "ManualOrder" ADD CONSTRAINT "ManualOrder_salesChannelId_fkey" FOREIGN KEY ("salesChannelId") REFERENCES "SalesChannel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ManualOrder" ADD CONSTRAINT "ManualOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ManualOrderItem" ADD CONSTRAINT "ManualOrderItem_manualOrderId_fkey" FOREIGN KEY ("manualOrderId") REFERENCES "ManualOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ManualOrderItem" ADD CONSTRAINT "ManualOrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ManualOrderItem" ADD CONSTRAINT "ManualOrderItem_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "Inventory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
