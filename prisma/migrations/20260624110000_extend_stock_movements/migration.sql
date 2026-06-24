-- Extend StockMovement to support unified Product + Raw Material ledger

-- 1. Add itemType column (default PRODUCT for backward compat)
ALTER TABLE "StockMovement" ADD COLUMN IF NOT EXISTS "itemType" TEXT NOT NULL DEFAULT 'PRODUCT';

-- 2. Add rawMaterialId column (nullable)
ALTER TABLE "StockMovement" ADD COLUMN IF NOT EXISTS "rawMaterialId" TEXT;

-- 3. Make inventoryId and productId nullable (they won't exist for RAW_MATERIAL rows)
ALTER TABLE "StockMovement" ALTER COLUMN "inventoryId" DROP NOT NULL;
ALTER TABLE "StockMovement" ALTER COLUMN "productId" DROP NOT NULL;

-- 4. Change quantity columns to DOUBLE PRECISION to support decimal raw material quantities
ALTER TABLE "StockMovement" ALTER COLUMN "quantity" TYPE DOUBLE PRECISION USING "quantity"::DOUBLE PRECISION;
ALTER TABLE "StockMovement" ALTER COLUMN "previousQuantity" TYPE DOUBLE PRECISION USING "previousQuantity"::DOUBLE PRECISION;
ALTER TABLE "StockMovement" ALTER COLUMN "newQuantity" TYPE DOUBLE PRECISION USING "newQuantity"::DOUBLE PRECISION;

-- 5. Add FK for rawMaterialId (nullable, so NULL rows are fine)
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_rawMaterialId_fkey"
  FOREIGN KEY ("rawMaterialId") REFERENCES "RawMaterial"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 6. Add indexes for new columns
CREATE INDEX IF NOT EXISTS "StockMovement_rawMaterialId_idx" ON "StockMovement"("rawMaterialId");
CREATE INDEX IF NOT EXISTS "StockMovement_itemType_idx" ON "StockMovement"("itemType");

-- 7. Backfill existing rows
UPDATE "StockMovement" SET "itemType" = 'PRODUCT' WHERE "itemType" IS NULL OR "itemType" = '';
