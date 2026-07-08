CREATE TEMP TABLE "__inventory_duplicate_groups" AS
SELECT
  "productId",
  "color",
  "size",
  MIN("id") AS "keep_id",
  ARRAY_AGG("id") AS "all_ids",
  SUM(COALESCE("quantity", 0)) AS "total_quantity",
  SUM(COALESCE("incoming", 0)) AS "total_incoming",
  MAX(COALESCE("threshold", 0)) AS "max_threshold"
FROM "Inventory"
GROUP BY "productId", "color", "size"
HAVING COUNT(*) > 1;

UPDATE "Inventory" AS inventory
SET
  "quantity" = duplicates."total_quantity",
  "incoming" = duplicates."total_incoming",
  "threshold" = GREATEST(inventory."threshold", duplicates."max_threshold")
FROM "__inventory_duplicate_groups" AS duplicates
WHERE inventory."id" = duplicates."keep_id";

UPDATE "StockMovement" AS movement
SET "inventoryId" = duplicates."keep_id"
FROM "__inventory_duplicate_groups" AS duplicates
WHERE movement."inventoryId" = ANY(duplicates."all_ids")
  AND movement."inventoryId" <> duplicates."keep_id";

DELETE FROM "Inventory" AS inventory
USING "__inventory_duplicate_groups" AS duplicates
WHERE inventory."productId" = duplicates."productId"
  AND inventory."color" = duplicates."color"
  AND inventory."size" = duplicates."size"
  AND inventory."id" <> duplicates."keep_id";

DROP TABLE "__inventory_duplicate_groups";

CREATE UNIQUE INDEX "Inventory_productId_color_size_key" ON "Inventory"("productId", "color", "size");
