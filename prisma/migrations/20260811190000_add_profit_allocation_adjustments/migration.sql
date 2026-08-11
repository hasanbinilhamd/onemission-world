-- CreateTable
CREATE TABLE "ProfitAllocationAdjustment" (
    "id" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "periodLabel" TEXT NOT NULL,
    "periodStart" TEXT NOT NULL,
    "periodEnd" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "sourceAllocationName" TEXT NOT NULL,
    "destinationAllocationName" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfitAllocationAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProfitAllocationAdjustment_periodKey_idx" ON "ProfitAllocationAdjustment"("periodKey");
CREATE INDEX "ProfitAllocationAdjustment_policyId_idx" ON "ProfitAllocationAdjustment"("policyId");
CREATE INDEX "ProfitAllocationAdjustment_periodStart_periodEnd_idx" ON "ProfitAllocationAdjustment"("periodStart", "periodEnd");

-- AddForeignKey
ALTER TABLE "ProfitAllocationAdjustment"
    ADD CONSTRAINT "ProfitAllocationAdjustment_policyId_fkey"
    FOREIGN KEY ("policyId") REFERENCES "ProfitAllocationPolicy"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
