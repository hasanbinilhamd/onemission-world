-- Page Availability: CMS-controlled public section visibility.
-- Default AVAILABLE keeps existing behavior; no content is touched.
CREATE TYPE "PageAvailability" AS ENUM ('AVAILABLE', 'COMING_SOON');

CREATE TABLE "PageAvailabilitySetting" (
    "id" TEXT NOT NULL,
    "availability" "PageAvailability" NOT NULL DEFAULT 'AVAILABLE',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PageAvailabilitySetting_pkey" PRIMARY KEY ("id")
);
