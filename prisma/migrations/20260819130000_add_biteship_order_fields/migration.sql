ALTER TABLE "Order"
  ADD COLUMN "shippingProvider" TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN "shippingProviderOrderId" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "shippingProviderTrackingId" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "shippingProviderStatus" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "shippingProviderStatusAt" TIMESTAMP(3),
  ADD COLUMN "shippingLabelUrl" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "shippingProviderPayload" JSONB;

CREATE INDEX "Order_shippingProvider_idx" ON "Order"("shippingProvider");
CREATE INDEX "Order_shippingProviderOrderId_idx" ON "Order"("shippingProviderOrderId");
CREATE INDEX "Order_shippingProviderTrackingId_idx" ON "Order"("shippingProviderTrackingId");
