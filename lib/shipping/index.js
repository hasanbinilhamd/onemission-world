import { shippingConfig } from '@/lib/shipping/config';
import { ShippingModuleError, normalizeShippingError } from '@/lib/shipping/errors';
import { MockShippingProvider } from '@/lib/shipping/providers/mock-shipping-provider';
import { RajaOngkirProvider } from '@/lib/shipping/providers/rajaongkir-provider';
import { ShippingService } from '@/lib/shipping/service';

function createProvider() {
  if (shippingConfig.provider === 'rajaongkir') {
    if (!shippingConfig.apiKey || !shippingConfig.baseUrl) {
      console.warn('[Shipping] RajaOngkir configuration is incomplete. Falling back to mock provider.');
      return new MockShippingProvider();
    }
    return new RajaOngkirProvider();
  }

  if (shippingConfig.provider !== 'mock') {
    console.warn(`[Shipping] Unsupported provider "${shippingConfig.provider}". Falling back to mock provider.`);
  }

  return new MockShippingProvider();
}

export const shippingService = new ShippingService(createProvider());
export { ShippingModuleError, normalizeShippingError };
