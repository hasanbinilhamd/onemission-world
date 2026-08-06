CREATE TYPE "WebsiteCollectionHeroType" AS ENUM ('IMAGE', 'SLIDESHOW', 'VIDEO');

CREATE TABLE "WebsiteCollectionHero" (
    "id" TEXT NOT NULL,
    "heroType" "WebsiteCollectionHeroType" NOT NULL DEFAULT 'IMAGE',
    "title" TEXT NOT NULL DEFAULT 'MEN''S COLLECTION',
    "description" TEXT NOT NULL DEFAULT '',
    "overlayOpacity" DOUBLE PRECISION NOT NULL DEFAULT 35,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebsiteCollectionHero_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WebsiteCollectionHeroMedia" (
    "id" TEXT NOT NULL,
    "heroId" TEXT NOT NULL,
    "mediaType" "WebsiteMediaType" NOT NULL,
    "desktopUrl" TEXT NOT NULL,
    "mobileUrl" TEXT NOT NULL DEFAULT '',
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebsiteCollectionHeroMedia_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WebsiteCollectionHero_heroType_idx" ON "WebsiteCollectionHero"("heroType");
CREATE INDEX "WebsiteCollectionHero_isActive_idx" ON "WebsiteCollectionHero"("isActive");
CREATE INDEX "WebsiteCollectionHeroMedia_heroId_idx" ON "WebsiteCollectionHeroMedia"("heroId");
CREATE INDEX "WebsiteCollectionHeroMedia_displayOrder_idx" ON "WebsiteCollectionHeroMedia"("displayOrder");
CREATE INDEX "WebsiteCollectionHeroMedia_isActive_idx" ON "WebsiteCollectionHeroMedia"("isActive");

ALTER TABLE "WebsiteCollectionHeroMedia"
  ADD CONSTRAINT "WebsiteCollectionHeroMedia_heroId_fkey"
  FOREIGN KEY ("heroId") REFERENCES "WebsiteCollectionHero"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
