ALTER TABLE "Customer"
ADD COLUMN "emailVerifiedAt" TIMESTAMP(3);

CREATE TYPE "VerificationType" AS ENUM (
  'REGISTER',
  'RESET_PASSWORD',
  'CHANGE_EMAIL',
  'LOGIN_OTP'
);

CREATE TABLE "VerificationToken" (
  "id" TEXT NOT NULL,
  "type" "VerificationType" NOT NULL,
  "identifier" TEXT NOT NULL,
  "otpHash" TEXT NOT NULL,
  "payload" JSONB,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "resendCount" INTEGER NOT NULL DEFAULT 0,
  "verifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VerificationToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VerificationToken_type_identifier_key" ON "VerificationToken"("type", "identifier");
CREATE INDEX "VerificationToken_identifier_idx" ON "VerificationToken"("identifier");
CREATE INDEX "VerificationToken_type_idx" ON "VerificationToken"("type");
CREATE INDEX "VerificationToken_expiresAt_idx" ON "VerificationToken"("expiresAt");
