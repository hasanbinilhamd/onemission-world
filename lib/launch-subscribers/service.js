import crypto from 'node:crypto';
import * as XLSX from 'xlsx';
import { prisma } from '@/lib/prisma';

export const LAUNCH_SUBSCRIBER_STATUS = {
  SUBSCRIBED: 'SUBSCRIBED',
  NOTIFIED: 'NOTIFIED',
  UNSUBSCRIBED: 'UNSUBSCRIBED',
};

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const DEFAULT_SOURCE = 'launch-page';
const DEFAULT_COUNTRY_CODE = 'ID';
const CODE_PREFIX = 'OMS-LS';
const PHONE_PATTERN = /^628\d{8,13}$/;
const SORTABLE_FIELDS = new Set(['createdAt', 'updatedAt', 'code', 'phone', 'status', 'source', 'launchNotifiedAt']);

export class LaunchSubscriberError extends Error {
  constructor({ message, statusCode = 400, code = 'LAUNCH_SUBSCRIBER_ERROR' }) {
    super(message);
    this.name = 'LaunchSubscriberError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

function parsePositiveInteger(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.trunc(parsed);
}

function normalizeStatus(value, fallback = LAUNCH_SUBSCRIBER_STATUS.SUBSCRIBED) {
  const normalized = String(value || '').trim().toUpperCase();
  return Object.values(LAUNCH_SUBSCRIBER_STATUS).includes(normalized) ? normalized : fallback;
}

function normalizeSource(value) {
  return String(value || DEFAULT_SOURCE).trim().toLowerCase() || DEFAULT_SOURCE;
}

function normalizeNotes(value) {
  return String(value || '').trim();
}

export function normalizeIndonesianPhone(value) {
  const raw = String(value || '').trim();
  if (!raw) {
    throw new LaunchSubscriberError({
      message: 'Masukkan nomor WhatsApp yang valid.',
      statusCode: 400,
      code: 'LAUNCH_SUBSCRIBER_PHONE_REQUIRED',
    });
  }

  if (raw.length > 32) {
    throw new LaunchSubscriberError({
      message: 'Masukkan nomor WhatsApp yang valid.',
      statusCode: 400,
      code: 'LAUNCH_SUBSCRIBER_PHONE_INVALID',
    });
  }

  const compact = raw.replace(/[\s().-]/g, '');
  if (!/^\+?\d+$/.test(compact)) {
    throw new LaunchSubscriberError({
      message: 'Masukkan nomor WhatsApp yang valid.',
      statusCode: 400,
      code: 'LAUNCH_SUBSCRIBER_PHONE_INVALID',
    });
  }

  let normalized = compact;
  if (normalized.startsWith('+')) normalized = normalized.slice(1);
  if (normalized.startsWith('08')) normalized = `62${normalized.slice(1)}`;
  if (normalized.startsWith('8')) normalized = `62${normalized}`;

  if (!PHONE_PATTERN.test(normalized)) {
    throw new LaunchSubscriberError({
      message: 'Masukkan nomor WhatsApp yang valid.',
      statusCode: 400,
      code: 'LAUNCH_SUBSCRIBER_PHONE_INVALID',
    });
  }

  return normalized;
}

async function generateLaunchSubscriberCode(prismaClient = prisma) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const suffix = crypto.randomBytes(3).toString('hex').toUpperCase();
    const code = `${CODE_PREFIX}-${suffix}`;
    const existing = await prismaClient.launchSubscriber.findUnique({ where: { code }, select: { id: true } });
    if (!existing) return code;
  }

  throw new LaunchSubscriberError({
    message: 'Launch subscriber code could not be generated.',
    statusCode: 500,
    code: 'LAUNCH_SUBSCRIBER_CODE_FAILED',
  });
}

function buildLaunchSubscriberRow(subscriber) {
  return {
    id: subscriber.id,
    code: subscriber.code,
    phone: subscriber.phone,
    countryCode: subscriber.countryCode || DEFAULT_COUNTRY_CODE,
    source: subscriber.source || DEFAULT_SOURCE,
    status: subscriber.status,
    launchNotifiedAt: subscriber.launchNotifiedAt,
    notes: subscriber.notes || '',
    createdAt: subscriber.createdAt,
    updatedAt: subscriber.updatedAt,
    deletedAt: subscriber.deletedAt,
  };
}

