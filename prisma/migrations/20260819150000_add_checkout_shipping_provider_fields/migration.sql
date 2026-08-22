ALTER TABLE "CheckoutSession"
  ADD COLUMN "shippingProvider" TEXT NOT NULL DEFAULT 'rajaongkir',
  ADD COLUMN "shippingOriginId" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "shippingDestinationId" TEXT NOT NULL DEFAULT '';

ALTER TABLE "Order"
  ADD COLUMN "shippingOriginId" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "shippingDestinationId" TEXT NOT NULL DEFAULT '';
