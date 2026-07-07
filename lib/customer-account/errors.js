export class CustomerAccountError extends Error {
  constructor({
    message,
    statusCode = 400,
    code = 'CUSTOMER_ACCOUNT_VALIDATION_FAILED',
  }) {
    super(message);
    this.name = 'CustomerAccountError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function normalizeCustomerAccountError(error) {
  if (error instanceof CustomerAccountError) {
    return error;
  }

  return new CustomerAccountError({
    message: 'Customer account request could not be completed.',
    statusCode: 500,
    code: 'CUSTOMER_ACCOUNT_INTERNAL_ERROR',
  });
}
