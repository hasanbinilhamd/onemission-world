CREATE TABLE "Faq" (
  "id" TEXT NOT NULL,
  "question" TEXT NOT NULL,
  "answer" TEXT NOT NULL,
  "category" TEXT NOT NULL DEFAULT '',
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isPublished" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Faq_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Faq_category_idx" ON "Faq"("category");
CREATE INDEX "Faq_isPublished_idx" ON "Faq"("isPublished");
CREATE INDEX "Faq_sortOrder_idx" ON "Faq"("sortOrder");
