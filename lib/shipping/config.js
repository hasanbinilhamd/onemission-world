const DEFAULT_SUPPORTED_COURIERS = ['jne', 'jnt', 'sicepat', 'pos', 'ninja', 'anteraja'];
const DEFAULT_TIMEOUT_MS = 15000;
const DEFAULT_PROVIDER = 'mock';

function parseCouriers(value) {
  if (!value || !value.trim()) return DEFAULT_SUPPORTED_COURIERS;
  return value
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function parseTimeout(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_MS;
}

export const shippingConfig = {
  provider: (process.env.SHIPPING_PROVIDER || DEFAULT_PROVIDER).trim().toLowerCase(),
  apiKey: (process.env.RAJAONGKIR_API_KEY || '').trim(),
  baseUrl: (process.env.RAJAONGKIR_BASE_URL || '').trim(),
  timeout: parseTimeout(process.env.RAJAONGKIR_TIMEOUT),
  supportedCouriers: parseCouriers(process.env.SHIPPING_SUPPORTED_COURIERS),
  cacheTtlMs: 7 * 24 * 60 * 60 * 1000,
};
