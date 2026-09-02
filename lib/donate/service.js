import crypto from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { writeAuditLog } from '@/lib/hq-security';
import { MidtransProvider } from '@/lib/payment-attempt/providers/midtrans-provider';
import {
  DONATION_CAMPAIGN_STATUS,
  DONATION_TRANSACTION_STATUS,
  DONATION_TRANSACTION_NUMBER_PREFIX,
  validateDonationAmount,
  computeCampaignTotals,
  computeCampaignProgress,
  sortDonationsForPublic,
  resolvePublicDonor,
} from './rules';
import { pageAvailabilityService } from '@/lib/page-availability/service';

/**
 * Movement Donate — campaigns, guest donations, and Midtrans integration.
 *
 * Business rules:
 *  - ONLY ONE campaign may be ACTIVE (activeLock unique column — race-safe).
 *  - Donations are GUEST transactions: no login required. The server never
 *    trusts client-supplied identity/amount/status.
 *  - Payment reuses the EXISTING Midtrans Snap provider used by Shop.
 *  - Campaign progress is computed from PAID donations only (idempotent by
 *    construction — webhook replays cannot double-count).
 *  - Public payloads only expose display name + amount + date — never email,
 *    phone, payment references, or transaction ids.
 */

const DEFAULT_CAMPAIGN = {
  title: 'SUPPORT FLOOD VICTIMS IN KALIMANTAN',
  slug: 'flood-kalimantan',
  shortDescription:
    "We're working with AkSiL to provide essential needs for families affected by the flood.",
  coverImage: '/images/donate/donate-campaign.jpg',
  storyTitle: 'CERITA PENGGALANGAN DANA',
  storyContent: [
    'Bencana banjir yang melanda beberapa wilayah di Kalimantan telah menyebabkan ribuan keluarga harus mengungsi. Rumah-rumah terendam air, dan banyak fasilitas umum yang rusak parah.',
    'One Mission bersama AKSIL berkomitmen untuk menyalurkan bantuan kepada mereka yang paling membutuhkan. Bantuan ini akan difokuskan pada penyediaan bahan makanan pokok, air bersih, pakaian layak pakai, dan perlengkapan medis darurat.',
    'Melalui gerakan ini, kita ingin memastikan bahwa saudara-saudara kita di Kalimantan tidak merasa sendirian. Setiap donasi yang diberikan akan sangat berarti bagi mereka untuk kembali bangkit dan menata kehidupan pasca bencana.',
    'Mari bergerak bersama, tunjukkan kepedulian kita, dan jadikan bantuan ini sebagai wujud nyata dari ukhuwah islamiyah. Your support, their hope.',
  ].join('\n\n'),
  targetAmount: 250_000_000,
};

const DEFAULT_PARTNERS = [
  {
    name: 'AKSIL',
    tagline: 'Bersama, Peduli, Beraksi.',
    statement: 'Working with trusted partners to deliver support where it is needed.',
  },
];

