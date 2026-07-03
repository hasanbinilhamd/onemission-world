import test from 'node:test';
import assert from 'node:assert/strict';
import { PaymentAttemptService } from '../lib/payment-attempt/service.js';
import { MidtransProvider } from '../lib/payment-attempt/providers/midtrans-provider.js';
import { PaymentAttemptError } from '../lib/payment-attempt/errors.js';

function createService({
  checkoutSessionStatus = 'DRAFT',
  existingAttempt = null,
  existingOrder = null,
  createError = null,
  paymentProviderResult = null,
  notification = null,
  invalidSignature = false,
  providerReferenceGenerator = () => 'X8D4FQ',
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
    existingOrder,
    confirmedCount: 0,
    checkoutStatus: checkoutSessionStatus,
    checkoutUpdateCalls: [],
    publishedEvents: [],
    providerRequestPayload: null,
    providerReferenceAtRequestTime: '',
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
          issuer: data.issuer || '',
          acquirer: data.acquirer || '',
          fraudStatus: data.fraudStatus || '',
          paymentType: data.paymentType || '',
          transactionTime: data.transactionTime || null,
          settlementTime: data.settlementTime || null,
          providerPayload: data.providerPayload || null,
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
    checkoutSession: {
      findUnique: async ({ where }) => {
        if (where.id !== checkoutSession.id) {
          return null;
        }

        return {
          ...checkoutSession,
          status: store.checkoutStatus,
        };
      },
      update: async ({ where, data }) => {
        if (where.id !== checkoutSession.id) {
          throw new Error('Checkout session not found');
        }

        store.checkoutStatus = data.status;
        store.checkoutUpdateCalls.push(data);
        return {
          ...checkoutSession,
          status: store.checkoutStatus,
        };
      },
    },
    order: {
      findFirst: async ({ where } = {}) => {
        if (!store.existingOrder) {
          return null;
        }

        if (where?.paymentAttemptId && where.paymentAttemptId !== store.existingOrder.paymentAttemptId) {
          return null;
        }

        return store.existingOrder;
      },
    },
  };

  const paymentProvider = {
    createPaymentSession: async (payload) => {
      store.providerRequestPayload = payload;
      store.providerReferenceAtRequestTime = store.activeAttempt?.providerReference || '';

      return paymentProviderResult || {
        providerReference: payload.order_number,
        providerTransactionId: 'midtrans-transaction-id',
        snapToken: 'snap-token-123',
        snapRedirectUrl: 'https://app.sandbox.midtrans.com/snap/v2/vtweb/snap-token-123',
        redirectUrl: 'https://app.sandbox.midtrans.com/snap/v2/vtweb/snap-token-123',
        providerName: 'Midtrans Snap',
        createdAt: '2026-07-01T00:00:00.000Z',
      };
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

  const eventPublisher = {
    publish: async (eventName, payload) => {
      store.publishedEvents.push({ eventName, payload });
    },
  };

  const service = new PaymentAttemptService({
    prismaClient,
    checkout,
    paymentProvider,
    eventPublisher,
    idGenerator: () => 'payment-attempt-id',
    nowFactory: () => new Date('2026-07-01T00:00:00.000Z'),
    providerReferenceGenerator,
  });

  service.onPaymentConfirmed = async () => {
    store.confirmedCount += 1;
    return store.existingOrder || null;
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
    issuer: '',
    acquirer: '',
    fraudStatus: '',
    paymentType: '',
    transactionTime: null,
    settlementTime: null,
    providerPayload: null,
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
    issuer: '',
    acquirer: '',
    fraudStatus: '',
    paymentType: '',
    transactionTime: null,
    settlementTime: null,
    providerPayload: null,
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
    issuer: '',
    acquirer: '',
    fraudStatus: '',
    paymentType: '',
    transactionTime: null,
    settlementTime: null,
    providerPayload: null,
    expiresAt: new Date('2026-07-02T00:00:00.000Z'),
    createdAt: new Date('2026-07-01T00:00:00.000Z'),
    updatedAt: new Date('2026-07-01T00:00:00.000Z'),
  };

  const { service, store } = createService({ existingAttempt });
  const result = await service.generateSnapToken({ paymentAttemptId: 'attempt-1' });

  assert.equal(result.status, 'PENDING');
  assert.equal(result.snapToken, 'snap-token-123');
  assert.equal(result.providerReference, 'PAY-202607-00001-X8D4FQ');
  assert.equal(result.providerTransactionId, 'midtrans-transaction-id');
  assert.equal(store.providerRequestPayload.order_number, 'PAY-202607-00001-X8D4FQ');
  assert.equal(store.providerReferenceAtRequestTime, 'PAY-202607-00001-X8D4FQ');
});

test('reuses the existing provider reference when generating snap token again', async () => {
  const existingAttempt = {
    id: 'attempt-1',
    attemptNumber: 'PAY-202607-00001',
    checkoutSessionId: 'checkout-1',
    provider: 'MIDTRANS',
    providerReference: 'PAY-202607-00001-KEEP12',
    providerTransactionId: '',
    snapToken: '',
    snapRedirectUrl: '',
    status: 'CREATED',
    grossAmount: 518000,
    currency: 'IDR',
    issuer: '',
    acquirer: '',
    fraudStatus: '',
    paymentType: '',
    transactionTime: null,
    settlementTime: null,
    providerPayload: null,
    expiresAt: new Date('2026-07-02T00:00:00.000Z'),
    createdAt: new Date('2026-07-01T00:00:00.000Z'),
    updatedAt: new Date('2026-07-01T00:00:00.000Z'),
  };

  const { service, store } = createService({
    existingAttempt,
    providerReferenceGenerator: () => 'NEW999',
  });
  const result = await service.generateSnapToken({ paymentAttemptId: 'attempt-1' });

  assert.equal(result.providerReference, 'PAY-202607-00001-KEEP12');
  assert.equal(store.providerRequestPayload.order_number, 'PAY-202607-00001-KEEP12');
  assert.equal(store.providerReferenceAtRequestTime, 'PAY-202607-00001-KEEP12');
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
    issuer: '',
    acquirer: '',
    fraudStatus: '',
    paymentType: '',
    transactionTime: null,
    settlementTime: null,
    providerPayload: null,
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
    issuer: '',
    acquirer: '',
    fraudStatus: '',
    paymentType: '',
    transactionTime: null,
    settlementTime: null,
    providerPayload: null,
    expiresAt: new Date('2026-07-02T00:00:00.000Z'),
    createdAt: new Date('2026-07-01T00:00:00.000Z'),
    updatedAt: new Date('2026-07-01T00:00:00.000Z'),
  };

  const { service, store } = createService({ existingAttempt });

  await assert.rejects(
    service.generateSnapToken({ paymentAttemptId: 'attempt-1' }),
    (error) => error.code === 'PAYMENT_ATTEMPT_INVALID_STATUS',
  );
});

