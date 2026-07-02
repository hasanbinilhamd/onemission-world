export class CheckoutModuleError extends Error {
  constructor({
    message,
    statusCode = 400,
    code = 'CHECKOUT_VALIDATION_FAILED',
  }) {
    super(message);
    this.name = 'CheckoutModuleError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function normalizeCheckoutError(error) {
  if (error instanceof CheckoutModuleError) {
    return error;
  }

  if (typeof error?.statusCode === 'number' && error?.message) {
    return new CheckoutModuleError({
      message: error.message,
      statusCode: error.statusCode,
      code: error.code || 'CHECKOUT_VALIDATION_FAILED',
    });
  }

  return new CheckoutModuleError({
    message: 'Checkout session could not be created.',
    statusCode: 500,
    code: 'CHECKOUT_INTERNAL_ERROR',
  });
}
