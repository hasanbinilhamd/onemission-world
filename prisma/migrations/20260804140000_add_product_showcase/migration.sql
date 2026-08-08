CREATE TABLE "ProductShowcase" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "mediaUrl" TEXT NOT NULL,
    "mediaType" "WebsiteMediaType" NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductShowcase_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProductShowcase_productId_idx" ON "ProductShowcase"("productId");
CREATE INDEX "ProductShowcase_productId_sortOrder_idx" ON "ProductShowcase"("productId", "sortOrder");
CREATE INDEX "ProductShowcase_isActive_idx" ON "ProductShowcase"("isActive");

ALTER TABLE "ProductShowcase"
  ADD CONSTRAINT "ProductShowcase_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
