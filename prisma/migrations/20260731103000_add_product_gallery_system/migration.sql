ALTER TABLE "Product"
ADD COLUMN "hoverImageUrl" TEXT NOT NULL DEFAULT '';

CREATE TABLE "ProductGallery" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "mediaUrl" TEXT NOT NULL,
    "mediaType" "WebsiteMediaType" NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductGallery_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProductGallery_productId_idx" ON "ProductGallery"("productId");
CREATE INDEX "ProductGallery_productId_sortOrder_idx" ON "ProductGallery"("productId", "sortOrder");

ALTER TABLE "ProductGallery"
ADD CONSTRAINT "ProductGallery_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "Product"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
