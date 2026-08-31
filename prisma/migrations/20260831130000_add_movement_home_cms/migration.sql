-- Movement CMS: Home page content + Join The Mission cards
CREATE TABLE "HomePage" (
    "id" TEXT NOT NULL DEFAULT 'home',
    "headline" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "ctaLabel" TEXT NOT NULL DEFAULT '',
    "ctaDestination" TEXT NOT NULL DEFAULT 'mission',
    "socialProofNumber" TEXT NOT NULL DEFAULT '',
    "socialProofText" TEXT NOT NULL DEFAULT '',
    "desktopImage" TEXT NOT NULL DEFAULT '',
    "mobileImage" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomePage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HomePageCard" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "image" TEXT NOT NULL DEFAULT '',
    "destination" TEXT NOT NULL DEFAULT 'mission',
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomePageCard_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "HomePageCard_displayOrder_idx" ON "HomePageCard"("displayOrder");
CREATE INDEX "HomePageCard_isActive_idx" ON "HomePageCard"("isActive");
