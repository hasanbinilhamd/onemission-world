-- AlterTable
ALTER TABLE "RawMaterial" ADD COLUMN IF NOT EXISTS "category" TEXT NOT NULL DEFAULT '',
                          ADD COLUMN IF NOT EXISTS "unit" TEXT NOT NULL DEFAULT '',
                          ADD COLUMN IF NOT EXISTS "currentStock" DOUBLE PRECISION NOT NULL DEFAULT 0,
                          ADD COLUMN IF NOT EXISTS "minimumStock" DOUBLE PRECISION NOT NULL DEFAULT 0,
                          ADD COLUMN IF NOT EXISTS "unitCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
                          ADD COLUMN IF NOT EXISTS "supplierName" TEXT NOT NULL DEFAULT '',
                          ADD COLUMN IF NOT EXISTS "notes" TEXT NOT NULL DEFAULT '',
                          ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'Active';
