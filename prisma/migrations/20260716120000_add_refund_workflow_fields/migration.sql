-- Add refund workflow extensibility fields to ReturnRequest.
ALTER TABLE "ReturnRequest"
  ADD COLUMN IF NOT EXISTS "requestType" TEXT NOT NULL DEFAULT 'PRODUCT_RETURN',
  ADD COLUMN IF NOT EXISTS "refundReference" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "refundAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "refundProvider" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "refundProviderId" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "refundMetadata" JSONB,
  ADD COLUMN IF NOT EXISTS "refundRequestedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "refundApprovedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "refundProcessingAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "refundCompletedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "rejectedAt" TIMESTAMP(3);

-- Backfill timestamps for existing rows when possible.
UPDATE "ReturnRequest"
SET "refundRequestedAt" = COALESCE("refundRequestedAt", "requestedAt")
WHERE "refundStatus" IN ('REQUESTED', 'APPROVED', 'PROCESSING', 'COMPLETED', 'REJECTED')
  AND "refundRequestedAt" IS NULL;

UPDATE "ReturnRequest"
SET "refundApprovedAt" = COALESCE("refundApprovedAt", "approvedAt")
WHERE "status" = 'APPROVED'
  AND "refundApprovedAt" IS NULL;

UPDATE "ReturnRequest"
SET "refundCompletedAt" = COALESCE("refundCompletedAt", "completedAt")
WHERE "refundStatus" = 'COMPLETED'
  AND "refundCompletedAt" IS NULL;

CREATE INDEX IF NOT EXISTS "ReturnRequest_requestType_idx" ON "ReturnRequest"("requestType");
