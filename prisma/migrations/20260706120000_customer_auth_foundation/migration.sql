ALTER TABLE "Customer"
ADD COLUMN "passwordHash" TEXT,
ADD COLUMN "googleId" TEXT,
ADD COLUMN "emailVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "avatarUrl" TEXT,
ADD COLUMN "lastLoginAt" TIMESTAMP(3),
ADD COLUMN "authProvider" TEXT NOT NULL DEFAULT 'LOCAL';

CREATE UNIQUE INDEX "Customer_googleId_key" ON "Customer"("googleId");

CREATE TABLE "CustomerSession" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "refreshTokenHash" TEXT NOT NULL,
    "device" TEXT NOT NULL DEFAULT '',
    "browser" TEXT NOT NULL DEFAULT '',
    "ipAddress" TEXT NOT NULL DEFAULT '',
    "userAgent" TEXT NOT NULL DEFAULT '',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "CustomerSession_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CustomerSession_customerId_idx" ON "CustomerSession"("customerId");
CREATE INDEX "CustomerSession_expiresAt_idx" ON "CustomerSession"("expiresAt");
CREATE INDEX "CustomerSession_revokedAt_idx" ON "CustomerSession"("revokedAt");

ALTER TABLE "CustomerSession"
ADD CONSTRAINT "CustomerSession_customerId_fkey"
FOREIGN KEY ("customerId") REFERENCES "Customer"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
