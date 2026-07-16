-- Finalize refund workflow fields.
ALTER TABLE "ReturnRequest"
  ADD COLUMN IF NOT EXISTS "previousOrderStatus" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "previousFulfillmentStatus" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "refundFailureReason" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "lastRefundAttemptAt" TIMESTAMP(3);
