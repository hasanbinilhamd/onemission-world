ALTER TABLE "Inventory"
  ADD COLUMN "realStock" INTEGER,
  ADD COLUMN "websiteStock" INTEGER;

UPDATE "Inventory"
SET
  "realStock" = "quantity",
  "websiteStock" = "quantity"
WHERE "realStock" IS NULL OR "websiteStock" IS NULL;

ALTER TABLE "Inventory"
  ALTER COLUMN "realStock" SET NOT NULL,
  ALTER COLUMN "realStock" SET DEFAULT 0,
  ALTER COLUMN "websiteStock" SET NOT NULL,
  ALTER COLUMN "websiteStock" SET DEFAULT 0;

ALTER TABLE "Inventory"
  ADD CONSTRAINT "Inventory_realStock_nonnegative_check" CHECK ("realStock" >= 0) NOT VALID,
  ADD CONSTRAINT "Inventory_websiteStock_nonnegative_check" CHECK ("websiteStock" >= 0) NOT VALID,
  ADD CONSTRAINT "Inventory_websiteStock_lte_realStock_check" CHECK ("websiteStock" <= "realStock") NOT VALID;
