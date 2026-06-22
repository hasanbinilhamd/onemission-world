-- AlterTable: add new fields to FinancialAccount
ALTER TABLE "FinancialAccount" ADD COLUMN "accountNumber" TEXT NOT NULL DEFAULT '';
ALTER TABLE "FinancialAccount" ADD COLUMN "bankName" TEXT NOT NULL DEFAULT '';
ALTER TABLE "FinancialAccount" ADD COLUMN "openingBalance" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "FinancialAccount" ADD COLUMN "description" TEXT NOT NULL DEFAULT '';

-- CreateIndex: unique constraint on name
CREATE UNIQUE INDEX "FinancialAccount_name_key" ON "FinancialAccount"("name");