test('accepts a valid midtrans signature and stores complete payment audit information', async () => {
  const existingOrder = {
    id: 'order-1',
    paymentAttemptId: 'attempt-1',
    orderNumber: 'ORD-202607-00001',
  };

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
    issuer: '',
    acquirer: '',
    fraudStatus: '',
    paymentType: '',
    transactionTime: null,
    settlementTime: null,
    providerPayload: null,
    expiresAt: new Date('2026-07-02T00:00:00.000Z'),
    createdAt: new Date('2026-07-01T00:00:00.000Z'),
    updatedAt: new Date('2026-07-01T00:00:00.000Z'),
  };

  const notification = {
    providerReference: 'PAY-202607-00001',
    providerTransactionId: 'midtrans-trx-1',
    internalStatus: 'PAID',
    grossAmount: 518000,
    currency: 'IDR',
    paymentType: 'qris',
    issuer: 'linkaja',
    acquirer: 'gopay',
    fraudStatus: 'accept',
    transactionTime: new Date('2026-07-01T01:00:00.000Z'),
    settlementTime: new Date('2026-07-01T01:05:00.000Z'),
    providerPayload: {
      transaction_status: 'settlement',
      payment_type: 'qris',
      issuer: 'linkaja',
      acquirer: 'gopay',
    },
  };

  const { service, store } = createService({ existingAttempt, existingOrder, notification });
  const result = await service.handleMidtransNotification(notification);

  assert.equal(result.status, 'PAID');
  assert.equal(result.providerTransactionId, 'midtrans-trx-1');
  assert.equal(result.grossAmount, 518000);
  assert.equal(result.currency, 'IDR');
  assert.equal(result.paymentType, 'qris');
  assert.equal(result.issuer, 'linkaja');
  assert.equal(result.acquirer, 'gopay');
  assert.equal(result.fraudStatus, 'accept');
  assert.deepEqual(result.providerPayload, notification.providerPayload);
  assert.equal(store.checkoutUpdateCalls.length, 1);
  assert.equal(store.checkoutUpdateCalls[0].status, 'PAID');
  assert.equal(store.publishedEvents.length, 1);
  assert.equal(store.publishedEvents[0].eventName, 'PaymentSettled');
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
    issuer: '',
    acquirer: '',
    fraudStatus: '',
    paymentType: '',
    transactionTime: null,
    settlementTime: null,
    providerPayload: null,
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

test('keeps duplicate paid callbacks idempotent while refreshing audit fields', async () => {
  const existingOrder = {
    id: 'order-1',
    paymentAttemptId: 'attempt-1',
    orderNumber: 'ORD-202607-00001',
  };

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
    issuer: '',
    acquirer: '',
    fraudStatus: '',
    paymentType: '',
    transactionTime: null,
    settlementTime: null,
    providerPayload: null,
    expiresAt: new Date('2026-07-02T00:00:00.000Z'),
    createdAt: new Date('2026-07-01T00:00:00.000Z'),
    updatedAt: new Date('2026-07-01T00:00:00.000Z'),
  };

  const notification = {
    providerReference: 'PAY-202607-00001',
    providerTransactionId: 'midtrans-trx-1',
    internalStatus: 'PAID',
    grossAmount: 518000,
    currency: 'IDR',
    paymentType: 'qris',
    issuer: 'linkaja',
    acquirer: 'gopay',
    fraudStatus: 'accept',
    transactionTime: new Date('2026-07-01T01:00:00.000Z'),
    settlementTime: new Date('2026-07-01T01:05:00.000Z'),
    providerPayload: { transaction_status: 'settlement', payment_type: 'qris' },
  };

  const { service, store } = createService({
    checkoutSessionStatus: 'PAID',
    existingAttempt,
    existingOrder,
    notification,
  });
  const result = await service.handleMidtransNotification(notification);

  assert.equal(result.status, 'PAID');
  assert.equal(result.paymentType, 'qris');
  assert.equal(result.issuer, 'linkaja');
  assert.equal(result.acquirer, 'gopay');
  assert.equal(result.fraudStatus, 'accept');
  assert.equal(store.confirmedCount, 0);
  assert.equal(store.publishedEvents.length, 0);
  assert.equal(store.checkoutUpdateCalls.length, 0);
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
    issuer: '',
    acquirer: '',
    fraudStatus: '',
    paymentType: '',
    transactionTime: null,
    settlementTime: null,
    providerPayload: null,
    expiresAt: new Date('2026-07-02T00:00:00.000Z'),
    createdAt: new Date('2026-07-01T00:00:00.000Z'),
    updatedAt: new Date('2026-07-01T00:00:00.000Z'),
  };

  const notification = {
    providerReference: 'PAY-202607-00001',
    providerTransactionId: 'midtrans-trx-2',
    internalStatus: 'PENDING',
    providerPayload: { transaction_status: 'pending' },
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
    issuer: '',
    acquirer: '',
    fraudStatus: '',
    paymentType: '',
    transactionTime: null,
    settlementTime: null,
    providerPayload: null,
    expiresAt: new Date('2026-07-02T00:00:00.000Z'),
    createdAt: new Date('2026-07-01T00:00:00.000Z'),
    updatedAt: new Date('2026-07-01T00:00:00.000Z'),
  };

  const notification = {
    providerReference: 'PAY-202607-00001',
    providerTransactionId: 'midtrans-trx-3',
    internalStatus: 'EXPIRED',
    providerPayload: { transaction_status: 'expire' },
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
    issuer: '',
    acquirer: '',
    fraudStatus: '',
    paymentType: '',
    transactionTime: null,
    settlementTime: null,
    providerPayload: null,
    expiresAt: new Date('2026-07-02T00:00:00.000Z'),
    createdAt: new Date('2026-07-01T00:00:00.000Z'),
    updatedAt: new Date('2026-07-01T00:00:00.000Z'),
  };

  const notification = {
    providerReference: 'PAY-202607-00001',
    providerTransactionId: 'midtrans-trx-4',
    internalStatus: 'FAILED',
    providerPayload: { transaction_status: 'deny' },
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

test('normalizes complete midtrans webhook audit fields', async () => {
  const provider = new MidtransProvider();
  const result = await provider.normalizeNotification({
    order_id: 'PAY-202607-00006',
    transaction_id: 'trx-123',
    transaction_status: 'settlement',
    status_code: '200',
    gross_amount: '508000.00',
    currency: 'IDR',
    payment_type: 'qris',
    issuer: 'linkaja',
    acquirer: 'gopay',
    fraud_status: 'accept',
    transaction_time: '2026-07-03 10:15:00 +0700',
    settlement_time: '2026-07-03 10:16:00 +0700',
    signature_key: 'signature',
  });

  assert.equal(result.providerReference, 'PAY-202607-00006');
  assert.equal(result.providerTransactionId, 'trx-123');
  assert.equal(result.internalStatus, 'PAID');
  assert.equal(result.grossAmount, 508000);
  assert.equal(result.currency, 'IDR');
  assert.equal(result.paymentType, 'qris');
  assert.equal(result.issuer, 'linkaja');
  assert.equal(result.acquirer, 'gopay');
  assert.equal(result.fraudStatus, 'accept');
  assert.ok(result.transactionTime instanceof Date);
  assert.ok(result.settlementTime instanceof Date);
  assert.equal(result.providerPayload.payment_type, 'qris');
});
