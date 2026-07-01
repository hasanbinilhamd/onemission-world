export class OrderError extends Error {
  constructor({
    message,
    statusCode = 400,
    code = 'ORDER_VALIDATION_FAILED',
  }) {
    super(message);
    this.name = 'OrderError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function normalizeOrderError(error) {
  if (error instanceof OrderError) {
    return error;
  }

  return new OrderError({
    message: 'Order could not be created.',
    statusCode: 500,
    code: 'ORDER_INTERNAL_ERROR',
  });
}
