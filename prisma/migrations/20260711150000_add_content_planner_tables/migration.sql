CREATE TABLE "ContentPlanner" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "platforms" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "category" TEXT NOT NULL DEFAULT 'Product',
    "priority" TEXT NOT NULL DEFAULT 'Medium',
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "assignedUserId" TEXT NOT NULL DEFAULT '',
    "assignedUserName" TEXT NOT NULL DEFAULT '',
    "publishDate" TEXT NOT NULL DEFAULT '',
    "publishTime" TEXT NOT NULL DEFAULT '',
    "reminderDate" TEXT NOT NULL DEFAULT '',
    "reminderNotifiedAt" TIMESTAMP(3),
    "contentBriefRichText" TEXT NOT NULL DEFAULT '',
    "scriptRichText" TEXT NOT NULL DEFAULT '',
    "captionRichText" TEXT NOT NULL DEFAULT '',
    "ctaText" TEXT NOT NULL DEFAULT '',
    "hashtags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "notesRichText" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContentPlanner_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ContentChecklist" (
    "id" TEXT NOT NULL,
    "contentPlannerId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContentChecklist_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ContentAsset" (
    "id" TEXT NOT NULL,
    "contentPlannerId" TEXT NOT NULL,
    "assetType" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "url" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT '',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContentAsset_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ContentComment" (
    "id" TEXT NOT NULL,
    "contentPlannerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL DEFAULT '',
    "userName" TEXT NOT NULL DEFAULT '',
    "comment" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContentComment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ContentPlanner_publishDate_idx" ON "ContentPlanner"("publishDate");
CREATE INDEX "ContentPlanner_status_idx" ON "ContentPlanner"("status");
CREATE INDEX "ContentPlanner_category_idx" ON "ContentPlanner"("category");
CREATE INDEX "ContentPlanner_priority_idx" ON "ContentPlanner"("priority");
CREATE INDEX "ContentPlanner_assignedUserId_idx" ON "ContentPlanner"("assignedUserId");
CREATE INDEX "ContentPlanner_reminderDate_idx" ON "ContentPlanner"("reminderDate");
CREATE INDEX "ContentChecklist_contentPlannerId_idx" ON "ContentChecklist"("contentPlannerId");
CREATE INDEX "ContentAsset_contentPlannerId_idx" ON "ContentAsset"("contentPlannerId");
CREATE INDEX "ContentComment_contentPlannerId_idx" ON "ContentComment"("contentPlannerId");
CREATE INDEX "ContentComment_createdAt_idx" ON "ContentComment"("createdAt");

ALTER TABLE "ContentChecklist"
ADD CONSTRAINT "ContentChecklist_contentPlannerId_fkey"
FOREIGN KEY ("contentPlannerId") REFERENCES "ContentPlanner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ContentAsset"
ADD CONSTRAINT "ContentAsset_contentPlannerId_fkey"
FOREIGN KEY ("contentPlannerId") REFERENCES "ContentPlanner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ContentComment"
ADD CONSTRAINT "ContentComment_contentPlannerId_fkey"
FOREIGN KEY ("contentPlannerId") REFERENCES "ContentPlanner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "ContentPlanner" (
  "id", "title", "platforms", "category", "priority", "status", "assignedUserName",
  "publishDate", "contentBriefRichText", "captionRichText", "ctaText", "notesRichText", "createdAt", "updatedAt"
)
SELECT
  "id",
  COALESCE("title", ''),
  CASE WHEN COALESCE("platform", '') = '' THEN ARRAY[]::TEXT[] ELSE ARRAY["platform"] END,
  'Branding',
  'Medium',
  CASE
    WHEN "status" = 'Shooting' THEN 'Ready To Shoot'
    WHEN "status" = 'Scheduled' THEN 'Ready'
    WHEN "status" IN ('Idea', 'Draft', 'Editing', 'Published') THEN "status"
    ELSE 'Draft'
  END,
  COALESCE("owner", ''),
  COALESCE("deadline", ''),
  COALESCE("objective", ''),
  COALESCE("caption", ''),
  COALESCE("cta", ''),
  CASE WHEN COALESCE("format", '') = '' THEN '' ELSE 'Format: ' || "format" END,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Content"
ON CONFLICT ("id") DO NOTHING;
