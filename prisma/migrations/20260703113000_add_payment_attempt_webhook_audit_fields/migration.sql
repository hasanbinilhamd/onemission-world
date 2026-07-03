-- AlterTable
ALTER TABLE "PaymentAttempt"
ADD COLUMN "issuer" TEXT NOT NULL DEFAULT '',
ADD COLUMN "acquirer" TEXT NOT NULL DEFAULT '';
