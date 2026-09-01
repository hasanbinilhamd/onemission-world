-- Movement CMS: Impact (documentation/storytelling)
CREATE TYPE "ImpactStoryStatus" AS ENUM ('DRAFT', 'COMING_SOON', 'NOW_LIVE', 'CLOSED');
CREATE TYPE "ImpactBlockType" AS ENUM ('TEXT', 'IMAGE');

CREATE TABLE "ImpactPageSetting" (
    "id" TEXT NOT NULL DEFAULT 'impact',
    "eyebrow" TEXT NOT NULL DEFAULT '',
    "title" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImpactPageSetting_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ImpactStory" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "slug" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'JOURNEY',
    "shortDescription" TEXT NOT NULL DEFAULT '',
    "coverImage" TEXT NOT NULL DEFAULT '',
    "status" "ImpactStoryStatus" NOT NULL DEFAULT 'DRAFT',
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImpactStory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ImpactStory_slug_key" ON "ImpactStory"("slug");
-- Only ONE featured story at a time (partial unique index).
CREATE UNIQUE INDEX "ImpactStory_featured_single_idx" ON "ImpactStory"("featured") WHERE "featured" = true;
CREATE INDEX "ImpactStory_status_idx" ON "ImpactStory"("status");
CREATE INDEX "ImpactStory_category_idx" ON "ImpactStory"("category");
CREATE INDEX "ImpactStory_featured_idx" ON "ImpactStory"("featured");

CREATE TABLE "ImpactContentBlock" (
    "id" TEXT NOT NULL,
    "storyId" TEXT NOT NULL,
    "type" "ImpactBlockType" NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "text" TEXT,
    "imageUrl" TEXT,
    "altText" TEXT,
    "caption" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImpactContentBlock_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ImpactContentBlock_storyId_idx" ON "ImpactContentBlock"("storyId");
CREATE INDEX "ImpactContentBlock_displayOrder_idx" ON "ImpactContentBlock"("displayOrder");

ALTER TABLE "ImpactContentBlock" ADD CONSTRAINT "ImpactContentBlock_storyId_fkey"
  FOREIGN KEY ("storyId") REFERENCES "ImpactStory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
