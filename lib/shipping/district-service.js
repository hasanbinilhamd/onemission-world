import { shippingConfig } from '@/lib/shipping/config';
import { ShippingModuleError } from '@/lib/shipping/errors';
import { shippingService } from '@/lib/shipping';
import { mapDistrictApiResponse } from '@/lib/shipping/mappers';

function resolveProviderName() {
  if (shippingConfig.provider === 'rajaongkir' && shippingConfig.apiKey && shippingConfig.baseUrl) {
    return 'rajaongkir';
  }

  return 'mock';
}

export class DistrictService {
  constructor({ shipping = shippingService, providerName = resolveProviderName() } = {}) {
    this.shippingService = shipping;
    this.providerName = providerName;
  }

  async getDistricts(cityId) {
    if (!cityId) {
      throw new ShippingModuleError({
        message: 'cityId is required.',
        statusCode: 400,
        code: 'SHIPPING_CITY_ID_REQUIRED',
      });
    }

    const districts = await this.shippingService.getDistricts(cityId);
    return districts.map((district) => mapDistrictApiResponse(district, this.providerName));
  }
}

export const districtService = new DistrictService();
