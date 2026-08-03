ALTER TABLE "CheckoutSession"
ADD COLUMN IF NOT EXISTS "promotionSnapshot" JSONB;

ALTER TABLE "Order"
ADD COLUMN IF NOT EXISTS "promotionSnapshot" JSONB;

ALTER TABLE "Promotion"
ADD COLUMN IF NOT EXISTS "maximumShippingSubsidy" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "usageLimitPerCustomer" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS "targetScope" TEXT NOT NULL DEFAULT 'ENTIRE_STORE',
ADD COLUMN IF NOT EXISTS "targetProductIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS "targetCategories" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS "courierRestrictions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

UPDATE "Promotion"
SET "promotionType" = 'AUTOMATIC_DISCOUNT'
WHERE "promotionType" = 'DISCOUNT_CAMPAIGN';

UPDATE "Promotion"
SET "promotionType" = 'FREE_SHIPPING',
    "discountType" = 'FREE_SHIPPING'
WHERE "promotionType" = 'FREE_SHIPPING_CAMPAIGN';

UPDATE "Promotion"
SET "usageLimitPerCustomer" = 0
WHERE "promotionType" <> 'VOUCHER'
  AND "usageLimitPerCustomer" = 1;

DROP INDEX IF EXISTS "PromotionUsage_promotionId_customerId_key";
CREATE INDEX IF NOT EXISTS "Promotion_promotionType_idx" ON "Promotion"("promotionType");
CREATE INDEX IF NOT EXISTS "PromotionUsage_promotionId_customerId_idx" ON "PromotionUsage"("promotionId", "customerId");
