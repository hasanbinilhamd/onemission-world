-- AlterTable
ALTER TABLE "Inventory"
ADD COLUMN "averageCost" DOUBLE PRECISION NOT NULL DEFAULT 0;

ALTER TABLE "ProductionResult"
ADD COLUMN "totalMaterialCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "laborCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "factoryOverheadCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "otherCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "totalProductionCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "unitProductionCost" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Backfill inventory average cost from current product cost price
UPDATE "Inventory" AS i
SET "averageCost" = COALESCE(p."costPrice", 0)
FROM "Product" AS p
WHERE p."id" = i."productId";
