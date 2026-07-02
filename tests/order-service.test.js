import test from 'node:test';
import assert from 'node:assert/strict';
import { OrderService } from '../lib/order/service.js';
import { OrderError } from '../lib/order/errors.js';

function createOrderService({
  paymentAttemptStatus = 'PAID',
  existingOrder = null,
  checkoutMissing = false,
  paymentAttemptMissing = false,
  inventoryQuantity = 20,
} = {}) {
  const checkoutSession = {
    id: 'checkout-1',
    checkoutNumber: 'CHK-202607-00001',
    status: 'PAID',
    customerId: 'customer-1',
    customerCode: 'CUS-0001',
    customerName: 'John Doe',
    customerEmail: 'john@example.com',
    customerPhone: '+628123456789',
    salesChannelId: 'channel-1',
    salesChannelCode: 'SC-0001',
    salesChannelName: 'Website',
    recipientName: 'John Doe',
    phone: '+628123456789',
    originDistrict: '1391',
    destinationDistrict: '1376',
    courier: 'jne',
    courierService: 'REG',
    shippingDescription: 'JNE Regular Service',
    estimatedDelivery: '2-3 Days',
    provinceId: '9',
    provinceName: 'Jawa Barat',
    cityId: '23',
    cityName: 'Bandung',
    districtId: '1376',
    districtName: 'Coblong',
    postalCode: '40135',
    streetAddress: 'Example Street 123',
    currency: 'IDR',
    subtotal: 500000,
    discount: 0,
    shippingCost: 18000,
    tax: 0,
    grandTotal: 518000,
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
        providerReference: 'PAY-202607-00001',
        status: paymentAttemptStatus,
      };

  const store = {
    existingOrder,
    inventory: {
      id: 'variant-1',
      quantity: inventoryQuantity,
      status: 'Active',
    },
    publishedEvents: [],
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

  const prismaClient = {
    checkoutSession: {
      findUnique: async ({ where }) => {
        if (checkoutMissing || where.id !== checkoutSession.id) {
          return null;
        }

        return checkoutSession;
      },
    },
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
    inventory: {
      findUnique: async ({ where }) => (where.id === store.inventory.id ? { ...store.inventory } : null),
      update: async ({ where, data }) => {
        if (where.id !== store.inventory.id) {
          throw new Error('Inventory not found');
        }

        store.inventory.quantity = data.quantity;
        return { ...store.inventory };
      },
    },
    $transaction: async (callback) => callback(prismaClient),
  };

  const eventPublisher = {
    publish: async (eventName, payload) => {
      store.publishedEvents.push({ eventName, payload });
    },
  };

  const service = new OrderService({
    prismaClient,
    checkout: {},
    paymentAttempt: paymentAttemptService,
    eventPublisher,
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

  const { service, store } = createOrderService({ existingOrder });
  const order = await service.createFromCheckoutSession({ paymentAttemptId: 'attempt-1' });

  assert.equal(order.id, 'order-1');
  assert.equal(order.orderNumber, 'ORD-202607-00001');
  assert.equal(store.inventory.quantity, 20);
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

test('commits inventory exactly once during successful order creation', async () => {
  const { service, store } = createOrderService();
  await service.createFromCheckoutSession({ paymentAttemptId: 'attempt-1' });

  assert.equal(store.inventory.quantity, 18);
});

test('publishes order and inventory domain events', async () => {
  const { service, store } = createOrderService();
  await service.createFromCheckoutSession({ paymentAttemptId: 'attempt-1' });

  assert.equal(store.publishedEvents.length, 2);
  assert.equal(store.publishedEvents[0].eventName, 'OrderCreated');
  assert.equal(store.publishedEvents[1].eventName, 'InventoryCommitted');
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
