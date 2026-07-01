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

  return new CheckoutModuleError({
    message: 'Checkout session could not be created.',
    statusCode: 500,
    code: 'CHECKOUT_INTERNAL_ERROR',
  });
}
