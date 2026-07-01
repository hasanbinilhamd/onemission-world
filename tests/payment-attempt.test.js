import test from 'node:test';
import assert from 'node:assert/strict';
import { PaymentAttemptService } from '../lib/payment-attempt/service.js';
import { PaymentAttemptError } from '../lib/payment-attempt/errors.js';

function createService({
  checkoutSessionStatus = 'DRAFT',
  existingAttempt = null,
  createError = null,
  paymentProviderResult = null,
  notification = null,
  invalidSignature = false,
} = {}) {
  const checkoutSession = {
    id: 'checkout-1',
    checkoutNumber: 'CHK-202607-00001',
    status: checkoutSessionStatus,
    currency: 'IDR',
    customer: {
      customerName: 'John Doe',
      email: 'john@example.com',
      phone: '+628123456789',
    },
    shipping: {
      recipientName: 'John Doe',
      phone: '+628123456789',
      address: {
        streetAddress: 'Example Street 123',
        city: 'Bandung',
        postalCode: '40135',
      },
    },
    items: [
      {
        productId: 'product-1',
        variantId: 'variant-1',
        productName: 'Toonhub Figurine',
        variantName: 'Onyx / Default',
        price: 250000,
        quantity: 2,
      },
    ],
    expiresAt: new Date('2026-07-02T00:00:00.000Z'),
    totals: {
      grandTotal: 518000,
    },
  };

  const store = {
    activeAttempt: existingAttempt,
    confirmedCount: 0,
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
      findFirst: async ({ where } = {}) => {
        if (!store.activeAttempt) return null;
        if (!where || !where.OR) return store.activeAttempt;
        return where.OR.some((entry) => entry.providerReference === store.activeAttempt.providerReference || entry.attemptNumber === store.activeAttempt.attemptNumber)
          ? store.activeAttempt
          : null;
      },
      findUnique: async ({ where }) => (where.id === store.activeAttempt?.id ? store.activeAttempt : null),
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
      update: async ({ where, data }) => {
        if (!store.activeAttempt || where.id !== store.activeAttempt.id) {
          throw new Error('Attempt not found');
        }

        store.activeAttempt = {
          ...store.activeAttempt,
          ...data,
          updatedAt: new Date('2026-07-01T00:05:00.000Z'),
        };
        return store.activeAttempt;
      },
    },
  };

  const paymentProvider = {
    createPaymentSession: async () => paymentProviderResult || {
      providerReference: 'PAY-202607-00001',
      providerTransactionId: 'midtrans-transaction-id',
      snapToken: 'snap-token-123',
      snapRedirectUrl: 'https://app.sandbox.midtrans.com/snap/v2/vtweb/snap-token-123',
    },
    verifyNotificationSignature: async () => {
      if (invalidSignature) {
        throw new PaymentAttemptError({
          message: 'Midtrans notification signature is invalid.',
          statusCode: 401,
          code: 'PAYMENT_ATTEMPT_INVALID_SIGNATURE',
        });
      }
      return notification;
    },
    normalizeNotification: async () => notification,
  };

  const service = new PaymentAttemptService({
    prismaClient,
    checkout,
    paymentProvider,
    idGenerator: () => 'payment-attempt-id',
    nowFactory: () => new Date('2026-07-01T00:00:00.000Z'),
  });

  service.onPaymentConfirmed = async () => {
    store.confirmedCount += 1;
  };

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

test('generates and persists a snap token for a created payment attempt', async () => {
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
  const result = await service.generateSnapToken({ paymentAttemptId: 'attempt-1' });

  assert.equal(result.status, 'PENDING');
  assert.equal(result.snapToken, 'snap-token-123');
  assert.equal(result.providerReference, 'PAY-202607-00001');
});

test('reuses the existing snap token when it already exists', async () => {
  const existingAttempt = {
    id: 'attempt-1',
    attemptNumber: 'PAY-202607-00001',
    checkoutSessionId: 'checkout-1',
    provider: 'MIDTRANS',
    providerReference: 'PAY-202607-00001',
    providerTransactionId: 'midtrans-transaction-id',
    snapToken: 'snap-token-123',
    snapRedirectUrl: 'https://app.sandbox.midtrans.com/snap/v2/vtweb/snap-token-123',
    status: 'PENDING',
    grossAmount: 518000,
    currency: 'IDR',
    expiresAt: new Date('2026-07-02T00:00:00.000Z'),
    createdAt: new Date('2026-07-01T00:00:00.000Z'),
    updatedAt: new Date('2026-07-01T00:00:00.000Z'),
  };

  const { service } = createService({ existingAttempt });
  const result = await service.generateSnapToken({ paymentAttemptId: 'attempt-1' });

  assert.equal(result.snapToken, 'snap-token-123');
  assert.equal(result.status, 'PENDING');
});

