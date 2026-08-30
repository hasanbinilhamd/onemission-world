export const BITESHIP_SHIPPING_PROVIDER = 'biteship';
export const MANUAL_SHIPPING_PROVIDER = 'manual';

export const BITESHIP_ORDER_STATUS = {
  CREATING: 'creating',
  CONFIRMED: 'confirmed',
  SCHEDULED: 'scheduled',
  ALLOCATED: 'allocated',
  PICKING_UP: 'picking_up',
  PICKED: 'picked',
  IN_TRANSIT: 'in_transit',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
  CREATE_FAILED: 'create_failed',
};

export const BITESHIP_ACTIVE_CANCEL_ALLOWED_STATUSES = new Set([
  '',
  BITESHIP_ORDER_STATUS.CREATING,
  BITESHIP_ORDER_STATUS.CONFIRMED,
  BITESHIP_ORDER_STATUS.SCHEDULED,
  BITESHIP_ORDER_STATUS.ALLOCATED,
]);

function readEnv(name, fallback = '') {
  return String(process.env[name] || fallback).trim();
}

function readNumberEnv(name, fallback = 0) {
  const value = Number(readEnv(name));
  return Number.isFinite(value) ? value : fallback;
}

/** Numeric ENV that stays null when unset — needed for optional fields where 0 is a meaningful value (coordinates). */
function readOptionalNumberEnv(name) {
  const raw = readEnv(name);
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function readJsonEnv(name, fallback = {}) {
  const raw = readEnv(name);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function getBiteshipConfig() {
  const nodeEnv = readEnv('NODE_ENV', 'development').toLowerCase();
  const mode = readEnv('BITESHIP_MODE', nodeEnv === 'production' ? 'production' : 'sandbox').toLowerCase();
  const production = mode === 'production';
  const apiKey = production
    ? readEnv('BITESHIP_PRODUCTION_API_KEY') || readEnv('BITESHIP_API_KEY')
    : readEnv('BITESHIP_SANDBOX_API_KEY') || readEnv('BITESHIP_TEST_API_KEY') || readEnv('BITESHIP_API_KEY');

  return {
    mode,
    production,
    apiKey,
    baseUrl: readEnv('BITESHIP_BASE_URL', 'https://api.biteship.com'),
    timeoutMs: readNumberEnv('BITESHIP_TIMEOUT_MS', 15000),
    webhookSecret: readEnv('BITESHIP_WEBHOOK_SECRET'),
    origin: {
      contactName: readEnv('BITESHIP_ORIGIN_CONTACT_NAME'),
      contactPhone: readEnv('BITESHIP_ORIGIN_CONTACT_PHONE'),
      contactEmail: readEnv('BITESHIP_ORIGIN_CONTACT_EMAIL'),
      organization: readEnv('BITESHIP_ORIGIN_ORGANIZATION', 'OneMission'),
      address: readEnv('BITESHIP_ORIGIN_ADDRESS'),
      note: readEnv('BITESHIP_ORIGIN_NOTE'),
      postalCode: readEnv('BITESHIP_ORIGIN_POSTAL_CODE'),
      areaId: readEnv('BITESHIP_ORIGIN_AREA_ID'),
      collectionMethod: readEnv('BITESHIP_ORIGIN_COLLECTION_METHOD', 'pickup'),
      latitude: readOptionalNumberEnv('BITESHIP_ORIGIN_LATITUDE'),
      longitude: readOptionalNumberEnv('BITESHIP_ORIGIN_LONGITUDE'),
    },
    defaultItemWeightGrams: readNumberEnv('BITESHIP_DEFAULT_ITEM_WEIGHT_GRAMS', 200),
    defaultItemLengthCm: readNumberEnv('BITESHIP_DEFAULT_ITEM_LENGTH_CM', 20),
    defaultItemWidthCm: readNumberEnv('BITESHIP_DEFAULT_ITEM_WIDTH_CM', 15),
    defaultItemHeightCm: readNumberEnv('BITESHIP_DEFAULT_ITEM_HEIGHT_CM', 5),
    courierServiceMap: readJsonEnv('BITESHIP_COURIER_SERVICE_MAP_JSON', {}),
  };
}

export function getBiteshipCourierMapping({ courier = '', service = '', overrideCourier = '', overrideService = '' } = {}) {
  const normalizedOverrideCourier = String(overrideCourier || '').trim().toLowerCase();
  const normalizedOverrideService = String(overrideService || '').trim().toLowerCase();
  if (normalizedOverrideCourier && normalizedOverrideService) {
    return { courierCompany: normalizedOverrideCourier, courierType: normalizedOverrideService, source: 'override' };
  }

  const normalizedCourier = String(courier || '').trim().toLowerCase();
  const normalizedService = String(service || '').trim().toLowerCase();
  const config = getBiteshipConfig();
  const mappingKey = `${normalizedCourier}:${normalizedService}`;
  const mapped = config.courierServiceMap[mappingKey] || config.courierServiceMap[normalizedCourier] || null;
  if (mapped?.courierCompany && mapped?.courierType) {
    return {
      courierCompany: String(mapped.courierCompany).trim().toLowerCase(),
      courierType: String(mapped.courierType).trim().toLowerCase(),
      source: 'env',
    };
  }

  return {
    courierCompany: normalizedCourier,
    courierType: normalizedService,
    source: 'order',
  };
}
