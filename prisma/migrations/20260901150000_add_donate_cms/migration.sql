-- Movement: Donate (campaigns, updates, disbursements, partners, transactions)
CREATE TYPE "DonationCampaignStatus" AS ENUM ('DRAFT', 'ACTIVE', 'CLOSED');
CREATE TYPE "DonationTransactionStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'EXPIRED', 'CANCELLED');

CREATE TABLE "DonationCampaign" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "slug" TEXT NOT NULL,
    "shortDescription" TEXT NOT NULL DEFAULT '',
    "coverImage" TEXT NOT NULL DEFAULT '',
    "storyTitle" TEXT NOT NULL DEFAULT '',
    "storyContent" TEXT NOT NULL DEFAULT '',
    "targetAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "DonationCampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "activeLock" TEXT,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DonationCampaign_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DonationCampaign_slug_key" ON "DonationCampaign"("slug");
CREATE UNIQUE INDEX "DonationCampaign_activeLock_key" ON "DonationCampaign"("activeLock");
CREATE INDEX "DonationCampaign_status_idx" ON "DonationCampaign"("status");

CREATE TABLE "DonationCampaignUpdate" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "image" TEXT NOT NULL DEFAULT '',
    "imageAlt" TEXT NOT NULL DEFAULT '',
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DonationCampaignUpdate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DonationCampaignUpdate_campaignId_idx" ON "DonationCampaignUpdate"("campaignId");
CREATE INDEX "DonationCampaignUpdate_displayOrder_idx" ON "DonationCampaignUpdate"("displayOrder");

CREATE TABLE "DonationDisbursement" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "partnerName" TEXT NOT NULL DEFAULT '',
    "image" TEXT NOT NULL DEFAULT '',
    "imageAlt" TEXT NOT NULL DEFAULT '',
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DonationDisbursement_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DonationDisbursement_campaignId_idx" ON "DonationDisbursement"("campaignId");
CREATE INDEX "DonationDisbursement_displayOrder_idx" ON "DonationDisbursement"("displayOrder");

CREATE TABLE "DonationPartner" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "tagline" TEXT NOT NULL DEFAULT '',
    "statement" TEXT NOT NULL DEFAULT '',
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DonationPartner_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DonationPartner_campaignId_idx" ON "DonationPartner"("campaignId");
CREATE INDEX "DonationPartner_displayOrder_idx" ON "DonationPartner"("displayOrder");

CREATE TABLE "DonationTransaction" (
    "id" TEXT NOT NULL,
    "transactionNumber" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "donorName" TEXT NOT NULL DEFAULT '',
    "donorEmail" TEXT NOT NULL DEFAULT '',
    "donorPhone" TEXT NOT NULL DEFAULT '',
    "anonymous" BOOLEAN NOT NULL DEFAULT false,
    "status" "DonationTransactionStatus" NOT NULL DEFAULT 'PENDING',
    "snapToken" TEXT NOT NULL DEFAULT '',
    "midtransTransactionId" TEXT NOT NULL DEFAULT '',
    "paymentType" TEXT NOT NULL DEFAULT '',
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DonationTransaction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DonationTransaction_transactionNumber_key" ON "DonationTransaction"("transactionNumber");
CREATE INDEX "DonationTransaction_campaignId_idx" ON "DonationTransaction"("campaignId");
CREATE INDEX "DonationTransaction_status_idx" ON "DonationTransaction"("status");
CREATE INDEX "DonationTransaction_createdAt_idx" ON "DonationTransaction"("createdAt");

ALTER TABLE "DonationCampaignUpdate" ADD CONSTRAINT "DonationCampaignUpdate_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "DonationCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DonationDisbursement" ADD CONSTRAINT "DonationDisbursement_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "DonationCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DonationPartner" ADD CONSTRAINT "DonationPartner_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "DonationCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DonationTransaction" ADD CONSTRAINT "DonationTransaction_campaignId_fkey"
  FOREIGN KEY ("campaignId") REFERENCES "DonationCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
