-- CreateTable
CREATE TABLE "ExpenseCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'Active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExpenseCategory_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "CashTransaction"
    ADD COLUMN "expenseCategoryId" TEXT,
    ADD COLUMN "expenseCategoryName" TEXT NOT NULL DEFAULT '',
    ADD COLUMN "vendor" TEXT NOT NULL DEFAULT '',
    ADD COLUMN "paymentMethod" TEXT NOT NULL DEFAULT '',
    ADD COLUMN "notes" TEXT NOT NULL DEFAULT '';

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseCategory_name_key" ON "ExpenseCategory"("name");
CREATE INDEX "CashTransaction_expenseCategoryId_idx" ON "CashTransaction"("expenseCategoryId");
CREATE INDEX "CashTransaction_transactionType_idx" ON "CashTransaction"("transactionType");
CREATE INDEX "CashTransaction_transactionDate_idx" ON "CashTransaction"("transactionDate");

-- AddForeignKey
ALTER TABLE "CashTransaction"
    ADD CONSTRAINT "CashTransaction_expenseCategoryId_fkey"
    FOREIGN KEY ("expenseCategoryId") REFERENCES "ExpenseCategory"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed default expense categories
INSERT INTO "ExpenseCategory" ("id", "name", "description", "status")
VALUES
    ('expcat-operational', 'Operational', 'General operating expenses', 'Active'),
    ('expcat-marketing', 'Marketing', 'Advertising and promotional expenses', 'Active'),
    ('expcat-shipping', 'Shipping', 'Delivery and freight expenses', 'Active'),
    ('expcat-packaging', 'Packaging', 'Packaging materials and supplies', 'Active'),
    ('expcat-office-supplies', 'Office Supplies', 'Office consumables and stationery', 'Active'),
    ('expcat-utilities', 'Utilities', 'Electricity, internet, water, and utilities', 'Active'),
    ('expcat-salary', 'Salary', 'Payroll and compensation expenses', 'Active'),
    ('expcat-software-subscription', 'Software Subscription', 'Software, SaaS, and digital tools', 'Active'),
    ('expcat-maintenance', 'Maintenance', 'Repairs and maintenance expenses', 'Active'),
    ('expcat-miscellaneous', 'Miscellaneous', 'Other uncategorized expenses', 'Active')
ON CONFLICT ("name") DO NOTHING;
