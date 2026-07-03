export class CommerceProductError extends Error {
  constructor({
    message,
    statusCode = 400,
    code = 'COMMERCE_PRODUCT_VALIDATION_FAILED',
  }) {
    super(message);
    this.name = 'CommerceProductError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function normalizeCommerceProductError(error) {
  if (error instanceof CommerceProductError) {
    return error;
  }

  return new CommerceProductError({
    message: 'Commerce product data could not be loaded.',
    statusCode: 500,
    code: 'COMMERCE_PRODUCT_INTERNAL_ERROR',
  });
}
