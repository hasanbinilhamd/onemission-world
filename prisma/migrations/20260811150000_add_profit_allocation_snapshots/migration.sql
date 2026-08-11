-- CreateTable
CREATE TABLE "ProfitAllocationSnapshot" (
    "id" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "periodLabel" TEXT NOT NULL,
    "periodStart" TEXT NOT NULL,
    "periodEnd" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "policyName" TEXT NOT NULL,
    "netProfit" DOUBLE PRECISION NOT NULL,
    "totalAllocated" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdBy" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfitAllocationSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfitAllocationSnapshotRule" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "allocationName" TEXT NOT NULL,
    "percentage" DOUBLE PRECISION NOT NULL,
    "targetAmount" DOUBLE PRECISION NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfitAllocationSnapshotRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProfitAllocationSnapshot_periodKey_key" ON "ProfitAllocationSnapshot"("periodKey");
CREATE INDEX "ProfitAllocationSnapshot_policyId_idx" ON "ProfitAllocationSnapshot"("policyId");
CREATE INDEX "ProfitAllocationSnapshot_periodStart_periodEnd_idx" ON "ProfitAllocationSnapshot"("periodStart", "periodEnd");
CREATE INDEX "ProfitAllocationSnapshotRule_snapshotId_idx" ON "ProfitAllocationSnapshotRule"("snapshotId");
CREATE INDEX "ProfitAllocationSnapshotRule_displayOrder_idx" ON "ProfitAllocationSnapshotRule"("displayOrder");

-- AddForeignKey
ALTER TABLE "ProfitAllocationSnapshot"
    ADD CONSTRAINT "ProfitAllocationSnapshot_policyId_fkey"
    FOREIGN KEY ("policyId") REFERENCES "ProfitAllocationPolicy"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfitAllocationSnapshotRule"
    ADD CONSTRAINT "ProfitAllocationSnapshotRule_snapshotId_fkey"
    FOREIGN KEY ("snapshotId") REFERENCES "ProfitAllocationSnapshot"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
