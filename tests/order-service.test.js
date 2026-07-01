import test from 'node:test';
import assert from 'node:assert/strict';
import { OrderService } from '../lib/order/service.js';
import { OrderError } from '../lib/order/errors.js';

function createOrderService({
  paymentAttemptStatus = 'PAID',
  existingOrder = null,
  checkoutMissing = false,
  paymentAttemptMissing = false,
} = {}) {
  const checkoutSession = {
    id: 'checkout-1',
    checkoutNumber: 'CHK-202607-00001',
    customer: {
      id: 'customer-1',
    },
    salesChannel: {
      id: 'channel-1',
    },
    currency: 'IDR',
    totals: {
      subtotal: 500000,
      discount: 0,
      shippingCost: 18000,
      tax: 0,
      grandTotal: 518000,
    },
    items: [
      {
        productId: 'product-1',
        variantId: 'variant-1',
        sku: 'OM-FIG-001',
        productName: 'Toonhub Figurine',
        variantName: 'Onyx / Default',
        productImage: 'https://example.com/product.png',
        price: 250000,
        weight: 500,
        quantity: 2,
        qty: 2,
        subtotal: 500000,
        currency: 'IDR',
      },
    ],
  };

  const paymentAttempt = paymentAttemptMissing
    ? null
    : {
        id: 'attempt-1',
        attemptNumber: 'PAY-202607-00001',
        checkoutSessionId: 'checkout-1',
        status: paymentAttemptStatus,
      };

  const store = {
    existingOrder,
  };

  const paymentAttemptService = {
    getPaymentAttemptById: async (paymentAttemptId) => {
      if (!paymentAttempt || paymentAttemptId !== paymentAttempt.id) {
        throw new OrderError({
          message: 'Payment attempt was not found.',
          statusCode: 404,
          code: 'PAYMENT_ATTEMPT_NOT_FOUND',
        });
      }

      return paymentAttempt;
    },
  };

  const checkoutService = {
    getCheckoutSessionById: async (checkoutSessionId) => {
      if (checkoutMissing || checkoutSessionId !== checkoutSession.id) {
        throw new OrderError({
          message: 'Checkout session was not found.',
          statusCode: 404,
          code: 'CHECKOUT_SESSION_NOT_FOUND',
        });
      }

      return checkoutSession;
    },
  };

  const prismaClient = {
    order: {
      findMany: async () => [],
      findFirst: async () => store.existingOrder,
      create: async ({ data }) => {
        const created = {
          ...data,
          createdAt: new Date('2026-07-01T00:00:00.000Z'),
          updatedAt: new Date('2026-07-01T00:00:00.000Z'),
          items: data.items.create,
        };
        store.existingOrder = created;
        return created;
      },
    },
  };

  const service = new OrderService({
    prismaClient,
    checkout: checkoutService,
    paymentAttempt: paymentAttemptService,
    idGenerator: () => 'generated-id',
    nowFactory: () => new Date('2026-07-01T00:00:00.000Z'),
  });

  return { service, store };
}

test('creates an order from a paid payment attempt', async () => {
  const { service } = createOrderService();
  const order = await service.createFromCheckoutSession({ paymentAttemptId: 'attempt-1' });

  assert.equal(order.paymentAttemptId, 'attempt-1');
  assert.equal(order.checkoutSessionId, 'checkout-1');
  assert.equal(order.status, 'READY_FOR_FULFILLMENT');
  assert.equal(order.grandTotal, 518000);
});

test('reuses the existing order for duplicate callbacks', async () => {
  const existingOrder = {
    id: 'order-1',
    orderNumber: 'ORD-202607-00001',
    checkoutSessionId: 'checkout-1',
    paymentAttemptId: 'attempt-1',
    customerId: 'customer-1',
    salesChannelId: 'channel-1',
    status: 'READY_FOR_FULFILLMENT',
    currency: 'IDR',
    subtotal: 500000,
    discount: 0,
    shippingCost: 18000,
    tax: 0,
    grandTotal: 518000,
    items: [],
    createdAt: new Date('2026-07-01T00:00:00.000Z'),
    updatedAt: new Date('2026-07-01T00:00:00.000Z'),
  };

  const { service } = createOrderService({ existingOrder });
  const order = await service.createFromCheckoutSession({ paymentAttemptId: 'attempt-1' });

  assert.equal(order.id, 'order-1');
  assert.equal(order.orderNumber, 'ORD-202607-00001');
});

test('copies immutable checkout item snapshots into order items', async () => {
  const { service } = createOrderService();
  const order = await service.createFromCheckoutSession({ paymentAttemptId: 'attempt-1' });

  assert.equal(order.items.length, 1);
  assert.equal(order.items[0].productName, 'Toonhub Figurine');
  assert.equal(order.items[0].variantName, 'Onyx / Default');
  assert.equal(order.items[0].productImage, 'https://example.com/product.png');
  assert.equal(order.items[0].weight, 500);
  assert.equal(order.items[0].quantity, 2);
  assert.equal(order.items[0].subtotal, 500000);
});

test('rejects invalid checkout sessions', async () => {
  const { service } = createOrderService({ checkoutMissing: true });

  await assert.rejects(
    service.createFromCheckoutSession({ paymentAttemptId: 'attempt-1' }),
    (error) => error.code === 'CHECKOUT_SESSION_NOT_FOUND',
  );
});

test('rejects invalid payment attempts', async () => {
  const { service } = createOrderService({ paymentAttemptMissing: true });

  await assert.rejects(
    service.createFromCheckoutSession({ paymentAttemptId: 'attempt-1' }),
    (error) => error.code === 'PAYMENT_ATTEMPT_NOT_FOUND',
  );
});

test('rejects payment attempts that are not paid', async () => {
  const { service } = createOrderService({ paymentAttemptStatus: 'PENDING' });

  await assert.rejects(
    service.createFromCheckoutSession({ paymentAttemptId: 'attempt-1' }),
    (error) => error.code === 'ORDER_PAYMENT_ATTEMPT_INVALID_STATUS',
  );
});
