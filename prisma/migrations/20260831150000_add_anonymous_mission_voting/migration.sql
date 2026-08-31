-- Anonymous Mission voting:
--   - customerId becomes nullable (authenticated votes keep their customerId)
--   - anonymousVoterId added for anonymous voters
--   - existing rows are preserved untouched
--   - second unique index enforces one anonymous identity per mission
ALTER TABLE "MissionVote" ALTER COLUMN "customerId" DROP NOT NULL;

ALTER TABLE "MissionVote" ADD COLUMN "anonymousVoterId" TEXT;

CREATE UNIQUE INDEX "MissionVote_missionId_anonymousVoterId_key" ON "MissionVote"("missionId", "anonymousVoterId");
