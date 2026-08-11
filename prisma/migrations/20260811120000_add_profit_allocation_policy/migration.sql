-- CreateTable
CREATE TABLE "ProfitAllocationPolicy" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfitAllocationPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfitAllocationRule" (
    "id" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "allocationName" TEXT NOT NULL,
    "percentage" DOUBLE PRECISION NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfitAllocationRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProfitAllocationPolicy_status_idx" ON "ProfitAllocationPolicy"("status");
CREATE UNIQUE INDEX "ProfitAllocationPolicy_single_active_idx" ON "ProfitAllocationPolicy"("status") WHERE "status" = 'Active';
CREATE UNIQUE INDEX "ProfitAllocationRule_policyId_allocationName_key" ON "ProfitAllocationRule"("policyId", "allocationName");
CREATE INDEX "ProfitAllocationRule_policyId_idx" ON "ProfitAllocationRule"("policyId");
CREATE INDEX "ProfitAllocationRule_isActive_idx" ON "ProfitAllocationRule"("isActive");
CREATE INDEX "ProfitAllocationRule_displayOrder_idx" ON "ProfitAllocationRule"("displayOrder");

-- AddForeignKey
ALTER TABLE "ProfitAllocationRule"
    ADD CONSTRAINT "ProfitAllocationRule_policyId_fkey"
    FOREIGN KEY ("policyId") REFERENCES "ProfitAllocationPolicy"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed baseline policy only when no allocation policy exists yet
INSERT INTO "ProfitAllocationPolicy" ("id", "name", "description", "status", "updatedAt")
SELECT
    'profit-policy-default-2026',
    'Default Profit Allocation Policy',
    'Baseline OneMission profit allocation target policy.',
    'Active',
    CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "ProfitAllocationPolicy");

INSERT INTO "ProfitAllocationRule" ("id", "policyId", "allocationName", "percentage", "isActive", "displayOrder", "updatedAt")
SELECT * FROM (VALUES
    ('profit-rule-owner-take', 'profit-policy-default-2026', 'Owner Take', 30, true, 1, CURRENT_TIMESTAMP),
    ('profit-rule-investor', 'profit-policy-default-2026', 'Investor', 10, true, 2, CURRENT_TIMESTAMP),
    ('profit-rule-company-asset-purchase', 'profit-policy-default-2026', 'Company Asset Purchase', 5, true, 3, CURRENT_TIMESTAMP),
    ('profit-rule-company-savings', 'profit-policy-default-2026', 'Company Savings', 5, true, 4, CURRENT_TIMESTAMP),
    ('profit-rule-salary-pool', 'profit-policy-default-2026', 'Salary Pool', 15, true, 5, CURRENT_TIMESTAMP),
    ('profit-rule-marketing', 'profit-policy-default-2026', 'Marketing', 10, true, 6, CURRENT_TIMESTAMP),
    ('profit-rule-product-development', 'profit-policy-default-2026', 'Product Development', 12, true, 7, CURRENT_TIMESTAMP),
    ('profit-rule-operational-reserve', 'profit-policy-default-2026', 'Operational Reserve', 8, true, 8, CURRENT_TIMESTAMP),
    ('profit-rule-zakat-social-impact', 'profit-policy-default-2026', 'Zakat / Social Impact', 5, true, 9, CURRENT_TIMESTAMP)
) AS seed("id", "policyId", "allocationName", "percentage", "isActive", "displayOrder", "updatedAt")
WHERE EXISTS (SELECT 1 FROM "ProfitAllocationPolicy" WHERE "id" = 'profit-policy-default-2026')
ON CONFLICT ("policyId", "allocationName") DO NOTHING;