function buildWhereClause({ search = '', status = 'all', source = 'all' } = {}) {
  const where = { deletedAt: null };
  const normalizedStatus = String(status || 'all').trim().toUpperCase();
  const normalizedSource = String(source || 'all').trim();
  const normalizedSearch = String(search || '').trim();

  if (normalizedStatus && normalizedStatus !== 'ALL' && Object.values(LAUNCH_SUBSCRIBER_STATUS).includes(normalizedStatus)) {
    where.status = normalizedStatus;
  }

  if (normalizedSource && normalizedSource.toLowerCase() !== 'all') {
    where.source = normalizedSource;
  }

  if (normalizedSearch) {
    where.OR = [
      { code: { contains: normalizedSearch, mode: 'insensitive' } },
      { phone: { contains: normalizedSearch } },
      { source: { contains: normalizedSearch, mode: 'insensitive' } },
      { notes: { contains: normalizedSearch, mode: 'insensitive' } },
    ];
  }

  return where;
}

async function buildSummary(where) {
  const baseWhere = { deletedAt: null };
  const [totalSubscribers, subscribed, notified, unsubscribed] = await Promise.all([
    prisma.launchSubscriber.count({ where: baseWhere }),
    prisma.launchSubscriber.count({ where: { ...baseWhere, status: LAUNCH_SUBSCRIBER_STATUS.SUBSCRIBED } }),
    prisma.launchSubscriber.count({ where: { ...baseWhere, status: LAUNCH_SUBSCRIBER_STATUS.NOTIFIED } }),
    prisma.launchSubscriber.count({ where: { ...baseWhere, status: LAUNCH_SUBSCRIBER_STATUS.UNSUBSCRIBED } }),
  ]);

  const filteredCount = await prisma.launchSubscriber.count({ where });

  return {
    totalSubscribers,
    subscribed,
    notified,
    unsubscribed,
    filteredCount,
  };
}

function buildSort({ sortBy = 'createdAt', sortOrder = 'desc' } = {}) {
  const field = SORTABLE_FIELDS.has(String(sortBy || '').trim()) ? String(sortBy).trim() : 'createdAt';
  const direction = String(sortOrder || 'desc').trim().toLowerCase() === 'asc' ? 'asc' : 'desc';
  return { [field]: direction };
}

function buildExcelBuffer(rows) {
  const worksheetRows = rows.map((subscriber) => ({
    Code: subscriber.code,
    Phone: subscriber.phone,
    Country: subscriber.countryCode || DEFAULT_COUNTRY_CODE,
    Source: subscriber.source || DEFAULT_SOURCE,
    Status: subscriber.status,
    'Subscribed At': subscriber.createdAt ? new Date(subscriber.createdAt).toISOString() : '',
    'Launch Notified At': subscriber.launchNotifiedAt ? new Date(subscriber.launchNotifiedAt).toISOString() : '',
  }));

  const worksheet = XLSX.utils.json_to_sheet(worksheetRows);
  worksheet['!cols'] = [
    { wch: 16 },
    { wch: 18 },
    { wch: 10 },
    { wch: 18 },
    { wch: 14 },
    { wch: 26 },
    { wch: 26 },
  ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Launch Subscribers');
  return XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });
}

