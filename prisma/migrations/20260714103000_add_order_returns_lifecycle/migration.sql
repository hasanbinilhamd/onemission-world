CREATE TABLE "ReturnRequest" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "status" TEXT NOT NULL DEFAULT 'REQUESTED',
  "rejectReason" TEXT NOT NULL DEFAULT '',
  "refundStatus" TEXT NOT NULL DEFAULT 'NONE',
  "attachments" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "approvedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReturnRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReturnRequest_orderId_key" ON "ReturnRequest"("orderId");
CREATE INDEX "ReturnRequest_customerId_idx" ON "ReturnRequest"("customerId");
CREATE INDEX "ReturnRequest_status_idx" ON "ReturnRequest"("status");
CREATE INDEX "ReturnRequest_refundStatus_idx" ON "ReturnRequest"("refundStatus");
CREATE INDEX "ReturnRequest_requestedAt_idx" ON "ReturnRequest"("requestedAt");

ALTER TABLE "ReturnRequest"
  ADD CONSTRAINT "ReturnRequest_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReturnRequest"
  ADD CONSTRAINT "ReturnRequest_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
