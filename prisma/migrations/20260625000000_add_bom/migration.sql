-- CreateTable BOM
CREATE TABLE "BOM" (
    "id" TEXT NOT NULL,
    "bomCode" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT '1.0',
    "description" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'Active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BOM_pkey" PRIMARY KEY ("id")
);

-- CreateTable BOMItem
CREATE TABLE "BOMItem" (
    "id" TEXT NOT NULL,
    "bomId" TEXT NOT NULL,
    "rawMaterialId" TEXT NOT NULL,
    "quantityRequired" DOUBLE PRECISION NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "BOMItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BOM_bomCode_key" ON "BOM"("bomCode");
CREATE INDEX "BOM_productId_idx" ON "BOM"("productId");
CREATE INDEX "BOM_status_idx" ON "BOM"("status");
CREATE INDEX "BOMItem_bomId_idx" ON "BOMItem"("bomId");
CREATE INDEX "BOMItem_rawMaterialId_idx" ON "BOMItem"("rawMaterialId");

-- AddForeignKey
ALTER TABLE "BOM" ADD CONSTRAINT "BOM_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BOMItem" ADD CONSTRAINT "BOMItem_bomId_fkey" FOREIGN KEY ("bomId") REFERENCES "BOM"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BOMItem" ADD CONSTRAINT "BOMItem_rawMaterialId_fkey" FOREIGN KEY ("rawMaterialId") REFERENCES "RawMaterial"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
