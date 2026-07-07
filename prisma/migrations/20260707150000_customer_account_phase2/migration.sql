ALTER TABLE "Customer"
ADD COLUMN "provinceId" TEXT NOT NULL DEFAULT '',
ADD COLUMN "cityId" TEXT NOT NULL DEFAULT '',
ADD COLUMN "districtId" TEXT NOT NULL DEFAULT '',
ADD COLUMN "district" TEXT NOT NULL DEFAULT '',
ADD COLUMN "postalCode" TEXT NOT NULL DEFAULT '',
ADD COLUMN "streetAddress" TEXT NOT NULL DEFAULT '';

CREATE TABLE "CustomerAddress" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "recipientName" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "provinceId" TEXT NOT NULL,
    "province" TEXT NOT NULL,
    "cityId" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "districtId" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "streetAddress" TEXT NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerAddress_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CustomerAddress_customerId_idx" ON "CustomerAddress"("customerId");
CREATE INDEX "CustomerAddress_customerId_isDefault_idx" ON "CustomerAddress"("customerId", "isDefault");

ALTER TABLE "CustomerAddress"
ADD CONSTRAINT "CustomerAddress_customerId_fkey"
FOREIGN KEY ("customerId") REFERENCES "Customer"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