export const launchSubscriberService = {
  normalizeIndonesianPhone,

  async subscribe({ phone, source = DEFAULT_SOURCE } = {}) {
    const normalizedPhone = normalizeIndonesianPhone(phone);
    const normalizedSource = normalizeSource(source);
    const existing = await prisma.launchSubscriber.findUnique({ where: { phone: normalizedPhone } });

    if (existing && !existing.deletedAt && existing.status !== LAUNCH_SUBSCRIBER_STATUS.UNSUBSCRIBED) {
      return {
        success: true,
        duplicate: true,
        message: "You're already on the launch list.",
        subscriber: buildLaunchSubscriberRow(existing),
      };
    }

    if (existing) {
      const updated = await prisma.launchSubscriber.update({
        where: { id: existing.id },
        data: {
          status: LAUNCH_SUBSCRIBER_STATUS.SUBSCRIBED,
          source: normalizedSource,
          countryCode: DEFAULT_COUNTRY_CODE,
          deletedAt: null,
          notes: existing.notes || '',
        },
      });
      return {
        success: true,
        duplicate: false,
        message: "Thank you. We'll notify you on launch day.",
        subscriber: buildLaunchSubscriberRow(updated),
      };
    }

    const subscriber = await prisma.launchSubscriber.create({
      data: {
        id: crypto.randomUUID(),
        code: await generateLaunchSubscriberCode(),
        phone: normalizedPhone,
        countryCode: DEFAULT_COUNTRY_CODE,
        source: normalizedSource,
        status: LAUNCH_SUBSCRIBER_STATUS.SUBSCRIBED,
      },
    });

    return {
      success: true,
      duplicate: false,
      message: "Thank you. We'll notify you on launch day.",
      subscriber: buildLaunchSubscriberRow(subscriber),
    };
  },

  async list({ page = DEFAULT_PAGE, limit = DEFAULT_LIMIT, search = '', status = 'all', source = 'all', sortBy = 'createdAt', sortOrder = 'desc' } = {}) {
    const normalizedPage = parsePositiveInteger(page, DEFAULT_PAGE);
    const normalizedLimit = Math.min(parsePositiveInteger(limit, DEFAULT_LIMIT), MAX_LIMIT);
    const where = buildWhereClause({ search, status, source });
    const [totalItems, items, summary] = await Promise.all([
      prisma.launchSubscriber.count({ where }),
      prisma.launchSubscriber.findMany({
        where,
        orderBy: buildSort({ sortBy, sortOrder }),
        skip: (normalizedPage - 1) * normalizedLimit,
        take: normalizedLimit,
      }),
      buildSummary(where),
    ]);

    return {
      data: items.map(buildLaunchSubscriberRow),
      summary,
      pagination: {
        page: normalizedPage,
        limit: normalizedLimit,
        totalItems,
        totalPages: Math.max(1, Math.ceil(totalItems / normalizedLimit)),
        hasNextPage: normalizedPage * normalizedLimit < totalItems,
        hasPreviousPage: normalizedPage > 1,
      },
    };
  },

  async getById(id) {
    const subscriberId = String(id || '').trim();
    if (!subscriberId) {
      throw new LaunchSubscriberError({ message: 'Launch subscriber id is required.', code: 'LAUNCH_SUBSCRIBER_ID_REQUIRED' });
    }
    const subscriber = await prisma.launchSubscriber.findFirst({ where: { id: subscriberId, deletedAt: null } });
    if (!subscriber) {
      throw new LaunchSubscriberError({ message: 'Launch subscriber was not found.', statusCode: 404, code: 'LAUNCH_SUBSCRIBER_NOT_FOUND' });
    }
    return buildLaunchSubscriberRow(subscriber);
  },

  async update({ id, input = {} } = {}) {
    const existing = await this.getById(id);
    const nextStatus = input.status === undefined ? existing.status : normalizeStatus(input.status, existing.status);
    const data = {
      status: nextStatus,
      notes: input.notes === undefined ? existing.notes : normalizeNotes(input.notes),
    };

    if (nextStatus === LAUNCH_SUBSCRIBER_STATUS.NOTIFIED && !existing.launchNotifiedAt) {
      data.launchNotifiedAt = new Date();
    }
    if (nextStatus !== LAUNCH_SUBSCRIBER_STATUS.NOTIFIED && input.launchNotifiedAt === null) {
      data.launchNotifiedAt = null;
    }

    const updated = await prisma.launchSubscriber.update({ where: { id: existing.id }, data });
    return buildLaunchSubscriberRow(updated);
  },

  async softDelete(id) {
    const existing = await this.getById(id);
    const updated = await prisma.launchSubscriber.update({
      where: { id: existing.id },
      data: {
        status: LAUNCH_SUBSCRIBER_STATUS.UNSUBSCRIBED,
        deletedAt: new Date(),
      },
    });
    return buildLaunchSubscriberRow(updated);
  },

  async exportXlsx({ search = '', status = 'all', source = 'all', sortBy = 'createdAt', sortOrder = 'desc' } = {}) {
    const where = buildWhereClause({ search, status, source });
    const rows = await prisma.launchSubscriber.findMany({
      where,
      orderBy: buildSort({ sortBy, sortOrder }),
    });
    return buildExcelBuffer(rows);
  },
};
