ALTER TABLE "Customer"
  ADD COLUMN IF NOT EXISTS "isGuest" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Order"
  ALTER COLUMN "paymentAttemptId" DROP NOT NULL;

ALTER TABLE "PaymentAttempt"
  ADD COLUMN IF NOT EXISTS "orderId" TEXT;

UPDATE "PaymentAttempt" AS attempt
SET "orderId" = orders."id"
FROM "Order" AS orders
WHERE orders."paymentAttemptId" = attempt."id"
  AND attempt."orderId" IS NULL;

UPDATE "PaymentAttempt" AS attempt
SET "orderId" = orders."id"
FROM "Order" AS orders
WHERE orders."checkoutSessionId" = attempt."checkoutSessionId"
  AND attempt."orderId" IS NULL;

CREATE INDEX IF NOT EXISTS "PaymentAttempt_orderId_idx" ON "PaymentAttempt"("orderId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'PaymentAttempt_orderId_fkey'
      AND table_name = 'PaymentAttempt'
  ) THEN
    ALTER TABLE "PaymentAttempt"
      ADD CONSTRAINT "PaymentAttempt_orderId_fkey"
      FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
