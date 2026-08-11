-- AlterTable
ALTER TABLE "ProfitAllocationRule"
    ADD COLUMN "financeMappingType" TEXT NOT NULL DEFAULT 'NONE',
    ADD COLUMN "mappedExpenseCategoryId" TEXT,
    ADD COLUMN "mappedChartOfAccountId" TEXT;

-- AlterTable
ALTER TABLE "ProfitAllocationSnapshotRule"
    ADD COLUMN "financeMappingType" TEXT NOT NULL DEFAULT 'NONE',
    ADD COLUMN "mappedExpenseCategoryId" TEXT,
    ADD COLUMN "mappedChartOfAccountId" TEXT,
    ADD COLUMN "mappedFinanceLabel" TEXT NOT NULL DEFAULT '';

-- CreateIndex
CREATE INDEX "ProfitAllocationRule_financeMappingType_idx" ON "ProfitAllocationRule"("financeMappingType");
CREATE INDEX "ProfitAllocationRule_mappedExpenseCategoryId_idx" ON "ProfitAllocationRule"("mappedExpenseCategoryId");
CREATE INDEX "ProfitAllocationRule_mappedChartOfAccountId_idx" ON "ProfitAllocationRule"("mappedChartOfAccountId");
CREATE INDEX "ProfitAllocationSnapshotRule_financeMappingType_idx" ON "ProfitAllocationSnapshotRule"("financeMappingType");
CREATE INDEX "ProfitAllocationSnapshotRule_mappedExpenseCategoryId_idx" ON "ProfitAllocationSnapshotRule"("mappedExpenseCategoryId");
CREATE INDEX "ProfitAllocationSnapshotRule_mappedChartOfAccountId_idx" ON "ProfitAllocationSnapshotRule"("mappedChartOfAccountId");

-- AddForeignKey
ALTER TABLE "ProfitAllocationRule"
    ADD CONSTRAINT "ProfitAllocationRule_mappedExpenseCategoryId_fkey"
    FOREIGN KEY ("mappedExpenseCategoryId") REFERENCES "ExpenseCategory"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfitAllocationRule"
    ADD CONSTRAINT "ProfitAllocationRule_mappedChartOfAccountId_fkey"
    FOREIGN KEY ("mappedChartOfAccountId") REFERENCES "ChartOfAccount"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfitAllocationSnapshotRule"
    ADD CONSTRAINT "ProfitAllocationSnapshotRule_mappedExpenseCategoryId_fkey"
    FOREIGN KEY ("mappedExpenseCategoryId") REFERENCES "ExpenseCategory"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfitAllocationSnapshotRule"
    ADD CONSTRAINT "ProfitAllocationSnapshotRule_mappedChartOfAccountId_fkey"
    FOREIGN KEY ("mappedChartOfAccountId") REFERENCES "ChartOfAccount"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Safe deterministic migration for exact Expense Category name matches only.
-- Ambiguous/non-exact allocation rules remain Not Mapped and must be mapped by the owner.
UPDATE "ProfitAllocationRule" rule
SET "financeMappingType" = 'EXPENSE_CATEGORY',
    "mappedExpenseCategoryId" = category."id"
FROM "ExpenseCategory" category
WHERE LOWER(TRIM(rule."allocationName")) = LOWER(TRIM(category."name"));
