-- CreateTable
CREATE TABLE "ProfitAllocationExecution" (
    "id" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "periodLabel" TEXT NOT NULL,
    "periodStart" TEXT NOT NULL,
    "periodEnd" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "allocationName" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "executionDate" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfitAllocationExecution_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProfitAllocationExecution_periodKey_idx" ON "ProfitAllocationExecution"("periodKey");
CREATE INDEX "ProfitAllocationExecution_policyId_idx" ON "ProfitAllocationExecution"("policyId");
CREATE INDEX "ProfitAllocationExecution_allocationName_idx" ON "ProfitAllocationExecution"("allocationName");
CREATE INDEX "ProfitAllocationExecution_executionDate_idx" ON "ProfitAllocationExecution"("executionDate");

-- AddForeignKey
ALTER TABLE "ProfitAllocationExecution"
    ADD CONSTRAINT "ProfitAllocationExecution_policyId_fkey"
    FOREIGN KEY ("policyId") REFERENCES "ProfitAllocationPolicy"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
