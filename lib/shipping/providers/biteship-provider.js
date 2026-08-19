import { shippingConfig } from '@/lib/shipping/config';
import { ShippingModuleError } from '@/lib/shipping/errors';
import { MockShippingProvider } from './mock-shipping-provider';
import { RajaOngkirProvider } from './rajaongkir-provider';
import { BiteshipApiError, BiteshipClient } from '@/lib/shipping/biteship/client';
import { getBiteshipConfig } from '@/lib/shipping/biteship/config';

function normalizeString(value) {
  return String(value || '').trim();
}

function normalizePostalCode(value) {
  const normalized = normalizeString(value).replace(/\D/g, '');
  return normalized ? Number(normalized) : null;
}

function normalizeCouriers(courier) {
  const configured = String(process.env.BITESHIP_RATES_COURIERS || 'jne,jnt,lion')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

  if (!courier || courier === 'all') return configured.join(',');

  const requested = String(courier)
    .split(/[:,]/)
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
    .filter((entry) => configured.includes(entry));

  return requested.length > 0 ? requested.join(',') : configured.join(',');
}

function normalizeDuration(rate = {}) {
  return normalizeString(rate.duration)
    || [rate.shipment_duration_range, rate.shipment_duration_unit].filter(Boolean).join(' ')
    || '';
}

function mapBiteshipRate(rate = {}) {
  const courier = normalizeString(rate.courier_code || rate.company).toLowerCase();
  const service = normalizeString(rate.courier_service_code || rate.type).toLowerCase();
  const cost = Number(rate.price ?? rate.shipping_fee ?? 0);
  if (!courier || !service || !Number.isFinite(cost) || cost <= 0) return null;

  return {
    courier,
    courierName: normalizeString(rate.courier_name || courier.toUpperCase()),
    service,
    description: normalizeString(rate.courier_service_name || rate.description || service.toUpperCase()),
    estimated_delivery: normalizeDuration(rate),
    cost,
    shippingProvider: 'biteship',
    originProviderId: '',
    destinationProviderId: '',
    availableCollectionMethods: Array.isArray(rate.available_collection_method) ? rate.available_collection_method : [],
    raw: rate,
  };
}

function createLocationProvider() {
  if (shippingConfig.apiKey && shippingConfig.baseUrl) {
    return new RajaOngkirProvider();
  }
  console.warn('[Shipping:BiteshipProvider] RajaOngkir location configuration is incomplete. Using mock locations for local development.');
  return new MockShippingProvider();
}

export class BiteshipProvider {
  constructor({ client = new BiteshipClient(getBiteshipConfig()), locationProvider = createLocationProvider() } = {}) {
    this.client = client;
    this.locationProvider = locationProvider;
  }

  getProvinces() {
    return this.locationProvider.getProvinces();
  }

  getCities(provinceId) {
    return this.locationProvider.getCities(provinceId);
  }

  getDistricts(cityId) {
    return this.locationProvider.getDistricts(cityId);
  }

  async getShippingCost({ originDistrictId, destinationDistrictId, destinationPostalCode, weight, courier }) {
    const config = getBiteshipConfig();
    const originPostalCode = normalizePostalCode(config.origin.postalCode || originDistrictId);
    const destinationId = normalizeString(destinationDistrictId);
    const destinationAreaId = destinationId && !/^\d+$/.test(destinationId) ? destinationId : '';
    const destinationPostal = normalizePostalCode(destinationPostalCode || destinationDistrictId);
    const couriers = normalizeCouriers(courier);

    if (!config.origin.areaId && !originPostalCode) {
      throw new ShippingModuleError({
        message: 'Biteship origin area ID or postal code is required.',
        statusCode: 400,
        code: 'SHIPPING_BITESHIP_ORIGIN_REQUIRED',
      });
    }
    if (!destinationAreaId && !destinationPostal) {
      throw new ShippingModuleError({
        message: 'Destination area ID or postal code is required for Biteship shipping rates.',
        statusCode: 400,
        code: 'SHIPPING_BITESHIP_DESTINATION_REQUIRED',
      });
    }

    const payload = {
      ...(config.origin.areaId ? { origin_area_id: config.origin.areaId } : { origin_postal_code: originPostalCode }),
      ...(destinationAreaId ? { destination_area_id: destinationAreaId } : { destination_postal_code: destinationPostal }),
      couriers,
      items: [
        {
          name: 'OneMission Package',
          description: 'Fashion item',
          category: 'fashion',
          value: 100000,
          quantity: 1,
          height: Math.max(1, config.defaultItemHeightCm),
          length: Math.max(1, config.defaultItemLengthCm),
          weight: Math.max(1, Number(weight || config.defaultItemWeightGrams)),
          width: Math.max(1, config.defaultItemWidthCm),
        },
      ],
    };

    try {
      const response = await this.client.retrieveRates(payload);
      const originProviderId = config.origin.areaId || (originPostalCode ? `postal:${originPostalCode}` : '');
      const destinationProviderId = destinationAreaId || (destinationPostal ? `postal:${destinationPostal}` : '');
      const rates = (response.pricing || []).map(mapBiteshipRate).filter(Boolean).map((rate) => ({
        ...rate,
        originProviderId,
        destinationProviderId,
      }));
      if (rates.length === 0) {
        throw new ShippingModuleError({
          message: 'No Biteship courier rates are available for this destination.',
          statusCode: 400,
          code: 'SHIPPING_BITESHIP_RATES_UNAVAILABLE',
        });
      }
      return rates;
    } catch (error) {
      if (error instanceof ShippingModuleError) throw error;
      if (error instanceof BiteshipApiError) {
        throw new ShippingModuleError({
          message: error.message || 'Biteship rates could not be loaded.',
          statusCode: error.statusCode || 502,
          code: `SHIPPING_${error.code || 'BITESHIP_RATES_FAILED'}`,
          details: JSON.stringify(error.response || {}),
        });
      }
      throw new ShippingModuleError({
        message: 'Biteship rates could not be loaded.',
        statusCode: 502,
        code: 'SHIPPING_BITESHIP_RATES_FAILED',
      });
    }
  }
}
