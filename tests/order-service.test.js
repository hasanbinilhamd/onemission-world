import test from 'node:test';
import assert from 'node:assert/strict';
import { OrderService } from '../lib/order/service.js';
import { OrderError } from '../lib/order/errors.js';

function createExistingOrder({
  fulfillmentStatus = 'PENDING',
  timelines = [],
} = {}) {
  return {
    id: 'order-1',
    orderNumber: 'ORD-202607-00001',
    checkoutSessionId: 'checkout-1',
    paymentAttemptId: 'attempt-1',
    paymentReference: 'PAY-202607-00001',
    customerId: 'customer-1',
    customerCode: 'CUS-0001',
    customerName: 'John Doe',
    customerEmail: 'john@example.com',
    customerPhone: '+628123456789',
    salesChannelId: 'channel-1',
    salesChannelCode: 'SC-0001',
    salesChannelName: 'Website',
    recipientName: 'John Doe',
    recipientPhone: '+628123456789',
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
    status: 'READY_FOR_FULFILLMENT',
    fulfillmentStatus,
    shipmentCourier: '',
    shipmentService: '',
    trackingNumber: '',
    shippingDate: null,
    currency: 'IDR',
    subtotal: 500000,
    discount: 0,
    shippingCost: 18000,
    tax: 0,
    grandTotal: 518000,
    paymentAttempt: {
      id: 'attempt-1',
      attemptNumber: 'PAY-202607-00001',
      provider: 'MIDTRANS',
      providerReference: 'PAY-202607-00001',
      providerTransactionId: 'midtrans-trx-1',
      paymentType: 'qris',
      issuer: 'linkaja',
      acquirer: 'gopay',
      transactionTime: new Date('2026-07-01T01:00:00.000Z'),
      settlementTime: new Date('2026-07-01T01:05:00.000Z'),
      grossAmount: 518000,
      currency: 'IDR',
      status: 'PAID',
    },
    items: [
      {
        id: 'item-1',
        orderId: 'order-1',
        productId: 'product-1',
        variantId: 'variant-1',
        sku: 'OM-FIG-001',
        productName: 'Toonhub Figurine',
        variantName: 'Onyx / Default',
        productImage: 'https://example.com/product.png',
        price: 250000,
        weight: 500,
        quantity: 2,
        subtotal: 500000,
        currency: 'IDR',
      },
    ],
    timelines,
    createdAt: new Date('2026-07-01T00:00:00.000Z'),
    updatedAt: new Date('2026-07-01T00:00:00.000Z'),
    _count: { items: 1 },
  };
}

