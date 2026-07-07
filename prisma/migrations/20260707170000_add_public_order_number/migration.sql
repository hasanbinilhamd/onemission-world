ALTER TABLE "Order"
ADD COLUMN "publicOrderNumber" TEXT;

DO $$
DECLARE
  current_order RECORD;
  candidate TEXT;
  left_part TEXT;
  right_part TEXT;
  attempt_count INT;
  alphabet CONSTANT TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
BEGIN
  FOR current_order IN SELECT "id" FROM "Order" WHERE "publicOrderNumber" IS NULL LOOP
    attempt_count := 0;

    LOOP
      attempt_count := attempt_count + 1;

      IF attempt_count > 10 THEN
        RAISE EXCEPTION 'Unable to generate unique public order number for order %', current_order."id";
      END IF;

      left_part := '';
      right_part := '';

      FOR idx IN 1..5 LOOP
        left_part := left_part || substr(alphabet, floor(random() * length(alphabet) + 1)::int, 1);
        right_part := right_part || substr(alphabet, floor(random() * length(alphabet) + 1)::int, 1);
      END LOOP;

      candidate := 'OM-' || left_part || '-' || right_part;

      EXIT WHEN NOT EXISTS (
        SELECT 1
        FROM "Order"
        WHERE "publicOrderNumber" = candidate
      );
    END LOOP;

    UPDATE "Order"
    SET "publicOrderNumber" = candidate
    WHERE "id" = current_order."id";
  END LOOP;
END $$;

ALTER TABLE "Order"
ALTER COLUMN "publicOrderNumber" SET NOT NULL;

CREATE UNIQUE INDEX "Order_publicOrderNumber_key" ON "Order"("publicOrderNumber");
