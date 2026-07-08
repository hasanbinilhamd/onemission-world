ALTER TABLE "Customer"
ADD COLUMN "passwordResetToken" TEXT,
ADD COLUMN "passwordResetTokenExpiresAt" TIMESTAMP(3);

CREATE INDEX "Customer_passwordResetToken_idx" ON "Customer"("passwordResetToken");
CREATE INDEX "Customer_passwordResetTokenExpiresAt_idx" ON "Customer"("passwordResetTokenExpiresAt");
