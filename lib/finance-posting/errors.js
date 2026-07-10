export class FinancePostingError extends Error {
  constructor({
    message,
    statusCode = 500,
    code = 'FINANCE_POSTING_FAILED',
  }) {
    super(message);
    this.name = 'FinancePostingError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function normalizeFinancePostingError(error) {
  if (error instanceof FinancePostingError) {
    return error;
  }

  return new FinancePostingError({
    message: 'Finance posting could not be completed.',
    statusCode: 500,
    code: 'FINANCE_POSTING_INTERNAL_ERROR',
  });
}
