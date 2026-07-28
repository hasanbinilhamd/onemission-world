import crypto from 'node:crypto';
import { prisma } from '@/lib/prisma';

export const NEWSLETTER_SUBSCRIBER_STATUS = {
  ACTIVE: 'ACTIVE',
  UNSUBSCRIBED: 'UNSUBSCRIBED',
  BLOCKED: 'BLOCKED',
};

export const NEWSLETTER_SUBSCRIBER_SOURCE = {
  FOOTER: 'FOOTER',
};

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const EMAIL_MAX_LENGTH = 255;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class NewsletterError extends Error {
  constructor({ message, statusCode = 400, code = 'NEWSLETTER_ERROR' }) {
    super(message);
    this.name = 'NewsletterError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function parsePositiveInteger(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.trunc(parsed);
}

function buildStartOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function buildStartOfMonth() {
  const date = new Date();
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  return date;
}

function resolveBrowserLabel(userAgent = '') {
  const normalized = String(userAgent || '').toLowerCase();

  if (!normalized) {
    return 'Unknown Browser';
  }
  if (normalized.includes('edg/')) {
    return 'Microsoft Edge';
  }
  if (normalized.includes('opr/') || normalized.includes('opera/')) {
    return 'Opera';
  }
  if (normalized.includes('chrome/')) {
    return 'Google Chrome';
  }
  if (normalized.includes('safari/') && !normalized.includes('chrome/')) {
    return 'Safari';
  }
  if (normalized.includes('firefox/')) {
    return 'Firefox';
  }

  return 'Unknown Browser';
}

function sanitizeIpAddress(ipAddress = '') {
  return String(ipAddress || '').trim().slice(0, 255);
}

function sanitizeUserAgent(userAgent = '') {
  return String(userAgent || '').trim().slice(0, 1000);
}

function validateNewsletterEmail(email) {
  if (!email) {
    throw new NewsletterError({
      message: 'Please enter a valid email address.',
      statusCode: 400,
      code: 'NEWSLETTER_EMAIL_REQUIRED',
    });
  }

  if (email.length > EMAIL_MAX_LENGTH) {
    throw new NewsletterError({
      message: 'Please enter a valid email address.',
      statusCode: 400,
      code: 'NEWSLETTER_EMAIL_TOO_LONG',
    });
  }

  if (!EMAIL_PATTERN.test(email)) {
    throw new NewsletterError({
      message: 'Please enter a valid email address.',
      statusCode: 400,
      code: 'NEWSLETTER_EMAIL_INVALID',
    });
  }
}

function buildNewsletterHistory(subscriber) {
  const history = [
    {
      key: 'subscribed',
      label: 'Subscribed',
      timestamp: subscriber.subscribedAt,
      notes: `Joined from ${subscriber.source}.`,
    },
  ];

  if (subscriber.unsubscribedAt) {
    history.push({
      key: 'unsubscribed',
      label: 'Unsubscribed',
      timestamp: subscriber.unsubscribedAt,
      notes: 'Subscription status was updated to UNSUBSCRIBED.',
    });
  }

  if (subscriber.updatedAt && subscriber.updatedAt.getTime() !== subscriber.createdAt.getTime()) {
    history.push({
      key: 'updated',
      label: 'Record Updated',
      timestamp: subscriber.updatedAt,
      notes: 'Subscriber record was updated.',
    });
  }

  return history.sort((left, right) => new Date(left.timestamp).getTime() - new Date(right.timestamp).getTime());
}

function buildNewsletterSubscriberRow(subscriber) {
  return {
    id: subscriber.id,
    email: subscriber.email,
    status: subscriber.status,
    source: subscriber.source,
    ipAddress: subscriber.ipAddress,
    userAgent: subscriber.userAgent,
    browser: resolveBrowserLabel(subscriber.userAgent),
    subscribedAt: subscriber.subscribedAt,
    unsubscribedAt: subscriber.unsubscribedAt,
    createdAt: subscriber.createdAt,
    updatedAt: subscriber.updatedAt,
  };
}

function buildNewsletterSubscriberDetail(subscriber) {
  return {
    ...buildNewsletterSubscriberRow(subscriber),
    history: buildNewsletterHistory(subscriber),
  };
}

function buildNewsletterWhereClause({ search = '', status = 'all' } = {}) {
  const where = {};
  const normalizedSearch = String(search || '').trim();
  const normalizedStatus = String(status || 'all').trim().toUpperCase();

  if (normalizedStatus !== 'ALL') {
    where.status = normalizedStatus;
  }

  if (normalizedSearch) {
    where.email = {
      contains: normalizedSearch,
      mode: 'insensitive',
    };
  }

  return where;
}

async function buildNewsletterSummary(where) {
  const today = buildStartOfToday();
  const month = buildStartOfMonth();

  const [
    totalSubscribers,
    activeSubscribers,
    unsubscribedSubscribers,
    blockedSubscribers,
    todaysSubscribers,
    monthlySubscribers,
    sourceBreakdown,
  ] = await prisma.$transaction([
    prisma.newsletterSubscriber.count({ where }),
    prisma.newsletterSubscriber.count({ where: { ...where, status: NEWSLETTER_SUBSCRIBER_STATUS.ACTIVE } }),
    prisma.newsletterSubscriber.count({ where: { ...where, status: NEWSLETTER_SUBSCRIBER_STATUS.UNSUBSCRIBED } }),
    prisma.newsletterSubscriber.count({ where: { ...where, status: NEWSLETTER_SUBSCRIBER_STATUS.BLOCKED } }),
    prisma.newsletterSubscriber.count({ where: { ...where, subscribedAt: { gte: today } } }),
    prisma.newsletterSubscriber.count({ where: { ...where, subscribedAt: { gte: month } } }),
    prisma.newsletterSubscriber.groupBy({
      by: ['source'],
      where,
      _count: {
        _all: true,
      },
      orderBy: {
        source: 'asc',
      },
    }),
  ]);

  return {
    totalSubscribers,
    activeSubscribers,
    unsubscribedSubscribers,
    blockedSubscribers,
    todaysSubscribers,
    monthlySubscribers,
    growthThisMonth: monthlySubscribers,
    sourceBreakdown: sourceBreakdown.map((entry) => ({
      source: entry.source,
      count: entry._count?._all || 0,
    })),
  };
}

export const newsletterService = {
  normalizeEmail,
  validateNewsletterEmail,
  async subscribe({ email, source = NEWSLETTER_SUBSCRIBER_SOURCE.FOOTER, ipAddress = '', userAgent = '' }) {
    const normalizedEmail = normalizeEmail(email);
    validateNewsletterEmail(normalizedEmail);

    const safeIpAddress = sanitizeIpAddress(ipAddress);
    const safeUserAgent = sanitizeUserAgent(userAgent);
    const existingSubscriber = await prisma.newsletterSubscriber.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingSubscriber?.status === NEWSLETTER_SUBSCRIBER_STATUS.ACTIVE) {
      throw new NewsletterError({
        message: 'You are already part of the ONEMISSION community.',
        statusCode: 409,
        code: 'NEWSLETTER_DUPLICATE_ACTIVE',
      });
    }

    if (existingSubscriber?.status === NEWSLETTER_SUBSCRIBER_STATUS.BLOCKED) {
      throw new NewsletterError({
        message: 'Subscription is not available for this email address.',
        statusCode: 403,
        code: 'NEWSLETTER_SUBSCRIBER_BLOCKED',
      });
    }

    if (existingSubscriber) {
      const updatedSubscriber = await prisma.newsletterSubscriber.update({
        where: { id: existingSubscriber.id },
        data: {
          status: NEWSLETTER_SUBSCRIBER_STATUS.ACTIVE,
          source,
          subscribedAt: new Date(),
          unsubscribedAt: null,
          ipAddress: safeIpAddress,
          userAgent: safeUserAgent,
        },
      });

      return {
        success: true,
        message: 'Welcome to ONEMISSION.',
        subscriber: buildNewsletterSubscriberRow(updatedSubscriber),
      };
    }

    const createdSubscriber = await prisma.newsletterSubscriber.create({
      data: {
        id: crypto.randomUUID(),
        email: normalizedEmail,
        status: NEWSLETTER_SUBSCRIBER_STATUS.ACTIVE,
        source,
        subscribedAt: new Date(),
        ipAddress: safeIpAddress,
        userAgent: safeUserAgent,
      },
    });

    return {
      success: true,
      message: 'Welcome to ONEMISSION.',
      subscriber: buildNewsletterSubscriberRow(createdSubscriber),
    };
  },

  async listSubscribers({ page = DEFAULT_PAGE, limit = DEFAULT_LIMIT, search = '', status = 'all' } = {}) {
    const currentPage = parsePositiveInteger(page, DEFAULT_PAGE);
    const currentLimit = Math.min(parsePositiveInteger(limit, DEFAULT_LIMIT), MAX_LIMIT);
    const where = buildNewsletterWhereClause({ search, status });

    const [items, totalItems, summary] = await Promise.all([
      prisma.newsletterSubscriber.findMany({
        where,
        orderBy: [
          { subscribedAt: 'desc' },
          { createdAt: 'desc' },
        ],
        skip: (currentPage - 1) * currentLimit,
        take: currentLimit,
      }),
      prisma.newsletterSubscriber.count({ where }),
      buildNewsletterSummary(where),
    ]);

    const totalPages = Math.max(1, Math.ceil(totalItems / currentLimit));

    return {
      data: items.map(buildNewsletterSubscriberRow),
      pagination: {
        page: currentPage,
        limit: currentLimit,
        totalItems,
        totalPages,
        hasNextPage: currentPage < totalPages,
        hasPreviousPage: currentPage > 1,
      },
      summary,
    };
  },

  async getSubscriberById(subscriberId) {
    const subscriber = await prisma.newsletterSubscriber.findUnique({
      where: { id: String(subscriberId || '') },
    });

    if (!subscriber) {
      throw new NewsletterError({
        message: 'Newsletter subscriber was not found.',
        statusCode: 404,
        code: 'NEWSLETTER_SUBSCRIBER_NOT_FOUND',
      });
    }

    return buildNewsletterSubscriberDetail(subscriber);
  },

  async unsubscribeSubscriber({ subscriberId }) {
    const subscriber = await prisma.newsletterSubscriber.findUnique({
      where: { id: String(subscriberId || '') },
    });

    if (!subscriber) {
      throw new NewsletterError({
        message: 'Newsletter subscriber was not found.',
        statusCode: 404,
        code: 'NEWSLETTER_SUBSCRIBER_NOT_FOUND',
      });
    }

    if (subscriber.status === NEWSLETTER_SUBSCRIBER_STATUS.UNSUBSCRIBED) {
      return buildNewsletterSubscriberDetail(subscriber);
    }

    const updatedSubscriber = await prisma.newsletterSubscriber.update({
      where: { id: subscriber.id },
      data: {
        status: NEWSLETTER_SUBSCRIBER_STATUS.UNSUBSCRIBED,
        unsubscribedAt: new Date(),
      },
    });

    return buildNewsletterSubscriberDetail(updatedSubscriber);
  },

  async exportSubscribersCsv({ search = '', status = 'all' } = {}) {
    const where = buildNewsletterWhereClause({ search, status });
    const items = await prisma.newsletterSubscriber.findMany({
      where,
      orderBy: [
        { subscribedAt: 'desc' },
        { createdAt: 'desc' },
      ],
    });

    const header = [
      'Email',
      'Status',
      'Source',
      'Subscribed At',
      'Unsubscribed At',
      'IP Address',
      'Browser',
      'User Agent',
      'Created At',
      'Updated At',
    ];

    const escapeCell = (value) => {
      const normalizedValue = String(value ?? '');
      return `"${normalizedValue.replace(/"/g, '""')}"`;
    };

    const rows = items.map((subscriber) => [
      subscriber.email,
      subscriber.status,
      subscriber.source,
      subscriber.subscribedAt?.toISOString() || '',
      subscriber.unsubscribedAt?.toISOString() || '',
      subscriber.ipAddress || '',
      resolveBrowserLabel(subscriber.userAgent),
      subscriber.userAgent || '',
      subscriber.createdAt?.toISOString() || '',
      subscriber.updatedAt?.toISOString() || '',
    ].map(escapeCell).join(','));

    return [header.map(escapeCell).join(','), ...rows].join('\n');
  },
};