test('rejects snap generation for invalid payment attempt status', async () => {
  const existingAttempt = {
    id: 'attempt-1',
    attemptNumber: 'PAY-202607-00001',
    checkoutSessionId: 'checkout-1',
    provider: 'MIDTRANS',
    providerReference: '',
    providerTransactionId: '',
    snapToken: '',
    snapRedirectUrl: '',
    status: 'FAILED',
    grossAmount: 518000,
    currency: 'IDR',
    expiresAt: new Date('2026-07-02T00:00:00.000Z'),
    createdAt: new Date('2026-07-01T00:00:00.000Z'),
    updatedAt: new Date('2026-07-01T00:00:00.000Z'),
  };

  const { service } = createService({ existingAttempt });

  await assert.rejects(
    service.generateSnapToken({ paymentAttemptId: 'attempt-1' }),
    (error) => error.code === 'PAYMENT_ATTEMPT_INVALID_STATUS',
  );
});

test('accepts a valid midtrans signature and marks payment attempt as paid', async () => {
  const existingAttempt = {
    id: 'attempt-1',
    attemptNumber: 'PAY-202607-00001',
    checkoutSessionId: 'checkout-1',
    provider: 'MIDTRANS',
    providerReference: 'PAY-202607-00001',
    providerTransactionId: '',
    snapToken: 'snap-token-123',
    snapRedirectUrl: 'https://app.sandbox.midtrans.com/snap/v2/vtweb/snap-token-123',
    status: 'PENDING',
    grossAmount: 518000,
    currency: 'IDR',
    expiresAt: new Date('2026-07-02T00:00:00.000Z'),
    createdAt: new Date('2026-07-01T00:00:00.000Z'),
    updatedAt: new Date('2026-07-01T00:00:00.000Z'),
  };

  const notification = {
    providerReference: 'PAY-202607-00001',
    providerTransactionId: 'midtrans-trx-1',
    internalStatus: 'PAID',
  };

  const { service, store } = createService({ existingAttempt, notification });
  const result = await service.handleMidtransNotification(notification);

  assert.equal(result.status, 'PAID');
  assert.equal(result.providerTransactionId, 'midtrans-trx-1');
  assert.equal(store.confirmedCount, 1);
});

test('rejects invalid midtrans signatures', async () => {
  const existingAttempt = {
    id: 'attempt-1',
    attemptNumber: 'PAY-202607-00001',
    checkoutSessionId: 'checkout-1',
    provider: 'MIDTRANS',
    providerReference: 'PAY-202607-00001',
    providerTransactionId: '',
    snapToken: 'snap-token-123',
    snapRedirectUrl: 'https://app.sandbox.midtrans.com/snap/v2/vtweb/snap-token-123',
    status: 'PENDING',
    grossAmount: 518000,
    currency: 'IDR',
    expiresAt: new Date('2026-07-02T00:00:00.000Z'),
    createdAt: new Date('2026-07-01T00:00:00.000Z'),
    updatedAt: new Date('2026-07-01T00:00:00.000Z'),
  };

  const notification = {
    providerReference: 'PAY-202607-00001',
    providerTransactionId: 'midtrans-trx-1',
    internalStatus: 'PAID',
  };

  const { service } = createService({ existingAttempt, notification, invalidSignature: true });

  await assert.rejects(
    service.handleMidtransNotification(notification),
    (error) => error.code === 'PAYMENT_ATTEMPT_INVALID_SIGNATURE',
  );
});

