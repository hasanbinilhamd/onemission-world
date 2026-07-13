ALTER TABLE "ContentPlanner"
  ADD COLUMN "calendarDate" TEXT,
  ADD COLUMN "pdfUrl" TEXT,
  ADD COLUMN "pdfFilename" TEXT,
  ADD COLUMN "createdBy" TEXT NOT NULL DEFAULT '';

WITH first_pdf_asset AS (
  SELECT DISTINCT ON ("contentPlannerId")
    "contentPlannerId",
    "url",
    COALESCE(NULLIF("name", ''), 'content-script.pdf') AS "name"
  FROM "ContentAsset"
  WHERE LOWER(COALESCE("mimeType", '')) = 'application/pdf'
    OR LOWER(COALESCE("name", '')) LIKE '%.pdf'
    OR LOWER(COALESCE("assetType", '')) = 'pdf'
  ORDER BY "contentPlannerId", "sortOrder" ASC, "createdAt" ASC
)
UPDATE "ContentPlanner" AS planner
SET
  "calendarDate" = COALESCE(NULLIF(planner."publishDate", ''), TO_CHAR(planner."createdAt", 'YYYY-MM-DD')),
  "pdfUrl" = asset."url",
  "pdfFilename" = asset."name",
  "createdBy" = COALESCE(NULLIF(planner."assignedUserName", ''), '')
FROM first_pdf_asset AS asset
WHERE planner."id" = asset."contentPlannerId";

UPDATE "ContentPlanner"
SET
  "calendarDate" = COALESCE(NULLIF("calendarDate", ''), TO_CHAR("createdAt", 'YYYY-MM-DD')),
  "pdfUrl" = COALESCE("pdfUrl", ''),
  "pdfFilename" = COALESCE("pdfFilename", ''),
  "createdBy" = COALESCE("createdBy", '')
WHERE "calendarDate" IS NULL
   OR "pdfUrl" IS NULL
   OR "pdfFilename" IS NULL
   OR "createdBy" IS NULL;

DELETE FROM "ContentPlanner"
WHERE COALESCE("pdfUrl", '') = ''
   OR COALESCE("pdfFilename", '') = '';

DROP TABLE IF EXISTS "ContentChecklist";
DROP TABLE IF EXISTS "ContentAsset";
DROP TABLE IF EXISTS "ContentComment";

ALTER TABLE "ContentPlanner"
  ALTER COLUMN "calendarDate" SET NOT NULL,
  ALTER COLUMN "pdfUrl" SET NOT NULL,
  ALTER COLUMN "pdfFilename" SET NOT NULL;

ALTER TABLE "ContentPlanner"
  DROP COLUMN "platforms",
  DROP COLUMN "priority",
  DROP COLUMN "status",
  DROP COLUMN "assignedUserId",
  DROP COLUMN "assignedUserName",
  DROP COLUMN "publishDate",
  DROP COLUMN "publishTime",
  DROP COLUMN "reminderDate",
  DROP COLUMN "reminderNotifiedAt",
  DROP COLUMN "contentBriefRichText",
  DROP COLUMN "scriptRichText",
  DROP COLUMN "captionRichText",
  DROP COLUMN "ctaText",
  DROP COLUMN "hashtags",
  DROP COLUMN "notesRichText";

CREATE INDEX IF NOT EXISTS "ContentPlanner_calendarDate_idx" ON "ContentPlanner"("calendarDate");
CREATE INDEX IF NOT EXISTS "ContentPlanner_createdAt_idx" ON "ContentPlanner"("createdAt");