function createOrderService({
  paymentAttemptStatus = 'PAID',
  existingOrder = null,
  checkoutMissing = false,
  paymentAttemptMissing = false,
  inventoryQuantity = 20,
  listOrders = null,
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
        provider: 'MIDTRANS',
        providerTransactionId: 'midtrans-trx-1',
        paymentType: 'qris',
        issuer: 'linkaja',
        acquirer: 'gopay',
        transactionTime: new Date('2026-07-01T01:00:00.000Z'),
        settlementTime: new Date('2026-07-01T01:05:00.000Z'),
        grossAmount: 518000,
        currency: 'IDR',
        status: paymentAttemptStatus,
      };

  const store = {
    existingOrder,
    orders: listOrders || (existingOrder ? [existingOrder] : []),
    inventory: {
      id: 'variant-1',
      quantity: inventoryQuantity,
      status: 'Active',
    },
    publishedEvents: [],
    timelineCreateCalls: [],
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
      count: async ({ where } = {}) => {
        if (!where?.OR?.length) {
          return store.orders.length;
        }

        return store.orders.filter((order) => where.OR.some((entry) => {
          if (entry.orderNumber?.contains) {
            return order.orderNumber.includes(entry.orderNumber.contains);
          }
          if (entry.customerName?.contains) {
            return order.customerName.includes(entry.customerName.contains);
          }
          if (entry.customerEmail?.contains) {
            return order.customerEmail.includes(entry.customerEmail.contains);
          }
          if (entry.customerPhone?.contains) {
            return order.customerPhone.includes(entry.customerPhone.contains);
          }
          if (entry.paymentReference?.contains) {
            return order.paymentReference.includes(entry.paymentReference.contains);
          }
          if (entry.trackingNumber?.contains) {
            return order.trackingNumber.includes(entry.trackingNumber.contains);
          }
          return false;
        })).length;
      },
      findMany: async ({ select, skip = 0, take = store.orders.length } = {}) => {
        if (select?.orderNumber) {
          return store.orders.map((order) => ({ orderNumber: order.orderNumber }));
        }

        return store.orders.slice(skip, skip + take);
      },
      findFirst: async ({ where } = {}) => {
        if (!store.existingOrder || !where?.OR) {
          return store.existingOrder;
        }

        return where.OR.some((entry) => entry.paymentAttemptId === store.existingOrder.paymentAttemptId || entry.checkoutSessionId === store.existingOrder.checkoutSessionId)
          ? store.existingOrder
          : null;
      },
      findUnique: async ({ where }) => store.orders.find((order) => order.id === where.id) || null,
      create: async ({ data }) => {
        const created = {
          ...createExistingOrder({ fulfillmentStatus: data.fulfillmentStatus || 'PENDING' }),
          ...data,
          paymentAttempt: createExistingOrder().paymentAttempt,
          createdAt: new Date('2026-07-01T00:00:00.000Z'),
          updatedAt: new Date('2026-07-01T00:00:00.000Z'),
          items: data.items.create,
          timelines: data.timelines.create.map((entry) => ({
            ...entry,
            createdAt: entry.createdAt || new Date('2026-07-01T00:00:00.000Z'),
          })),
          _count: { items: data.items.create.length },
        };
        store.existingOrder = created;
        store.orders = [created, ...store.orders.filter((order) => order.id !== created.id)];
        return created;
      },
      update: async ({ where, data }) => {
        const existing = store.orders.find((order) => order.id === where.id);
        if (!existing) {
          throw new Error('Order not found');
        }

        const updated = {
          ...existing,
          ...data,
          updatedAt: new Date('2026-07-01T00:10:00.000Z'),
        };
        store.existingOrder = updated;
        store.orders = store.orders.map((order) => (order.id === updated.id ? updated : order));
        return updated;
      },
    },
    orderTimeline: {
      createMany: async ({ data }) => {
        store.timelineCreateCalls.push(...data);
        if (store.existingOrder) {
          store.existingOrder.timelines = [...(store.existingOrder.timelines || []), ...data.map((entry) => ({
            ...entry,
            createdAt: entry.createdAt || new Date('2026-07-01T00:15:00.000Z'),
          }))];
          store.orders = store.orders.map((order) => (order.id === store.existingOrder.id ? store.existingOrder : order));
        }
        return { count: data.length };
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
  assert.equal(order.fulfillmentStatus, 'PENDING');
  assert.equal(order.grandTotal, 518000);
  assert.equal(order.timeline.length, 2);
  assert.equal(order.timeline[0].eventName, 'Order Created');
  assert.equal(order.timeline[1].eventName, 'Payment Received');
});

test('reuses the existing order for duplicate callbacks', async () => {
  const existingOrder = createExistingOrder();
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

test('lists orders with payment and fulfillment summaries', async () => {
  const existingOrder = createExistingOrder();
  const { service } = createOrderService({ existingOrder, listOrders: [existingOrder] });
  const response = await service.listOrders({ page: 1, limit: 10, search: 'ORD-' });

  assert.equal(response.data.length, 1);
  assert.equal(response.data[0].paymentStatus, 'PAID');
  assert.equal(response.data[0].fulfillmentStatus, 'PENDING');
  assert.equal(response.data[0].totalItems, 1);
});

test('returns detailed order information with payment data', async () => {
  const existingOrder = createExistingOrder({
    timelines: [{
      id: 'timeline-1',
      eventName: 'Order Created',
      updatedBy: 'System',
      notes: 'Created automatically.',
      createdAt: new Date('2026-07-01T00:00:00.000Z'),
    }],
  });
  const { service } = createOrderService({ existingOrder, listOrders: [existingOrder] });
  const order = await service.getOrderById('order-1');

  assert.equal(order.customerName, 'John Doe');
  assert.equal(order.shipping.recipientName, 'John Doe');
  assert.equal(order.payment.attemptNumber, 'PAY-202607-00001');
  assert.equal(order.payment.paymentMethod, 'qris');
  assert.equal(order.timeline.length, 1);
});

test('updates fulfillment status with a valid transition', async () => {
  const existingOrder = createExistingOrder();
  const { service } = createOrderService({ existingOrder, listOrders: [existingOrder] });
  const order = await service.updateFulfillmentStatus({
    orderId: 'order-1',
    fulfillmentStatus: 'PROCESSING',
    updatedBy: 'Warehouse Admin',
    notes: 'Started processing.',
  });

  assert.equal(order.fulfillmentStatus, 'PROCESSING');
  assert.equal(order.fulfillmentStatusLabel, 'PROCESSING');
  assert.equal(order.timeline[order.timeline.length - 1].eventName, 'Processing');
  assert.equal(order.timeline[order.timeline.length - 1].updatedBy, 'Warehouse Admin');
});

test('stores shipment information when the order is shipped', async () => {
  const existingOrder = createExistingOrder({ fulfillmentStatus: 'PACKED' });
  const { service } = createOrderService({ existingOrder, listOrders: [existingOrder] });
  const order = await service.updateFulfillmentStatus({
    orderId: 'order-1',
    fulfillmentStatus: 'SHIPPED',
    updatedBy: 'Warehouse Admin',
    shipmentCourier: 'JNE',
    shipmentService: 'REG',
    trackingNumber: 'JNE-123456789',
    shippingDate: '2026-07-02T10:00:00.000Z',
  });

  assert.equal(order.fulfillmentStatus, 'SHIPPED');
  assert.equal(order.shipment.courier, 'JNE');
  assert.equal(order.shipment.service, 'REG');
  assert.equal(order.shipment.trackingNumber, 'JNE-123456789');
});

test('rejects shipped transition without shipment information', async () => {
  const existingOrder = createExistingOrder({ fulfillmentStatus: 'PACKED' });
  const { service } = createOrderService({ existingOrder, listOrders: [existingOrder] });

  await assert.rejects(
    service.updateFulfillmentStatus({
      orderId: 'order-1',
      fulfillmentStatus: 'SHIPPED',
      updatedBy: 'Warehouse Admin',
    }),
    (error) => error.code === 'ORDER_SHIPMENT_INFORMATION_REQUIRED',
  );
});

test('rejects invalid fulfillment transitions', async () => {
  const existingOrder = createExistingOrder();
  const { service } = createOrderService({ existingOrder, listOrders: [existingOrder] });

  await assert.rejects(
    service.updateFulfillmentStatus({
      orderId: 'order-1',
      fulfillmentStatus: 'COMPLETED',
      updatedBy: 'Warehouse Admin',
    }),
    (error) => error.code === 'ORDER_FULFILLMENT_TRANSITION_INVALID',
  );
});

test('maps pending fulfillment status to ready for fulfillment label', async () => {
  const existingOrder = createExistingOrder({ fulfillmentStatus: 'PENDING' });
  const { service } = createOrderService({ existingOrder, listOrders: [existingOrder] });
  const order = await service.getOrderById('order-1');

  assert.equal(order.fulfillmentStatus, 'PENDING');
  assert.equal(order.fulfillmentStatusLabel, 'READY_FOR_FULFILLMENT');
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
