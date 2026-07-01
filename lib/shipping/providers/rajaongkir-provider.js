import { shippingConfig } from '@/lib/shipping/config';
import { ShippingModuleError } from '@/lib/shipping/errors';
import {
  mapCityResponse,
  mapDistrictResponse,
  mapProvinceResponse,
  mapShippingCostResponse,
} from '@/lib/shipping/mappers';

function buildUrl(path) {
  const normalizedBaseUrl = shippingConfig.baseUrl.endsWith('/')
    ? shippingConfig.baseUrl
    : `${shippingConfig.baseUrl}/`;
  return new URL(path, normalizedBaseUrl).toString();
}

function normalizeRequestedCouriers(courier) {
  if (!courier || courier === 'all') return shippingConfig.supportedCouriers.join(':');

  const values = courier
    .split(/[:,]/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
    .filter((item) => shippingConfig.supportedCouriers.includes(item));

  return values.join(':');
}

function createTimeoutSignal(timeoutMs) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  return { controller, timeoutId };
}

export class RajaOngkirProvider {
  async getProvinces() {
    const response = await this.request({
      method: 'GET',
      endpoint: 'destination/province',
      resource: 'provinces',
    });

    return (response.data || []).map(mapProvinceResponse).filter((item) => item.id && item.name);
  }

  async getCities(provinceId) {
    const response = await this.request({
      method: 'GET',
      endpoint: `destination/city/${encodeURIComponent(String(provinceId))}`,
      resource: 'cities',
    });

    return (response.data || []).map(mapCityResponse).filter((item) => item.id && item.name);
  }

  async getDistricts(cityId) {
    const response = await this.request({
      method: 'GET',
      endpoint: `destination/district/${encodeURIComponent(String(cityId))}`,
      resource: 'districts',
    });

    return (response.data || []).map(mapDistrictResponse).filter((item) => item.id && item.name);
  }

  async getShippingCost({ originDistrictId, destinationDistrictId, weight, courier }) {
    const courierValue = normalizeRequestedCouriers(courier);

    if (!courierValue) {
      throw new ShippingModuleError({
        message: 'Courier is not supported.',
        statusCode: 400,
        code: 'SHIPPING_UNSUPPORTED_COURIER',
      });
    }

    const payload = new URLSearchParams({
      origin: String(originDistrictId),
      destination: String(destinationDistrictId),
      weight: String(weight),
      courier: courierValue,
      price: 'lowest',
    });

    const response = await this.request({
      method: 'POST',
      endpoint: 'calculate/district/domestic-cost',
      resource: 'cost',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: payload.toString(),
    });

    return (response.data || []).flatMap((record) => mapShippingCostResponse(record, record?.code));
  }

  async request({ method, endpoint, resource, headers = {}, body }) {
    const { controller, timeoutId } = createTimeoutSignal(shippingConfig.timeout);

    try {
      const response = await fetch(buildUrl(endpoint), {
        method,
        headers: {
          Accept: 'application/json',
          key: shippingConfig.apiKey,
          ...headers,
        },
        body,
        signal: controller.signal,
        cache: 'no-store',
      });

      if (!response.ok) {
        throw this.createHttpError(response.status, resource, endpoint);
      }

      return await response.json();
    } catch (error) {
      if (error instanceof ShippingModuleError) {
        throw error;
      }

      if (error?.name === 'AbortError') {
        throw new ShippingModuleError({
          message: 'Shipping provider request timed out.',
          statusCode: 504,
          code: 'SHIPPING_TIMEOUT',
        });
      }

      throw new ShippingModuleError({
        message: 'Shipping provider is unavailable right now.',
        statusCode: 503,
        code: 'SHIPPING_NETWORK_FAILURE',
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  createHttpError(status, resource, endpoint) {
    if (status === 400) {
      return new ShippingModuleError({
        message: 'Shipping request is invalid.',
        statusCode: 400,
        code: 'SHIPPING_INVALID_REQUEST',
        details: `${endpoint}:${status}:${resource}`,
      });
    }

    if (status === 401 || status === 403) {
      return new ShippingModuleError({
        message: 'Shipping provider credentials are invalid.',
        statusCode: 502,
        code: 'SHIPPING_INVALID_CREDENTIALS',
        details: `${endpoint}:${status}:${resource}`,
      });
    }

    if (status === 408) {
      return new ShippingModuleError({
        message: 'Shipping provider request timed out.',
        statusCode: 504,
        code: 'SHIPPING_TIMEOUT',
        details: `${endpoint}:${status}:${resource}`,
      });
    }

    if (status === 429) {
      return new ShippingModuleError({
        message: 'Shipping provider rate limit was reached. Please retry later.',
        statusCode: 429,
        code: 'SHIPPING_RATE_LIMIT',
        details: `${endpoint}:${status}:${resource}`,
      });
    }

    if (status >= 500) {
      return new ShippingModuleError({
        message: 'Shipping provider is currently unavailable.',
        statusCode: 503,
        code: 'SHIPPING_VENDOR_UNAVAILABLE',
        details: `${endpoint}:${status}:${resource}`,
      });
    }

    return new ShippingModuleError({
      message: 'Shipping request failed.',
      statusCode: 502,
      code: 'SHIPPING_PROVIDER_ERROR',
      details: `${endpoint}:${status}:${resource}`,
    });
  }
}
