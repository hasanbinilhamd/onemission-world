export class ShippingModuleError extends Error {
  constructor({
    message,
    statusCode = 500,
    code = 'SHIPPING_INTERNAL_ERROR',
    details = '',
  }) {
    super(message);
    this.name = 'ShippingModuleError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export function normalizeShippingError(error) {
  if (error instanceof ShippingModuleError) {
    return error;
  }

  return new ShippingModuleError({
    message: 'Shipping service is currently unavailable.',
    statusCode: 503,
    code: 'SHIPPING_UNAVAILABLE',
    details: error?.message || String(error || ''),
  });
}
