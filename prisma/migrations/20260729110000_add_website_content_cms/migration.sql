-- CreateEnum
CREATE TYPE "WebsiteMediaType" AS ENUM ('IMAGE', 'VIDEO');

-- CreateTable
CREATE TABLE "WebsiteHero" (
    "id" TEXT NOT NULL,
    "mediaType" "WebsiteMediaType" NOT NULL,
    "desktopUrl" TEXT NOT NULL,
    "mobileUrl" TEXT NOT NULL DEFAULT '',
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebsiteHero_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebsiteBrandVideo" (
    "id" TEXT NOT NULL,
    "videoUrl" TEXT NOT NULL,
    "posterUrl" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebsiteBrandVideo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebsiteProductStory" (
    "id" TEXT NOT NULL,
    "mediaType" "WebsiteMediaType" NOT NULL,
    "mediaUrl" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebsiteProductStory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WebsiteHero_displayOrder_idx" ON "WebsiteHero"("displayOrder");

-- CreateIndex
CREATE INDEX "WebsiteHero_isActive_idx" ON "WebsiteHero"("isActive");

-- CreateIndex
CREATE INDEX "WebsiteBrandVideo_isActive_idx" ON "WebsiteBrandVideo"("isActive");

-- CreateIndex
CREATE INDEX "WebsiteProductStory_displayOrder_idx" ON "WebsiteProductStory"("displayOrder");

-- CreateIndex
CREATE INDEX "WebsiteProductStory_isActive_idx" ON "WebsiteProductStory"("isActive");
