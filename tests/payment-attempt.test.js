import test from 'node:test';
import assert from 'node:assert/strict';
import { PaymentAttemptService } from '../lib/payment-attempt/service.js';
import { PaymentAttemptError } from '../lib/payment-attempt/errors.js';

function createService({
  checkoutSessionStatus = 'DRAFT',
  existingAttempt = null,
  createError = null,
} = {}) {
  const checkoutSession = {
    id: 'checkout-1',
    checkoutNumber: 'CHK-202607-00001',
    status: checkoutSessionStatus,
    currency: 'IDR',
    expiresAt: new Date('2026-07-02T00:00:00.000Z'),
    totals: {
      grandTotal: 518000,
    },
  };

  const store = {
    activeAttempt: existingAttempt,
  };

  const checkout = {
    getCheckoutSessionForPayment: async (checkoutSessionId) => {
      if (checkoutSessionId !== checkoutSession.id) {
        throw new PaymentAttemptError({
          message: 'Checkout session was not found.',
          statusCode: 404,
          code: 'CHECKOUT_SESSION_NOT_FOUND',
        });
      }

      if (checkoutSessionStatus === 'EXPIRED') {
        throw new PaymentAttemptError({
          message: 'Checkout session has expired.',
          statusCode: 410,
          code: 'CHECKOUT_SESSION_EXPIRED',
        });
      }

      if (checkoutSessionStatus !== 'DRAFT') {
        throw new PaymentAttemptError({
          message: 'Checkout session cannot continue with the current status.',
          statusCode: 400,
          code: 'CHECKOUT_INVALID_STATUS',
        });
      }

      return checkoutSession;
    },
  };

  const prismaClient = {
    paymentAttempt: {
      findMany: async () => [],
      findFirst: async () => store.activeAttempt,
      create: async ({ data }) => {
        if (createError) {
          throw createError;
        }

        const created = {
          ...data,
          createdAt: new Date('2026-07-01T00:00:00.000Z'),
          updatedAt: new Date('2026-07-01T00:00:00.000Z'),
        };
        store.activeAttempt = created;
        return created;
      },
    },
  };

  const service = new PaymentAttemptService({
    prismaClient,
    checkout,
    idGenerator: () => 'payment-attempt-id',
    nowFactory: () => new Date('2026-07-01T00:00:00.000Z'),
  });

  return { service, store };
}

test('creates a payment attempt for a valid checkout session', async () => {
  const { service } = createService();
  const result = await service.createPaymentAttempt({ checkoutSessionId: 'checkout-1' });

  assert.equal(result.checkoutSessionId, 'checkout-1');
  assert.equal(result.provider, 'MIDTRANS');
  assert.equal(result.status, 'CREATED');
  assert.equal(result.grossAmount, 518000);
  assert.equal(result.currency, 'IDR');
});

test('reuses an existing active payment attempt', async () => {
  const existingAttempt = {
    id: 'attempt-1',
    attemptNumber: 'PAY-202607-00001',
    checkoutSessionId: 'checkout-1',
    provider: 'MIDTRANS',
    providerReference: '',
    providerTransactionId: '',
    snapToken: '',
    snapRedirectUrl: '',
    status: 'CREATED',
    grossAmount: 518000,
    currency: 'IDR',
    expiresAt: new Date('2026-07-02T00:00:00.000Z'),
    createdAt: new Date('2026-07-01T00:00:00.000Z'),
    updatedAt: new Date('2026-07-01T00:00:00.000Z'),
  };

  const { service } = createService({ existingAttempt });
  const result = await service.createPaymentAttempt({ checkoutSessionId: 'checkout-1' });

  assert.equal(result.id, 'attempt-1');
  assert.equal(result.attemptNumber, 'PAY-202607-00001');
});

test('rejects expired checkout sessions', async () => {
  const { service } = createService({ checkoutSessionStatus: 'EXPIRED' });

  await assert.rejects(
    service.createPaymentAttempt({ checkoutSessionId: 'checkout-1' }),
    (error) => error.code === 'CHECKOUT_SESSION_EXPIRED',
  );
});

test('rejects invalid checkout statuses', async () => {
  const { service } = createService({ checkoutSessionStatus: 'CANCELLED' });

  await assert.rejects(
    service.createPaymentAttempt({ checkoutSessionId: 'checkout-1' }),
    (error) => error.code === 'CHECKOUT_INVALID_STATUS',
  );
});

test('returns the existing active payment attempt when a duplicate create collides', async () => {
  const duplicateError = { code: 'P2002', message: 'Unique constraint failed on PaymentAttempt_active_checkout_idx' };
  const existingAttempt = {
    id: 'attempt-1',
    attemptNumber: 'PAY-202607-00001',
    checkoutSessionId: 'checkout-1',
    provider: 'MIDTRANS',
    providerReference: '',
    providerTransactionId: '',
    snapToken: '',
    snapRedirectUrl: '',
    status: 'PENDING',
    grossAmount: 518000,
    currency: 'IDR',
    expiresAt: new Date('2026-07-02T00:00:00.000Z'),
    createdAt: new Date('2026-07-01T00:00:00.000Z'),
    updatedAt: new Date('2026-07-01T00:00:00.000Z'),
  };

  const { service } = createService({ existingAttempt, createError: duplicateError });
  const result = await service.createPaymentAttempt({ checkoutSessionId: 'checkout-1' });

  assert.equal(result.id, 'attempt-1');
  assert.equal(result.status, 'PENDING');
});