test('keeps duplicate paid callbacks idempotent', async () => {
  const existingAttempt = {
    id: 'attempt-1',
    attemptNumber: 'PAY-202607-00001',
    checkoutSessionId: 'checkout-1',
    provider: 'MIDTRANS',
    providerReference: 'PAY-202607-00001',
    providerTransactionId: 'midtrans-trx-1',
    snapToken: 'snap-token-123',
    snapRedirectUrl: 'https://app.sandbox.midtrans.com/snap/v2/vtweb/snap-token-123',
    status: 'PAID',
    grossAmount: 518000,
    currency: 'IDR',
    expiresAt: new Date('2026-07-02T00:00:00.000Z'),
    createdAt: new Date('2026-07-01T00:00:00.000Z'),
    updatedAt: new Date('2026-07-01T00:00:00.000Z'),
  };

  const notification = {
    providerReference: 'PAY-202607-00001',
    providerTransactionId: 'midtrans-trx-1',
    internalStatus: 'PAID',
  };

  const { service, store } = createService({ existingAttempt, notification });
  const result = await service.handleMidtransNotification(notification);

  assert.equal(result.status, 'PAID');
  assert.equal(store.confirmedCount, 0);
});

test('maps pending notification to pending status', async () => {
  const existingAttempt = {
    id: 'attempt-1',
    attemptNumber: 'PAY-202607-00001',
    checkoutSessionId: 'checkout-1',
    provider: 'MIDTRANS',
    providerReference: 'PAY-202607-00001',
    providerTransactionId: '',
    snapToken: 'snap-token-123',
    snapRedirectUrl: 'https://app.sandbox.midtrans.com/snap/v2/vtweb/snap-token-123',
    status: 'CREATED',
    grossAmount: 518000,
    currency: 'IDR',
    expiresAt: new Date('2026-07-02T00:00:00.000Z'),
    createdAt: new Date('2026-07-01T00:00:00.000Z'),
    updatedAt: new Date('2026-07-01T00:00:00.000Z'),
  };

  const notification = {
    providerReference: 'PAY-202607-00001',
    providerTransactionId: 'midtrans-trx-2',
    internalStatus: 'PENDING',
  };

  const { service } = createService({ existingAttempt, notification });
  const result = await service.handleMidtransNotification(notification);

  assert.equal(result.status, 'PENDING');
});

test('maps expired notification to expired status', async () => {
  const existingAttempt = {
    id: 'attempt-1',
    attemptNumber: 'PAY-202607-00001',
    checkoutSessionId: 'checkout-1',
    provider: 'MIDTRANS',
    providerReference: 'PAY-202607-00001',
    providerTransactionId: '',
    snapToken: 'snap-token-123',
    snapRedirectUrl: 'https://app.sandbox.midtrans.com/snap/v2/vtweb/snap-token-123',
    status: 'PENDING',
    grossAmount: 518000,
    currency: 'IDR',
    expiresAt: new Date('2026-07-02T00:00:00.000Z'),
    createdAt: new Date('2026-07-01T00:00:00.000Z'),
    updatedAt: new Date('2026-07-01T00:00:00.000Z'),
  };

  const notification = {
    providerReference: 'PAY-202607-00001',
    providerTransactionId: 'midtrans-trx-3',
    internalStatus: 'EXPIRED',
  };

  const { service } = createService({ existingAttempt, notification });
  const result = await service.handleMidtransNotification(notification);

  assert.equal(result.status, 'EXPIRED');
});

test('maps failed notification to failed status', async () => {
  const existingAttempt = {
    id: 'attempt-1',
    attemptNumber: 'PAY-202607-00001',
    checkoutSessionId: 'checkout-1',
    provider: 'MIDTRANS',
    providerReference: 'PAY-202607-00001',
    providerTransactionId: '',
    snapToken: 'snap-token-123',
    snapRedirectUrl: 'https://app.sandbox.midtrans.com/snap/v2/vtweb/snap-token-123',
    status: 'PENDING',
    grossAmount: 518000,
    currency: 'IDR',
    expiresAt: new Date('2026-07-02T00:00:00.000Z'),
    createdAt: new Date('2026-07-01T00:00:00.000Z'),
    updatedAt: new Date('2026-07-01T00:00:00.000Z'),
  };

  const notification = {
    providerReference: 'PAY-202607-00001',
    providerTransactionId: 'midtrans-trx-4',
    internalStatus: 'FAILED',
  };

  const { service } = createService({ existingAttempt, notification });
  const result = await service.handleMidtransNotification(notification);

  assert.equal(result.status, 'FAILED');
});

test('rejects callback for an invalid payment attempt reference', async () => {
  const { service } = createService({ notification: { providerReference: 'missing-reference', providerTransactionId: 'midtrans-trx-5', internalStatus: 'PAID' } });

  await assert.rejects(
    service.handleMidtransNotification({ providerReference: 'missing-reference' }),
    (error) => error.code === 'PAYMENT_ATTEMPT_NOT_FOUND',
  );
});
