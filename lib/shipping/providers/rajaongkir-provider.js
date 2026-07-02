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

function normalizeDistrictCollection(data) {
  if (Array.isArray(data)) {
    return data;
  }

  if (!data || typeof data !== 'object') {
    return [];
  }

  if (Array.isArray(data.data)) {
    return data.data;
  }

  if (Array.isArray(data.results)) {
    return data.results;
  }

  if (
    data.id !== undefined
    || data.district_id !== undefined
    || data.subdistrict_id !== undefined
    || data.name !== undefined
    || data.district_name !== undefined
    || data.subdistrict_name !== undefined
  ) {
    return [data];
  }

  const values = Object.values(data).filter((item) => item && typeof item === 'object');
  return values;
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
    const endpoint = `destination/district/${encodeURIComponent(String(cityId))}`;
    const response = await this.request({
      method: 'GET',
      endpoint,
      resource: 'districts',
      includeDiagnostics: true,
    });

    console.log('[Shipping:RajaOngkirProvider:getDistricts]', {
      requestedUrl: response.requestedUrl,
      httpStatus: response.httpStatus,
      rawJsonResponse: response.rawJsonResponse,
      parsedData: response.data,
    });

    const normalizedDistricts = normalizeDistrictCollection(response.data);

    return normalizedDistricts
      .map(mapDistrictResponse)
      .filter((item) => item.id && item.name);
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

  async request({ method, endpoint, resource, headers = {}, body, includeDiagnostics = false }) {
    const { controller, timeoutId } = createTimeoutSignal(shippingConfig.timeout);
    const requestedUrl = buildUrl(endpoint);

    try {
      const response = await fetch(requestedUrl, {
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

      const rawText = await response.text();
      let parsedJson = {};

      try {
        parsedJson = rawText ? JSON.parse(rawText) : {};
      } catch {
        parsedJson = {};
      }

      if (!response.ok) {
        throw this.createHttpError(response.status, resource, endpoint, rawText);
      }

      if (includeDiagnostics) {
        return {
          ...parsedJson,
          requestedUrl,
          httpStatus: response.status,
          rawJsonResponse: rawText,
        };
      }

      return parsedJson;
    } catch (error) {
      if (error instanceof ShippingModuleError) {
        console.error('[Shipping:RajaOngkirProvider]', {
          resource,
          endpoint,
          requestedUrl,
          providerErrorMessage: error.message,
          providerErrorCode: error.code,
        });
        throw error;
      }

      if (error?.name === 'AbortError') {
        console.error('[Shipping:RajaOngkirProvider]', {
          resource,
          endpoint,
          requestedUrl,
          providerErrorMessage: error.message,
        });
        throw new ShippingModuleError({
          message: 'Shipping provider request timed out.',
          statusCode: 504,
          code: 'SHIPPING_TIMEOUT',
        });
      }

      console.error('[Shipping:RajaOngkirProvider]', {
        resource,
        endpoint,
        requestedUrl,
        providerErrorMessage: error?.message || String(error || ''),
      });
      throw new ShippingModuleError({
        message: 'Shipping provider is unavailable right now.',
        statusCode: 503,
        code: 'SHIPPING_NETWORK_FAILURE',
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  createHttpError(status, resource, endpoint, rawResponse = '') {
    if (status === 400) {
      return new ShippingModuleError({
        message: 'Shipping request is invalid.',
        statusCode: 400,
        code: 'SHIPPING_INVALID_REQUEST',
        details: `${endpoint}:${status}:${resource}:${rawResponse}`,
      });
    }

    if (status === 401 || status === 403) {
      return new ShippingModuleError({
        message: 'Shipping provider credentials are invalid.',
        statusCode: 502,
        code: 'SHIPPING_INVALID_CREDENTIALS',
        details: `${endpoint}:${status}:${resource}:${rawResponse}`,
      });
    }

    if (status === 408) {
      return new ShippingModuleError({
        message: 'Shipping provider request timed out.',
        statusCode: 504,
        code: 'SHIPPING_TIMEOUT',
        details: `${endpoint}:${status}:${resource}:${rawResponse}`,
      });
    }

    if (status === 429) {
      return new ShippingModuleError({
        message: 'Shipping provider rate limit was reached. Please retry later.',
        statusCode: 429,
        code: 'SHIPPING_RATE_LIMIT',
        details: `${endpoint}:${status}:${resource}:${rawResponse}`,
      });
    }

    if (status >= 500) {
      return new ShippingModuleError({
        message: 'Shipping provider is currently unavailable.',
        statusCode: 503,
        code: 'SHIPPING_VENDOR_UNAVAILABLE',
        details: `${endpoint}:${status}:${resource}:${rawResponse}`,
      });
    }

    return new ShippingModuleError({
      message: 'Shipping request failed.',
      statusCode: 502,
      code: 'SHIPPING_PROVIDER_ERROR',
      details: `${endpoint}:${status}:${resource}:${rawResponse}`,
    });
  }
}
