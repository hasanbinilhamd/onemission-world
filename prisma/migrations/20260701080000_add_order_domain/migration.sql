-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "checkoutSessionId" TEXT NOT NULL,
    "paymentAttemptId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "salesChannelId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'READY_FOR_FULFILLMENT',
    "currency" TEXT NOT NULL DEFAULT 'IDR',
    "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "shippingCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tax" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "grandTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "variantName" TEXT NOT NULL,
    "productImage" TEXT NOT NULL DEFAULT '',
    "price" DOUBLE PRECISION NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "quantity" INTEGER NOT NULL,
    "subtotal" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'IDR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");
CREATE UNIQUE INDEX "Order_checkoutSessionId_key" ON "Order"("checkoutSessionId");
CREATE UNIQUE INDEX "Order_paymentAttemptId_key" ON "Order"("paymentAttemptId");
CREATE INDEX "Order_customerId_idx" ON "Order"("customerId");
CREATE INDEX "Order_salesChannelId_idx" ON "Order"("salesChannelId");
CREATE INDEX "Order_status_idx" ON "Order"("status");
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");
CREATE INDEX "OrderItem_productId_idx" ON "OrderItem"("productId");
CREATE INDEX "OrderItem_variantId_idx" ON "OrderItem"("variantId");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_checkoutSessionId_fkey"
FOREIGN KEY ("checkoutSessionId") REFERENCES "CheckoutSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Order" ADD CONSTRAINT "Order_paymentAttemptId_fkey"
FOREIGN KEY ("paymentAttemptId") REFERENCES "PaymentAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey"
FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
