-- Movement CMS: Mission voting (one OPEN mission, options, votes)
CREATE TYPE "MissionStatus" AS ENUM ('DRAFT', 'OPEN', 'CLOSED');

CREATE TABLE "Mission" (
    "id" TEXT NOT NULL,
    "eyebrow" TEXT NOT NULL DEFAULT '',
    "title" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "status" "MissionStatus" NOT NULL DEFAULT 'DRAFT',
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "openLock" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Mission_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Mission_openLock_key" ON "Mission"("openLock");
CREATE INDEX "Mission_status_idx" ON "Mission"("status");

CREATE TABLE "MissionOption" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "image" TEXT NOT NULL DEFAULT '',
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MissionOption_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MissionOption_missionId_idx" ON "MissionOption"("missionId");
CREATE INDEX "MissionOption_displayOrder_idx" ON "MissionOption"("displayOrder");
CREATE INDEX "MissionOption_isActive_idx" ON "MissionOption"("isActive");

CREATE TABLE "MissionVote" (
    "id" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "missionOptionId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MissionVote_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MissionVote_missionId_customerId_key" ON "MissionVote"("missionId", "customerId");
CREATE INDEX "MissionVote_missionOptionId_idx" ON "MissionVote"("missionOptionId");
CREATE INDEX "MissionVote_createdAt_idx" ON "MissionVote"("createdAt");

ALTER TABLE "MissionOption" ADD CONSTRAINT "MissionOption_missionId_fkey"
  FOREIGN KEY ("missionId") REFERENCES "Mission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MissionVote" ADD CONSTRAINT "MissionVote_missionId_fkey"
  FOREIGN KEY ("missionId") REFERENCES "Mission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MissionVote" ADD CONSTRAINT "MissionVote_missionOptionId_fkey"
  FOREIGN KEY ("missionOptionId") REFERENCES "MissionOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;
