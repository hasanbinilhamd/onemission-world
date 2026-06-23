-- AlterTable: FinancialAccount - add linkedCoaId
ALTER TABLE "FinancialAccount" ADD COLUMN "linkedCoaId" TEXT;

-- AlterTable: JournalEntry - add journalType and updatedBy
ALTER TABLE "JournalEntry" ADD COLUMN "journalType" TEXT NOT NULL DEFAULT 'Manual';
ALTER TABLE "JournalEntry" ADD COLUMN "updatedBy" TEXT NOT NULL DEFAULT '';

-- AddForeignKey
ALTER TABLE "FinancialAccount" ADD CONSTRAINT "FinancialAccount_linkedCoaId_fkey" FOREIGN KEY ("linkedCoaId") REFERENCES "ChartOfAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
