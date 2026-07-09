import crypto from 'crypto';
import { CustomerAuthError } from './errors';

export const CUSTOMER_NUMBER_PREFIX = 'OMC';
export const CUSTOMER_NUMBER_SUFFIX_LENGTH = 10;
export const CUSTOMER_NUMBER_RETRY_LIMIT = 10;
export const CUSTOMER_NUMBER_CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function generateCustomerNumberCandidate() {
  const bytes = crypto.randomBytes(CUSTOMER_NUMBER_SUFFIX_LENGTH);
  let suffix = '';

  for (let index = 0; index < CUSTOMER_NUMBER_SUFFIX_LENGTH; index += 1) {
    suffix += CUSTOMER_NUMBER_CHARSET[bytes[index] % CUSTOMER_NUMBER_CHARSET.length];
  }

  return `${CUSTOMER_NUMBER_PREFIX}-${suffix}`;
}

function logCustomerNumberGenerated({ customerCode = '', attempt = 0 }) {
  console.info('[customer-auth-audit]', JSON.stringify({
    scope: 'CUSTOMER_AUTH',
    eventName: 'CUSTOMER_NUMBER_GENERATED',
    timestamp: new Date().toISOString(),
    customerCode,
    attempt,
  }));
}

export async function generateCustomerCode(prismaClient) {
  for (let attempt = 1; attempt <= CUSTOMER_NUMBER_RETRY_LIMIT; attempt += 1) {
    const candidate = generateCustomerNumberCandidate();
    const existingCustomer = await prismaClient.customer.findFirst({
      where: {
        customerCode: candidate,
      },
      select: { id: true },
    });

    if (!existingCustomer) {
      logCustomerNumberGenerated({ customerCode: candidate, attempt });
      return candidate;
    }
  }

  throw new CustomerAuthError({
    message: 'Customer number could not be generated.',
    statusCode: 500,
    code: 'CUSTOMER_AUTH_NUMBER_GENERATION_FAILED',
  });
}