export class DonationError extends Error {
  constructor({ message, statusCode = 400, code = 'DONATION_ERROR' }) {
    super(message);
    this.name = 'DonationError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

function normalizeText(value, fallback = '', maxLength = 2000) {
  return String(value ?? fallback).trim().slice(0, maxLength);
}

function isUniqueConstraintError(error) {
  return error?.code === 'P2002';
}

function serializeCampaignSummary(campaign, totals = { raised: 0, donorCount: 0 }) {
  const targetAmount = Math.max(0, Number(campaign.targetAmount) || 0);
  return {
    id: campaign.id,
    title: campaign.title,
    slug: campaign.slug,
    shortDescription: campaign.shortDescription,
    coverImage: campaign.coverImage,
    status: campaign.status,
    targetAmount,
    raised: totals.raised,
    donorCount: totals.donorCount,
    progressPercent: computeCampaignProgress(totals.raised, targetAmount),
    startedAt: campaign.startedAt,
    endedAt: campaign.endedAt,
  };
}

function serializePartner(partner) {
  return {
    id: partner.id,
    name: partner.name,
    tagline: partner.tagline,
    statement: partner.statement,
  };
}

function serializeUpdate(update) {
  return {
    id: update.id,
    title: update.title,
    date: update.date,
    image: update.image,
    imageAlt: update.imageAlt,
    displayOrder: update.displayOrder,
  };
}

function serializeDisbursement(disbursement) {
  return {
    id: disbursement.id,
    title: disbursement.title,
    date: disbursement.date,
    amount: disbursement.amount,
    partnerName: disbursement.partnerName,
    image: disbursement.image,
    imageAlt: disbursement.imageAlt,
    displayOrder: disbursement.displayOrder,
  };
}

function serializePublicDonation(transaction) {
  return {
    id: transaction.id,
    donorName: resolvePublicDonor(transaction),
    amount: Number(transaction.amount) || 0,
    createdAt: transaction.createdAt,
  };
}

function serializeAdminDonation(transaction) {
  return {
    id: transaction.id,
    transactionNumber: transaction.transactionNumber,
    campaignId: transaction.campaignId,
    amount: Number(transaction.amount) || 0,
    donorName: transaction.donorName,
    donorEmail: transaction.donorEmail,
    donorPhone: transaction.donorPhone,
    anonymous: transaction.anonymous,
    status: transaction.status,
    paymentType: transaction.paymentType,
    paidAt: transaction.paidAt,
    createdAt: transaction.createdAt,
  };
}

async function seedDonateDefaults(prismaClient = prisma) {
  const campaignCount = await prismaClient.donationCampaign.count();
  if (campaignCount > 0) return;

  const campaign = await prismaClient.donationCampaign.create({
    data: {
      id: crypto.randomUUID(),
      title: DEFAULT_CAMPAIGN.title,
      slug: DEFAULT_CAMPAIGN.slug,
      shortDescription: DEFAULT_CAMPAIGN.shortDescription,
      coverImage: DEFAULT_CAMPAIGN.coverImage,
      storyTitle: DEFAULT_CAMPAIGN.storyTitle,
      storyContent: DEFAULT_CAMPAIGN.storyContent,
      targetAmount: DEFAULT_CAMPAIGN.targetAmount,
      // The approved website already presents this campaign as live — seed it
      // ACTIVE so the public page remains content-equivalent after CMS
      // integration. Admins can CLOSE it explicitly.
      status: DONATION_CAMPAIGN_STATUS.ACTIVE,
      activeLock: 'active',
      startedAt: new Date(),
    },
  });

  for (let index = 0; index < DEFAULT_PARTNERS.length; index += 1) {
    const partner = DEFAULT_PARTNERS[index];
    await prismaClient.donationPartner.create({
      data: {
        id: crypto.randomUUID(),
        campaignId: campaign.id,
        name: partner.name,
        tagline: partner.tagline,
        statement: partner.statement,
        displayOrder: index + 1,
      },
    });
  }
}

let donateDefaultsPromise = null;

export async function ensureDonateDefaults(prismaClient = prisma) {
  if (prismaClient !== prisma) {
    await seedDonateDefaults(prismaClient);
    return;
  }

  if (!donateDefaultsPromise) {
    donateDefaultsPromise = seedDonateDefaults(prismaClient).catch((error) => {
      donateDefaultsPromise = null;
      throw error;
    });
  }

  await donateDefaultsPromise;
}

function generateTransactionNumber() {
  const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const random = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `${DONATION_TRANSACTION_NUMBER_PREFIX}${timestamp}-${random}`;
}

const midtransProvider = new MidtransProvider();

const MIDTRANS_INTERNAL_TO_DONATION_STATUS = {
  PENDING: DONATION_TRANSACTION_STATUS.PENDING,
  PAID: DONATION_TRANSACTION_STATUS.PAID,
  FAILED: DONATION_TRANSACTION_STATUS.FAILED,
  EXPIRED: DONATION_TRANSACTION_STATUS.EXPIRED,
  CANCELLED: DONATION_TRANSACTION_STATUS.CANCELLED,
  REFUNDED: DONATION_TRANSACTION_STATUS.CANCELLED,
};

export const donationService = {
  // ── PUBLIC ────────────────────────────────────────────────────────────────

  async getPublicDonatePayload() {

    const activeCampaign = await prisma.donationCampaign.findFirst({
      where: { status: DONATION_CAMPAIGN_STATUS.ACTIVE },
      orderBy: { updatedAt: 'desc' },
      include: {
        donations: true,
        partners: { orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }] },
        updates: { orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }] },
        disbursements: { orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }] },
      },
    });

    const pastCampaigns = await prisma.donationCampaign.findMany({
      where: { status: DONATION_CAMPAIGN_STATUS.CLOSED },
      orderBy: { updatedAt: 'desc' },
      include: { donations: true },
      take: 6,
    });

    const pageAvailability = await pageAvailabilityService.getPageAvailability('donate');

    if (!activeCampaign) {
      return {
        campaign: null,
        story: null,
        updates: [],
        disbursements: [],
        highlights: [],
        partners: [],
        pastCampaigns: pastCampaigns.map((campaign) =>
          serializeCampaignSummary(campaign, computeCampaignTotals(campaign.donations)),
        ),
        pageAvailability: pageAvailability.availability,
      };
    }

    const totals = computeCampaignTotals(activeCampaign.donations);
    const highlights = sortDonationsForPublic(activeCampaign.donations, 'LATEST')
      .slice(0, 5)
      .map(serializePublicDonation);

    return {
      campaign: serializeCampaignSummary(activeCampaign, totals),
      story: {
        title: activeCampaign.storyTitle,
        content: activeCampaign.storyContent,
      },
      updates: activeCampaign.updates.map(serializeUpdate),
      disbursements: activeCampaign.disbursements.map(serializeDisbursement),
      highlights,
      partners: activeCampaign.partners.map(serializePartner),
      pastCampaigns: pastCampaigns.map((campaign) =>
        serializeCampaignSummary(campaign, computeCampaignTotals(campaign.donations)),
      ),
      pageAvailability: pageAvailability.availability,
    };
  },

  async getPublicCampaignDetail(slug) {

    const campaign = await prisma.donationCampaign.findUnique({
      where: { slug: String(slug || '').trim().toLowerCase() },
      include: {
        donations: true,
        updates: { orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }] },
        disbursements: { orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }] },
        partners: { orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }] },
      },
    });

    if (!campaign || campaign.status === DONATION_CAMPAIGN_STATUS.DRAFT) {
      throw new DonationError({
        message: 'Campaign was not found.',
        statusCode: 404,
        code: 'DONATION_CAMPAIGN_NOT_FOUND',
      });
    }

    const totals = computeCampaignTotals(campaign.donations);
    const pageAvailability = await pageAvailabilityService.getPageAvailability('donate');

    return {
      campaign: serializeCampaignSummary(campaign, totals),
      story: {
        title: campaign.storyTitle,
        content: campaign.storyContent,
      },
      updates: campaign.updates.map(serializeUpdate),
      disbursements: campaign.disbursements.map(serializeDisbursement),
      partners: campaign.partners.map(serializePartner),
      isActive: campaign.status === DONATION_CAMPAIGN_STATUS.ACTIVE,
      pageAvailability: pageAvailability.availability,
    };
  },

  async getPublicDonations({ campaignId = null, sort = 'LATEST', offset = 0, limit = 10 } = {}) {

    const normalizedSort = String(sort || 'LATEST').trim().toUpperCase();
    const normalizedLimit = Math.min(50, Math.max(1, Number(limit) || 10));

    const where = {
      status: DONATION_TRANSACTION_STATUS.PAID,
      ...(campaignId ? { campaignId: String(campaignId) } : {}),
    };

    const donations = await prisma.donationTransaction.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
    });

    const sorted = sortDonationsForPublic(donations, normalizedSort);
    const normalizedOffset = Math.max(0, Number(offset) || 0);

    return {
      items: sorted.slice(normalizedOffset, normalizedOffset + normalizedLimit).map(serializePublicDonation),
      total: sorted.length,
      hasMore: normalizedOffset + normalizedLimit < sorted.length,
    };
  },

  async createDonation({ amount, donorName = '', anonymous = false, donorEmail = '', donorPhone = '' } = {}) {

    const validation = validateDonationAmount(amount);
    if (!validation.ok) {
      throw new DonationError({
        message: validation.reason,
        statusCode: 400,
        code: validation.code,
      });
    }

    const campaign = await prisma.donationCampaign.findFirst({
      where: { status: DONATION_CAMPAIGN_STATUS.ACTIVE },
      orderBy: { updatedAt: 'desc' },
    });

    if (!campaign) {
      throw new DonationError({
        message: 'Donation is currently closed.',
        statusCode: 409,
        code: 'DONATION_CAMPAIGN_NOT_ACTIVE',
      });
    }

    const transactionNumber = generateTransactionNumber();
    const isAnonymous = Boolean(anonymous);
    const name = normalizeText(donorName, '', 120);
    const email = normalizeText(donorEmail, '', 254);
    const phone = normalizeText(donorPhone, '', 40);

    // Reuse the EXACT Midtrans Snap provider used by Shop — no second client.
    const snapResult = await midtransProvider.createPaymentSession({
      order_number: transactionNumber,
      gross_amount: validation.amount,
      customer_name: name || 'Donatur',
      email,
      phone,
      created_at: new Date(),
    });

    await prisma.donationTransaction.create({
      data: {
        id: crypto.randomUUID(),
        transactionNumber,
        campaignId: campaign.id,
        amount: validation.amount,
        donorName: name,
        donorEmail: email,
        donorPhone: phone,
        anonymous: isAnonymous,
        status: DONATION_TRANSACTION_STATUS.PENDING,
        snapToken: snapResult.snapToken,
        midtransTransactionId: snapResult.providerTransactionId,
      },
    });

    return {
      transactionNumber,
      snapToken: snapResult.snapToken,
      amount: validation.amount,
      status: DONATION_TRANSACTION_STATUS.PENDING,
    };
  },

  async handleMidtransNotification(payload) {
    // Signature verification + normalization reuse the shared Midtrans
    // provider. Only DON- transactions are handled here.
    const notification = midtransProvider.verifyNotificationSignature(payload);

    if (!String(notification.providerReference || '').startsWith(DONATION_TRANSACTION_NUMBER_PREFIX)) {
      throw new DonationError({
        message: 'Notification does not belong to a donation transaction.',
        statusCode: 400,
        code: 'DONATION_NOTIFICATION_NOT_DONATION',
      });
    }

    const transaction = await prisma.donationTransaction.findUnique({
      where: { transactionNumber: notification.providerReference },
    });

    if (!transaction) {
      throw new DonationError({
        message: 'Donation transaction was not found.',
        statusCode: 404,
        code: 'DONATION_TRANSACTION_NOT_FOUND',
      });
    }

    const nextStatus = MIDTRANS_INTERNAL_TO_DONATION_STATUS[notification.internalStatus];
    if (!nextStatus) {
      throw new DonationError({
        message: 'Unsupported Midtrans status for donation.',
        statusCode: 400,
        code: 'DONATION_NOTIFICATION_STATUS_UNSUPPORTED',
      });
    }

    // Idempotent: replays with the same status only refresh audit fields.
    if (transaction.status === nextStatus) {
      return { transactionNumber: transaction.transactionNumber, status: transaction.status, reused: true };
    }

    await prisma.donationTransaction.update({
      where: { id: transaction.id },
      data: {
        status: nextStatus,
        midtransTransactionId: notification.providerTransactionId || transaction.midtransTransactionId,
        paymentType: notification.paymentType || transaction.paymentType,
        paidAt: nextStatus === DONATION_TRANSACTION_STATUS.PAID ? new Date() : transaction.paidAt,
      },
    });

    // Campaign totals are always COMPUTED from PAID rows — nothing to update
    // here; the next public read reflects the new total automatically.

    return { transactionNumber: transaction.transactionNumber, status: nextStatus, reused: false };
  },

  // ── ADMIN ─────────────────────────────────────────────────────────────────

  async getAdminCampaigns() {

    const campaigns = await prisma.donationCampaign.findMany({
      orderBy: [{ updatedAt: 'desc' }],
      include: { donations: true },
    });

    return {
      campaigns: campaigns.map((campaign) => ({
        ...serializeCampaignSummary(campaign, computeCampaignTotals(campaign.donations)),
        totalDonations: campaign.donations.length,
        activeLockHeld: Boolean(campaign.activeLock),
      })),
    };
  },

  async getAdminCampaignDetail(campaignId) {

    const campaign = await prisma.donationCampaign.findUnique({
      where: { id: String(campaignId || '') },
      include: {
        updates: { orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }] },
        disbursements: { orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }] },
        partners: { orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }] },
        donations: { orderBy: { createdAt: 'desc' }, take: 100 },
      },
    });

    if (!campaign) {
      throw new DonationError({
        message: 'Campaign was not found.',
        statusCode: 404,
        code: 'DONATION_CAMPAIGN_NOT_FOUND',
      });
    }

    return {
      campaign: {
        ...serializeCampaignSummary(campaign, computeCampaignTotals(campaign.donations)),
        storyTitle: campaign.storyTitle,
        storyContent: campaign.storyContent,
      },
      updates: campaign.updates.map(serializeUpdate),
      disbursements: campaign.disbursements.map(serializeDisbursement),
      partners: campaign.partners.map(serializePartner),
      donations: campaign.donations.map(serializeAdminDonation),
    };
  },

  async createCampaign({ campaign = {}, user = null } = {}) {
    const title = normalizeText(campaign.title, '', 240);
    let slug = normalizeText(campaign.slug, '', 160).toLowerCase() || String(Date.now()).slice(-8);
    if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
      slug = `campaign-${String(Date.now()).slice(-8)}`;
    }

    const created = await prisma.donationCampaign.create({
      data: {
        id: crypto.randomUUID(),
        title,
        slug,
        shortDescription: normalizeText(campaign.shortDescription, '', 500),
        coverImage: normalizeText(campaign.coverImage, '', 2000),
        storyTitle: normalizeText(campaign.storyTitle, '', 240),
        storyContent: normalizeText(campaign.storyContent, '', 20000),
        targetAmount: Math.max(0, Number(campaign.targetAmount) || 0),
        status: DONATION_CAMPAIGN_STATUS.DRAFT,
      },
    });

    await writeAuditLog({
      prismaClient: prisma,
      user,
      module: 'SETTINGS',
      action: 'MOVEMENT_DONATION_CAMPAIGN_CREATED',
      description: 'A donation campaign was created.',
      metadata: { campaignId: created.id, slug: created.slug },
    });

    return this.getAdminCampaignDetail(created.id);
  },

  async updateCampaign({ campaignId, campaign = {}, user = null } = {}) {
    const existing = await prisma.donationCampaign.findUnique({ where: { id: String(campaignId || '') } });
    if (!existing) {
      throw new DonationError({
        message: 'Campaign was not found.',
        statusCode: 404,
        code: 'DONATION_CAMPAIGN_NOT_FOUND',
      });
    }

    let slug = normalizeText(campaign.slug, existing.slug, 160).toLowerCase();
    if (!slug || !/^[a-z0-9-]+$/.test(slug)) slug = existing.slug;

    try {
      await prisma.donationCampaign.update({
        where: { id: existing.id },
        data: {
          title: normalizeText(campaign.title, existing.title, 240),
          slug,
          shortDescription: normalizeText(campaign.shortDescription, existing.shortDescription, 500),
          coverImage: normalizeText(campaign.coverImage, existing.coverImage, 2000),
          storyTitle: normalizeText(campaign.storyTitle, existing.storyTitle, 240),
          storyContent: normalizeText(campaign.storyContent, existing.storyContent, 20000),
          targetAmount: Math.max(0, Number(campaign.targetAmount ?? existing.targetAmount)),
        },
      });
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new DonationError({
          message: 'That slug is already used by another campaign.',
          statusCode: 409,
          code: 'DONATION_CAMPAIGN_SLUG_TAKEN',
        });
      }
      throw error;
    }

    await writeAuditLog({
      prismaClient: prisma,
      user,
      module: 'SETTINGS',
      action: 'MOVEMENT_DONATION_CAMPAIGN_UPDATED',
      description: 'A donation campaign was updated.',
      metadata: { campaignId: existing.id },
    });

    return this.getAdminCampaignDetail(existing.id);
  },

  async setCampaignStatus({ campaignId, status, user = null } = {}) {
    const normalizedStatus = String(status || '').trim().toUpperCase();
    if (!Object.values(DONATION_CAMPAIGN_STATUS).includes(normalizedStatus)) {
      throw new DonationError({
        message: 'Invalid campaign status.',
        statusCode: 400,
        code: 'DONATION_CAMPAIGN_STATUS_INVALID',
      });
    }

    const campaign = await prisma.donationCampaign.findUnique({ where: { id: String(campaignId || '') } });
    if (!campaign) {
      throw new DonationError({
        message: 'Campaign was not found.',
        statusCode: 404,
        code: 'DONATION_CAMPAIGN_NOT_FOUND',
      });
    }

    if (normalizedStatus === DONATION_CAMPAIGN_STATUS.ACTIVE) {
      try {
        await prisma.donationCampaign.update({
          where: { id: campaign.id },
          data: {
            status: DONATION_CAMPAIGN_STATUS.ACTIVE,
            activeLock: 'active',
            startedAt: campaign.startedAt || new Date(),
          },
        });
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          const currentlyActive = await prisma.donationCampaign.findFirst({
            where: { status: DONATION_CAMPAIGN_STATUS.ACTIVE },
            orderBy: { updatedAt: 'desc' },
          });
          throw new DonationError({
            message: `Another donation campaign is currently active${currentlyActive ? `: "${currentlyActive.title || 'Untitled campaign'}"` : ''}. Close it before activating this campaign.`,
            statusCode: 409,
            code: 'DONATION_CAMPAIGN_ALREADY_ACTIVE',
          });
        }
        throw error;
      }
    } else {
      await prisma.donationCampaign.update({
        where: { id: campaign.id },
        data: {
          status: normalizedStatus,
          activeLock: null,
          ...(normalizedStatus === DONATION_CAMPAIGN_STATUS.CLOSED ? { endedAt: campaign.endedAt || new Date() } : {}),
        },
      });
    }

    await writeAuditLog({
      prismaClient: prisma,
      user,
      module: 'SETTINGS',
      action: 'MOVEMENT_DONATION_CAMPAIGN_STATUS_CHANGED',
      description: `Donation campaign status changed to ${normalizedStatus}.`,
      metadata: { campaignId: campaign.id, status: normalizedStatus },
    });

    return this.getAdminCampaignDetail(campaign.id);
  },

  async replaceCampaignUpdates({ campaignId, updates = [], user = null } = {}) {
    const campaign = await prisma.donationCampaign.findUnique({ where: { id: String(campaignId || '') } });
    if (!campaign) {
      throw new DonationError({
        message: 'Campaign was not found.',
        statusCode: 404,
        code: 'DONATION_CAMPAIGN_NOT_FOUND',
      });
    }

    const prepared = updates.map((update, index) => ({
      id: crypto.randomUUID(),
      campaignId: campaign.id,
      title: normalizeText(update.title, '', 500),
      date: update.date ? new Date(update.date) : new Date(),
      image: normalizeText(update.image, '', 2000),
      imageAlt: normalizeText(update.imageAlt, '', 500),
      displayOrder: index + 1,
    }));

    await prisma.$transaction(async (tx) => {
      await tx.donationCampaignUpdate.deleteMany({ where: { campaignId: campaign.id } });
      if (prepared.length > 0) {
        await tx.donationCampaignUpdate.createMany({ data: prepared });
      }
    });

    await writeAuditLog({
      prismaClient: prisma,
      user,
      module: 'SETTINGS',
      action: 'MOVEMENT_DONATION_CAMPAIGN_UPDATES_UPDATED',
      description: 'Donation campaign updates were updated.',
      metadata: { campaignId: campaign.id, totalUpdates: prepared.length },
    });

    return this.getAdminCampaignDetail(campaign.id);
  },

  async replaceCampaignDisbursements({ campaignId, disbursements = [], user = null } = {}) {
    const campaign = await prisma.donationCampaign.findUnique({ where: { id: String(campaignId || '') } });
    if (!campaign) {
      throw new DonationError({
        message: 'Campaign was not found.',
        statusCode: 404,
        code: 'DONATION_CAMPAIGN_NOT_FOUND',
      });
    }

    const prepared = disbursements.map((item, index) => ({
      id: crypto.randomUUID(),
      campaignId: campaign.id,
      title: normalizeText(item.title, '', 240),
      date: item.date ? new Date(item.date) : new Date(),
      amount: Math.max(0, Number(item.amount) || 0),
      partnerName: normalizeText(item.partnerName, '', 160),
      image: normalizeText(item.image, '', 2000),
      imageAlt: normalizeText(item.imageAlt, '', 500),
      displayOrder: index + 1,
    }));

    await prisma.$transaction(async (tx) => {
      await tx.donationDisbursement.deleteMany({ where: { campaignId: campaign.id } });
      if (prepared.length > 0) {
        await tx.donationDisbursement.createMany({ data: prepared });
      }
    });

    await writeAuditLog({
      prismaClient: prisma,
      user,
      module: 'SETTINGS',
      action: 'MOVEMENT_DONATION_CAMPAIGN_DISBURSEMENTS_UPDATED',
      description: 'Donation campaign disbursements were updated.',
      metadata: { campaignId: campaign.id, totalDisbursements: prepared.length },
    });

    return this.getAdminCampaignDetail(campaign.id);
  },

  async replaceCampaignPartners({ campaignId, partners = [], user = null } = {}) {
    const campaign = await prisma.donationCampaign.findUnique({ where: { id: String(campaignId || '') } });
    if (!campaign) {
      throw new DonationError({
        message: 'Campaign was not found.',
        statusCode: 404,
        code: 'DONATION_CAMPAIGN_NOT_FOUND',
      });
    }

    const prepared = partners.map((partner, index) => ({
      id: crypto.randomUUID(),
      campaignId: campaign.id,
      name: normalizeText(partner.name, '', 160),
      tagline: normalizeText(partner.tagline, '', 240),
      statement: normalizeText(partner.statement, '', 500),
      displayOrder: index + 1,
    }));

    await prisma.$transaction(async (tx) => {
      await tx.donationPartner.deleteMany({ where: { campaignId: campaign.id } });
      if (prepared.length > 0) {
        await tx.donationPartner.createMany({ data: prepared });
      }
    });

    await writeAuditLog({
      prismaClient: prisma,
      user,
      module: 'SETTINGS',
      action: 'MOVEMENT_DONATION_CAMPAIGN_PARTNERS_UPDATED',
      description: 'Donation campaign partners were updated.',
      metadata: { campaignId: campaign.id, totalPartners: prepared.length },
    });

    return this.getAdminCampaignDetail(campaign.id);
  },
};
