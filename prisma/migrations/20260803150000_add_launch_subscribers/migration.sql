CREATE TYPE "LaunchSubscriberStatus" AS ENUM ('SUBSCRIBED', 'NOTIFIED', 'UNSUBSCRIBED');

CREATE TABLE "LaunchSubscriber" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL DEFAULT 'ID',
    "source" TEXT NOT NULL DEFAULT 'launch-page',
    "status" "LaunchSubscriberStatus" NOT NULL DEFAULT 'SUBSCRIBED',
    "launchNotifiedAt" TIMESTAMP(3),
    "notes" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "LaunchSubscriber_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LaunchSubscriber_code_key" ON "LaunchSubscriber"("code");
CREATE UNIQUE INDEX "LaunchSubscriber_phone_key" ON "LaunchSubscriber"("phone");
CREATE INDEX "LaunchSubscriber_status_idx" ON "LaunchSubscriber"("status");
CREATE INDEX "LaunchSubscriber_source_idx" ON "LaunchSubscriber"("source");
CREATE INDEX "LaunchSubscriber_createdAt_idx" ON "LaunchSubscriber"("createdAt");
CREATE INDEX "LaunchSubscriber_deletedAt_idx" ON "LaunchSubscriber"("deletedAt");
