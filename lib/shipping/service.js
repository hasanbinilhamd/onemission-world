import { cityCache, districtCache, provinceCache } from '@/lib/shipping/cache';
import { shippingConfig } from '@/lib/shipping/config';
import { ShippingModuleError } from '@/lib/shipping/errors';

function logShippingRequest({ endpoint, durationMs, status, details = '' }) {
  const payload = { endpoint, durationMs, status };
  if (details) payload.details = details;
  if (status === 'error') {
    console.warn('[ShippingService]', payload);
    return;
  }
  console.log('[ShippingService]', payload);
}

async function measure(endpoint, executor) {
  const startedAt = Date.now();
  try {
    const result = await executor();
    logShippingRequest({
      endpoint,
      durationMs: Date.now() - startedAt,
      status: 'success',
    });
    return result;
  } catch (error) {
    logShippingRequest({
      endpoint,
      durationMs: Date.now() - startedAt,
      status: 'error',
      details: error?.code || error?.message || 'unknown_error',
    });
    throw error;
  }
}

export class ShippingService {
  constructor(provider) {
    this.provider = provider;
  }

  async getProvinces() {
    return measure('/shipping/provinces', async () => {
      const cached = provinceCache.get('all');
      if (cached) return cached;
      const provinces = await this.provider.getProvinces();
      provinceCache.set('all', provinces, shippingConfig.cacheTtlMs);
      return provinces;
    });
  }

  async getCities(provinceId) {
    if (!provinceId) {
      throw new ShippingModuleError({
        message: 'province_id is required.',
        statusCode: 400,
        code: 'SHIPPING_PROVINCE_ID_REQUIRED',
      });
    }

    return measure('/shipping/cities', async () => {
      const cacheKey = String(provinceId);
      const cached = cityCache.get(cacheKey);
      if (cached) return cached;
      const cities = await this.provider.getCities(cacheKey);
      cityCache.set(cacheKey, cities, shippingConfig.cacheTtlMs);
      return cities;
    });
  }

  async getDistricts(cityId) {
    if (!cityId) {
      throw new ShippingModuleError({
        message: 'city_id is required.',
        statusCode: 400,
        code: 'SHIPPING_CITY_ID_REQUIRED',
      });
    }

    return measure('/shipping/districts', async () => {
      const cacheKey = String(cityId);
      const cached = districtCache.get(cacheKey);
      if (cached) return cached;
      const districts = await this.provider.getDistricts(cacheKey);
      districtCache.set(cacheKey, districts, shippingConfig.cacheTtlMs);
      return districts;
    });
  }

  async getShippingCost(payload) {
    const { origin_district, destination_district, weight, courier } = payload || {};

    if (!origin_district || !destination_district || !weight || !courier) {
      throw new ShippingModuleError({
        message: 'origin_district, destination_district, weight, and courier are required.',
        statusCode: 400,
        code: 'SHIPPING_COST_VALIDATION_FAILED',
      });
    }

    const normalizedWeight = Number(weight);
    if (!Number.isFinite(normalizedWeight) || normalizedWeight <= 0) {
      throw new ShippingModuleError({
        message: 'weight must be greater than zero.',
        statusCode: 400,
        code: 'SHIPPING_INVALID_WEIGHT',
      });
    }

    return measure('/shipping/cost', async () => {
      return await this.provider.getShippingCost({
        originDistrictId: String(origin_district),
        destinationDistrictId: String(destination_district),
        weight: normalizedWeight,
        courier: String(courier).trim().toLowerCase(),
      });
    });
  }
}
