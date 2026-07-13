const CREATOR_ALLOWED_SORT_FIELDS = [
  'name',
  'username',
  'platform',
  'followers',
  'engagement',
  'fee',
  'status',
];

const CREATOR_DEFAULT_SORT_FIELD = 'name';
const CREATOR_DEFAULT_SORT_DIRECTION = 'asc';
const CREATOR_DEFAULT_PAGE = 1;
const CREATOR_DEFAULT_LIMIT = 10;
const CREATOR_MAX_LIMIT = 100;

const CREATOR_STATUS_OPTIONS = [
  'Not Contacted',
  'DM Sent',
  'Negotiation',
  'Deal',
  'Completed',
];

const CREATOR_PLATFORM_OPTIONS = [
  'Instagram',
  'TikTok',
  'YouTube',
  'Threads',
];

function normalizeString(value, fallback = '') {
  return String(value ?? fallback).trim();
}

function normalizeFloat(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeInteger(value, fallback = 0) {
  return Math.trunc(normalizeFloat(value, fallback));
}

function clampNumber(value, minimum, maximum) {
  let nextValue = value;

  if (Number.isFinite(minimum)) {
    nextValue = Math.max(minimum, nextValue);
  }
  if (Number.isFinite(maximum)) {
    nextValue = Math.min(maximum, nextValue);
  }

  return nextValue;
}

function normalizePage(value) {
  const parsed = normalizeInteger(value, CREATOR_DEFAULT_PAGE);
  return parsed > 0 ? parsed : CREATOR_DEFAULT_PAGE;
}

function normalizeLimit(value) {
  const parsed = normalizeInteger(value, CREATOR_DEFAULT_LIMIT);
  if (parsed <= 0) return CREATOR_DEFAULT_LIMIT;
  return Math.min(parsed, CREATOR_MAX_LIMIT);
}

function normalizeCreatorSort(sortBy, sortDirection) {
  const requestedField = normalizeString(sortBy).toLowerCase();
  const matchedField = CREATOR_ALLOWED_SORT_FIELDS.find((field) => field.toLowerCase() === requestedField);
  const usedFallback = Boolean(requestedField) && !matchedField;

  if (!matchedField) {
    return {
      field: CREATOR_DEFAULT_SORT_FIELD,
      direction: CREATOR_DEFAULT_SORT_DIRECTION,
      usedFallback,
    };
  }

  return {
    field: matchedField,
    direction: normalizeString(sortDirection).toLowerCase() === 'desc'
      ? 'desc'
      : CREATOR_DEFAULT_SORT_DIRECTION,
    usedFallback,
  };
}

function buildCreatorListQuery(searchParams) {
  const search = normalizeString(searchParams?.get('search'));
  const status = normalizeString(searchParams?.get('status'));
  const platform = normalizeString(searchParams?.get('platform'));
  const format = normalizeString(searchParams?.get('format')).toLowerCase();
  const page = normalizePage(searchParams?.get('page'));
  const limit = normalizeLimit(searchParams?.get('limit'));
  const sort = normalizeCreatorSort(searchParams?.get('sortBy'), searchParams?.get('sortDirection'));

  const where = {};

  if (status && status !== 'all') {
    where.status = status;
  }

  if (platform && platform !== 'all') {
    where.platform = platform;
  }

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { username: { contains: search, mode: 'insensitive' } },
      { platform: { contains: search, mode: 'insensitive' } },
      { niche: { contains: search, mode: 'insensitive' } },
      { contact: { contains: search, mode: 'insensitive' } },
      { notes: { contains: search, mode: 'insensitive' } },
    ];
  }

  return {
    where,
    orderBy: { [sort.field]: sort.direction },
    page,
    limit,
    skip: (page - 1) * limit,
    take: limit,
    format,
    sort,
    filters: {
      search,
      status: status || 'all',
      platform: platform || 'all',
    },
  };
}

function sanitizeCreatorPayload(payload = {}, { partial = false } = {}) {
  const data = {};

  const assignString = (field, fallback = '') => {
    if (!partial || Object.prototype.hasOwnProperty.call(payload, field)) {
      data[field] = normalizeString(payload[field], fallback);
    }
  };

  const assignFloat = (field, fallback = 0, minimum = 0, maximum = null) => {
    if (!partial || Object.prototype.hasOwnProperty.call(payload, field)) {
      const parsed = clampNumber(normalizeFloat(payload[field], fallback), minimum, maximum);
      data[field] = parsed;
    }
  };

  const assignInteger = (field, fallback = 0, minimum = 0, maximum = null) => {
    if (!partial || Object.prototype.hasOwnProperty.call(payload, field)) {
      const parsed = clampNumber(normalizeInteger(payload[field], fallback), minimum, maximum);
      data[field] = parsed;
    }
  };

  assignString('name');
  assignString('username');
  assignString('platform', 'Instagram');
  assignInteger('followers', 0, 0);
  assignFloat('engagement', 0, 0);
  assignString('niche');
  assignInteger('audienceFit', 0, 0, 100);
  assignInteger('valuesScore', 0, 0, 100);
  assignString('contact');
  assignFloat('fee', 0, 0);
  assignString('status', 'Not Contacted');
  assignString('notes');

  return data;
}

function validateCreatorPayload(data, { partial = false } = {}) {
  if ((!partial || Object.prototype.hasOwnProperty.call(data, 'name')) && !normalizeString(data.name)) {
    return 'Creator name is required.';
  }

  if ((!partial || Object.prototype.hasOwnProperty.call(data, 'platform')) && !normalizeString(data.platform)) {
    return 'Platform is required.';
  }

  return null;
}

export {
  buildCreatorListQuery,
  CREATOR_ALLOWED_SORT_FIELDS,
  CREATOR_DEFAULT_LIMIT,
  CREATOR_DEFAULT_PAGE,
  CREATOR_DEFAULT_SORT_DIRECTION,
  CREATOR_DEFAULT_SORT_FIELD,
  CREATOR_PLATFORM_OPTIONS,
  CREATOR_STATUS_OPTIONS,
  sanitizeCreatorPayload,
  validateCreatorPayload,
};
