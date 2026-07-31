ALTER TABLE "CheckoutSession"
ADD COLUMN "promotionSnapshot" JSONB;

ALTER TABLE "Order"
ADD COLUMN "promotionSnapshot" JSONB;

CREATE TABLE "Promotion" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "promotionType" TEXT NOT NULL DEFAULT 'VOUCHER',
    "discountType" TEXT NOT NULL DEFAULT 'PERCENTAGE',
    "percentageValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fixedAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "minimumPurchase" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "maximumDiscount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "quota" INTEGER NOT NULL DEFAULT 0,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Promotion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PromotionUsage" (
    "id" TEXT NOT NULL,
    "promotionId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromotionUsage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Promotion_code_key" ON "Promotion"("code");
CREATE INDEX "Promotion_status_idx" ON "Promotion"("status");
CREATE INDEX "Promotion_deletedAt_idx" ON "Promotion"("deletedAt");
CREATE INDEX "Promotion_startDate_idx" ON "Promotion"("startDate");
CREATE INDEX "Promotion_endDate_idx" ON "Promotion"("endDate");
CREATE INDEX "PromotionUsage_promotionId_idx" ON "PromotionUsage"("promotionId");
CREATE INDEX "PromotionUsage_customerId_idx" ON "PromotionUsage"("customerId");
CREATE INDEX "PromotionUsage_orderId_idx" ON "PromotionUsage"("orderId");
CREATE UNIQUE INDEX "PromotionUsage_promotionId_customerId_key" ON "PromotionUsage"("promotionId", "customerId");

ALTER TABLE "PromotionUsage"
  ADD CONSTRAINT "PromotionUsage_promotionId_fkey"
  FOREIGN KEY ("promotionId") REFERENCES "Promotion"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PromotionUsage"
  ADD CONSTRAINT "PromotionUsage_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PromotionUsage"
  ADD CONSTRAINT "PromotionUsage_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
