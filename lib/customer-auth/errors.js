export class CustomerAuthError extends Error {
  constructor({
    message,
    statusCode = 400,
    code = 'CUSTOMER_AUTH_VALIDATION_FAILED',
  }) {
    super(message);
    this.name = 'CustomerAuthError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function normalizeCustomerAuthError(error) {
  if (error instanceof CustomerAuthError) {
    return error;
  }

  return new CustomerAuthError({
    message: 'Customer authentication request could not be completed.',
    statusCode: 500,
    code: 'CUSTOMER_AUTH_INTERNAL_ERROR',
  });
}
