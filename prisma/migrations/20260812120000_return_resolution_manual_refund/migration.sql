ALTER TABLE "ReturnRequest"
  ADD COLUMN "resolution" TEXT NOT NULL DEFAULT 'REFUND',
  ADD COLUMN "receivedAt" TIMESTAMP(3),
  ADD COLUMN "receivedBy" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "inspectedAt" TIMESTAMP(3),
  ADD COLUMN "inspectedBy" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "inspectionResult" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "inspectionNote" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "manualRefundMethod" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "manualRefundDate" TIMESTAMP(3),
  ADD COLUMN "manualRefundReference" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "manualRefundNote" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "manualRefundPaidBy" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "financeTransactionId" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "replacementStatus" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "replacementSentAt" TIMESTAMP(3),
  ADD COLUMN "replacementNote" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "replacementItems" JSONB;

CREATE TABLE "ReturnRequestItem" (
  "id" TEXT NOT NULL,
  "returnRequestId" TEXT NOT NULL,
  "orderItemId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReturnRequestItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ReturnRequest_resolution_idx" ON "ReturnRequest"("resolution");
CREATE INDEX "ReturnRequest_inspectionResult_idx" ON "ReturnRequest"("inspectionResult");
CREATE INDEX "ReturnRequest_financeTransactionId_idx" ON "ReturnRequest"("financeTransactionId");
CREATE INDEX "ReturnRequestItem_returnRequestId_idx" ON "ReturnRequestItem"("returnRequestId");
CREATE INDEX "ReturnRequestItem_orderItemId_idx" ON "ReturnRequestItem"("orderItemId");

ALTER TABLE "ReturnRequestItem"
  ADD CONSTRAINT "ReturnRequestItem_returnRequestId_fkey"
  FOREIGN KEY ("returnRequestId") REFERENCES "ReturnRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReturnRequestItem"
  ADD CONSTRAINT "ReturnRequestItem_orderItemId_fkey"
  FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill item-level records for existing return requests using existing order items.
INSERT INTO "ReturnRequestItem" ("id", "returnRequestId", "orderItemId", "quantity", "updatedAt")
SELECT
  'return-item-' || rr."id" || '-' || oi."id",
  rr."id",
  oi."id",
  oi."quantity",
  CURRENT_TIMESTAMP
FROM "ReturnRequest" rr
JOIN "OrderItem" oi ON oi."orderId" = rr."orderId"
ON CONFLICT DO NOTHING;
