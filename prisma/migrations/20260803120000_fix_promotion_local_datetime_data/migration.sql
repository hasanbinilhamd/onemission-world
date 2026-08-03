-- Correct promotions created before datetime-local values were parsed as OneMission business local time.
-- Affected rows have startDate approximately 7 hours after createdAt because the raw local wall time
-- was interpreted as UTC by the server.
UPDATE "Promotion"
SET
  "startDate" = "startDate" - INTERVAL '7 hours',
  "endDate" = CASE
    WHEN "endDate" IS NULL THEN NULL
    ELSE "endDate" - INTERVAL '7 hours'
  END
WHERE "deletedAt" IS NULL
  AND "startDate" IS NOT NULL
  AND "createdAt" IS NOT NULL
  AND "startDate" > "createdAt"
  AND ("startDate" - "createdAt") BETWEEN INTERVAL '6 hours 50 minutes' AND INTERVAL '7 hours 10 minutes';
