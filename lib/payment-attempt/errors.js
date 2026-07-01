export class PaymentAttemptError extends Error {
  constructor({
    message,
    statusCode = 400,
    code = 'PAYMENT_ATTEMPT_VALIDATION_FAILED',
  }) {
    super(message);
    this.name = 'PaymentAttemptError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function normalizePaymentAttemptError(error) {
  if (error instanceof PaymentAttemptError) {
    return error;
  }

  return new PaymentAttemptError({
    message: 'Payment attempt could not be prepared.',
    statusCode: 500,
    code: 'PAYMENT_ATTEMPT_INTERNAL_ERROR',
  });
}
