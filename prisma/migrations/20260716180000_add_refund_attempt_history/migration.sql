-- Add refund reliability fields to ReturnRequest.
ALTER TABLE "ReturnRequest"
  ADD COLUMN IF NOT EXISTS "refundFailureSource" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "retryAvailable" BOOLEAN NOT NULL DEFAULT false;

-- Create refund attempt history table.
CREATE TABLE IF NOT EXISTS "RefundAttempt" (
  "id" TEXT NOT NULL,
  "returnRequestId" TEXT NOT NULL,
  "attemptNumber" INTEGER NOT NULL,
  "gatewayName" TEXT NOT NULL DEFAULT 'MIDTRANS',
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "refundKey" TEXT NOT NULL DEFAULT '',
  "midtransRefundId" TEXT NOT NULL DEFAULT '',
  "transactionId" TEXT NOT NULL DEFAULT '',
  "httpStatus" INTEGER,
  "statusCode" TEXT NOT NULL DEFAULT '',
  "statusMessage" TEXT NOT NULL DEFAULT '',
  "requestBody" JSONB,
  "responseBody" JSONB,
  "responseAt" TIMESTAMP(3),
  "failureSource" TEXT NOT NULL DEFAULT '',
  "failureReason" TEXT NOT NULL DEFAULT '',
  "failureCode" TEXT NOT NULL DEFAULT '',
  "retryAvailable" BOOLEAN NOT NULL DEFAULT false,
  "createdBy" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RefundAttempt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "RefundAttempt_returnRequestId_attemptNumber_key" ON "RefundAttempt"("returnRequestId", "attemptNumber");
CREATE INDEX IF NOT EXISTS "RefundAttempt_returnRequestId_idx" ON "RefundAttempt"("returnRequestId");
CREATE INDEX IF NOT EXISTS "RefundAttempt_status_idx" ON "RefundAttempt"("status");
CREATE INDEX IF NOT EXISTS "RefundAttempt_refundKey_idx" ON "RefundAttempt"("refundKey");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'RefundAttempt_returnRequestId_fkey'
  ) THEN
    ALTER TABLE "RefundAttempt"
      ADD CONSTRAINT "RefundAttempt_returnRequestId_fkey"
      FOREIGN KEY ("returnRequestId") REFERENCES "ReturnRequest"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
