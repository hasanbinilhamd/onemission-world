CREATE TABLE "ProductReview" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "comment" TEXT NOT NULL,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductReview_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProductReview_orderItemId_key" ON "ProductReview"("orderItemId");
CREATE INDEX "ProductReview_productId_idx" ON "ProductReview"("productId");
CREATE INDEX "ProductReview_orderId_idx" ON "ProductReview"("orderId");
CREATE INDEX "ProductReview_customerId_idx" ON "ProductReview"("customerId");
CREATE INDEX "ProductReview_isPublished_idx" ON "ProductReview"("isPublished");
CREATE INDEX "ProductReview_createdAt_idx" ON "ProductReview"("createdAt");

ALTER TABLE "ProductReview"
  ADD CONSTRAINT "ProductReview_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProductReview"
  ADD CONSTRAINT "ProductReview_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProductReview"
  ADD CONSTRAINT "ProductReview_orderItemId_fkey"
  FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProductReview"
  ADD CONSTRAINT "ProductReview_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProductReview"
  ADD CONSTRAINT "ProductReview_rating_check"
  CHECK ("rating" >= 1 AND "rating" <= 5);
