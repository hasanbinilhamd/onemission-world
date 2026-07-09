ALTER TABLE "StockMovement"
ADD COLUMN "color" TEXT NOT NULL DEFAULT '',
ADD COLUMN "size" TEXT NOT NULL DEFAULT '',
ADD COLUMN "quantityChanged" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "referenceType" TEXT NOT NULL DEFAULT '',
ADD COLUMN "referenceId" TEXT NOT NULL DEFAULT '',
ADD COLUMN "performedBy" TEXT NOT NULL DEFAULT '';

UPDATE "StockMovement"
SET "quantityChanged" = COALESCE("quantity", 0);

UPDATE "StockMovement" AS movement
SET
  "color" = inventory."color",
  "size" = inventory."size"
FROM "Inventory" AS inventory
WHERE movement."inventoryId" = inventory."id";

CREATE INDEX "StockMovement_referenceType_idx" ON "StockMovement"("referenceType");
CREATE INDEX "StockMovement_referenceId_idx" ON "StockMovement"("referenceId");
