-- CreateTable
CREATE TABLE "PaymentAttempt" (
    "id" TEXT NOT NULL,
    "attemptNumber" TEXT NOT NULL,
    "checkoutSessionId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerReference" TEXT NOT NULL DEFAULT '',
    "providerTransactionId" TEXT NOT NULL DEFAULT '',
    "snapToken" TEXT NOT NULL DEFAULT '',
    "snapRedirectUrl" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'CREATED',
    "grossAmount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'IDR',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAttempt_attemptNumber_key" ON "PaymentAttempt"("attemptNumber");

-- CreateIndex
CREATE INDEX "PaymentAttempt_checkoutSessionId_idx" ON "PaymentAttempt"("checkoutSessionId");

-- CreateIndex
CREATE INDEX "PaymentAttempt_status_idx" ON "PaymentAttempt"("status");

-- Lock one active reusable attempt per checkout session
CREATE UNIQUE INDEX "PaymentAttempt_active_checkout_idx"
ON "PaymentAttempt"("checkoutSessionId")
WHERE "status" IN ('CREATED', 'PENDING');

-- AddForeignKey
ALTER TABLE "PaymentAttempt" ADD CONSTRAINT "PaymentAttempt_checkoutSessionId_fkey"
FOREIGN KEY ("checkoutSessionId") REFERENCES "CheckoutSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
