import test from 'node:test';
import assert from 'node:assert/strict';
import { OrderService } from '../lib/order/service.js';
import { OrderError } from '../lib/order/errors.js';

function createExistingOrder({
  status = 'READY_FOR_FULFILLMENT',
  publicOrderNumber = 'OM-H8LPW-XZ99F',
  fulfillmentStatus = 'PENDING',
  shipmentCourier = '',
  shipmentService = '',
  trackingNumber = '',
  shippingDate = null,
  timelines = [],
} = {}) {
  return {
    id: 'order-1',
    orderNumber: 'ORD-202607-00001',
    publicOrderNumber,
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
    status,
    fulfillmentStatus,
    shipmentCourier,
    shipmentService,
    trackingNumber,
    shippingDate,
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
  inventoryReservationError = null,
  inventoryReserved = existingOrder ? true : false,
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
    stockMovements: [],
    sentOrderEmails: [],
  };

  if (inventoryReserved && existingOrder?.items?.length) {
    store.stockMovements = existingOrder.items.map((item) => ({
      id: `order-reservation-${existingOrder.id}-${item.id}`,
      inventoryId: item.variantId,
      productId: item.productId,
      referenceType: 'ORDER',
      referenceId: existingOrder.id,
      referenceNumber: existingOrder.publicOrderNumber,
      performedBy: 'SYSTEM',
      movementType: 'SALE',
    }));
  }

  const matchesStringFilter = (value, filter) => {
    const subject = String(value || '').toLowerCase();

    if (typeof filter === 'string') {
      return subject === filter.toLowerCase();
    }

    if (filter?.contains !== undefined) {
      return subject.includes(String(filter.contains || '').toLowerCase());
    }

    if (filter?.equals !== undefined) {
      return subject === String(filter.equals || '').toLowerCase();
    }

    return true;
  };

  const matchesOrderWhere = (order, where = {}) => {
    if (!where || Object.keys(where).length === 0) {
      return true;
    }

    if (Array.isArray(where.OR) && where.OR.length > 0 && !where.OR.some((entry) => matchesOrderWhere(order, entry))) {
      return false;
    }

    if (Array.isArray(where.AND) && where.AND.length > 0 && !where.AND.every((entry) => matchesOrderWhere(order, entry))) {
      return false;
    }

    if (where.orderNumber && !matchesStringFilter(order.orderNumber, where.orderNumber)) {
      return false;
    }

    if (where.publicOrderNumber && !matchesStringFilter(order.publicOrderNumber, where.publicOrderNumber)) {
      return false;
    }

    if (where.customerName && !matchesStringFilter(order.customerName, where.customerName)) {
      return false;
    }

    if (where.customerEmail && !matchesStringFilter(order.customerEmail, where.customerEmail)) {
      return false;
    }

    if (where.trackingNumber && !matchesStringFilter(order.trackingNumber, where.trackingNumber)) {
      return false;
    }

    if (where.shipmentCourier && !matchesStringFilter(order.shipmentCourier, where.shipmentCourier)) {
      return false;
    }

    if (where.courier && !matchesStringFilter(order.courier, where.courier)) {
      return false;
    }

    if (where.paymentAttemptId && order.paymentAttemptId !== where.paymentAttemptId) {
      return false;
    }

    if (where.checkoutSessionId && order.checkoutSessionId !== where.checkoutSessionId) {
      return false;
    }

    if (where.fulfillmentStatus && order.fulfillmentStatus !== where.fulfillmentStatus) {
      return false;
    }

    if (where.paymentAttempt?.status && order.paymentAttempt?.status !== where.paymentAttempt.status) {
      return false;
    }

    if (where.createdAt?.gte && new Date(order.createdAt).getTime() < new Date(where.createdAt.gte).getTime()) {
      return false;
    }

    if (where.createdAt?.lte && new Date(order.createdAt).getTime() > new Date(where.createdAt.lte).getTime()) {
      return false;
    }

    return true;
  };

  const sortOrders = (orders, orderBy = {}) => {
    const [[field, direction]] = Object.entries(orderBy);
    if (!field) {
      return orders;
    }

    const modifier = direction === 'asc' ? 1 : -1;

    return [...orders].sort((left, right) => {
      const leftValue = left[field];
      const rightValue = right[field];

      if (leftValue instanceof Date || rightValue instanceof Date) {
        return (new Date(leftValue).getTime() - new Date(rightValue).getTime()) * modifier;
      }

      if (typeof leftValue === 'number' || typeof rightValue === 'number') {
        return (Number(leftValue || 0) - Number(rightValue || 0)) * modifier;
      }

      return String(leftValue || '').localeCompare(String(rightValue || '')) * modifier;
    });
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
      count: async ({ where } = {}) => store.orders.filter((order) => matchesOrderWhere(order, where)).length,
      findMany: async ({ where, select, skip = 0, take = store.orders.length, orderBy } = {}) => {
        const filteredOrders = sortOrders(
          store.orders.filter((order) => matchesOrderWhere(order, where)),
          orderBy,
        );

        if (select?.orderNumber) {
          return filteredOrders.map((order) => ({ orderNumber: order.orderNumber }));
        }

        return filteredOrders.slice(skip, skip + take);
      },
      findFirst: async ({ where } = {}) => store.orders.find((order) => matchesOrderWhere(order, where)) || null,
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
    stockMovement: {
      findUnique: ({ where }) => Promise.resolve(store.stockMovements.find((movement) => movement.id === where.id) || null),
      create: ({ data }) => Promise.resolve().then(() => {
        if (inventoryReservationError) {
          throw inventoryReservationError;
        }

        const created = {
          ...data,
          createdAt: new Date('2026-07-01T00:20:00.000Z'),
          updatedAt: new Date('2026-07-01T00:20:00.000Z'),
        };
        store.stockMovements.push(created);
        return created;
      }),
    },
    inventory: {
      findUnique: ({ where }) => Promise.resolve(where.id === store.inventory.id ? { ...store.inventory } : null),
      update: ({ where, data }) => Promise.resolve().then(() => {
        if (where.id !== store.inventory.id) {
          throw new Error('Inventory not found');
        }

        if (inventoryReservationError) {
          throw inventoryReservationError;
        }

        store.inventory.quantity = data.quantity;
        return { ...store.inventory };
      }),
    },
    $transaction: async (input) => {
      if (Array.isArray(input)) {
        return Promise.all(input);
      }

      return input(prismaClient);
    },
  };

  const eventPublisher = {
    publish: async (eventName, payload) => {
      store.publishedEvents.push({ eventName, payload });
    },
  };

  const emailPublisher = {
    sendOrderConfirmationEmail: async ({ order }) => {
      store.sentOrderEmails.push({
        orderId: order.id,
        orderNumber: order.orderNumber,
        publicOrderNumber: order.publicOrderNumber,
        customerEmail: order.customerEmail,
      });
      return { skipped: false };
    },
  };

  const service = new OrderService({
    prismaClient,
    paymentAttempt: paymentAttemptService,
    eventPublisher,
    orderEmail: emailPublisher,
    idGenerator: () => 'generated-id',
    nowFactory: () => new Date('2026-07-01T00:00:00.000Z'),
  });

  return { service, store };
}

test('creates an order from a paid payment attempt', async () => {
  const { service, store } = createOrderService();
  const order = await service.createFromCheckoutSession({ paymentAttemptId: 'attempt-1' });

  assert.equal(order.paymentAttemptId, 'attempt-1');
  assert.equal(order.checkoutSessionId, 'checkout-1');
  assert.match(order.publicOrderNumber, /^OM-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{5}-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{5}$/);
  assert.equal(order.status, 'READY_FOR_FULFILLMENT');
  assert.equal(order.fulfillmentStatus, 'PENDING');
  assert.equal(order.grandTotal, 518000);
  assert.equal(order.timeline.length, 2);
  assert.equal(order.timeline[0].eventName, 'Order Created');
  assert.equal(order.timeline[1].eventName, 'Payment Received');
  assert.equal(store.sentOrderEmails.length, 1);
  assert.equal(store.sentOrderEmails[0].publicOrderNumber, order.publicOrderNumber);
});

test('reuses the existing order for duplicate callbacks', async () => {
  const existingOrder = createExistingOrder();
  const { service, store } = createOrderService({ existingOrder });
  const order = await service.createFromCheckoutSession({ paymentAttemptId: 'attempt-1' });

  assert.equal(order.id, 'order-1');
  assert.equal(order.orderNumber, 'ORD-202607-00001');
  assert.equal(order.publicOrderNumber, 'OM-H8LPW-XZ99F');
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

test('creates inventory stock movements during reservation', async () => {
  const { service, store } = createOrderService();
  const order = await service.createFromCheckoutSession({ paymentAttemptId: 'attempt-1' });

  assert.equal(store.stockMovements.length, 1);
  assert.equal(store.stockMovements[0].movementType, 'SALE');
  assert.equal(store.stockMovements[0].referenceType, 'ORDER');
  assert.equal(store.stockMovements[0].referenceId, 'generated-id');
  assert.equal(store.stockMovements[0].referenceNumber, order.publicOrderNumber);
  assert.equal(store.stockMovements[0].performedBy, 'SYSTEM');
  assert.equal(store.stockMovements[0].quantityChanged, 2);
});

test('keeps the paid order when inventory reservation fails and allows retry', async () => {
  const initial = createOrderService({
    inventoryReservationError: new Error('Transaction already closed'),
    inventoryReserved: false,
  });

  await assert.rejects(
    initial.service.createFromCheckoutSession({ paymentAttemptId: 'attempt-1' }),
    (error) => error.code === 'ORDER_INVENTORY_RESERVATION_RETRY_REQUIRED',
  );

  assert.equal(initial.store.existingOrder?.orderNumber, 'ORD-202607-00001');
  assert.equal(initial.store.inventory.quantity, 20);
  assert.equal(initial.store.stockMovements.length, 0);

  const retry = createOrderService({
    existingOrder: initial.store.existingOrder,
    listOrders: [initial.store.existingOrder],
    inventoryReserved: false,
  });
  const recoveredOrder = await retry.service.createFromCheckoutSession({ paymentAttemptId: 'attempt-1' });

  assert.equal(recoveredOrder.orderNumber, 'ORD-202607-00001');
  assert.equal(recoveredOrder.__meta.action, 'FOUND');
  assert.equal(recoveredOrder.__meta.inventoryCommitted, true);
  assert.equal(retry.store.inventory.quantity, 18);
  assert.equal(retry.store.stockMovements.length, 1);
});

test('lists orders with payment and fulfillment summaries', async () => {
  const existingOrder = createExistingOrder();
  const { service } = createOrderService({ existingOrder, listOrders: [existingOrder] });
  const response = await service.listOrders({ page: 1, limit: 10, search: 'ORD-' });

  assert.equal(response.data.length, 1);
  assert.equal(response.data[0].paymentStatus, 'PAID');
  assert.equal(response.data[0].publicOrderNumber, 'OM-H8LPW-XZ99F');
  assert.equal(response.data[0].status, 'READY_FOR_FULFILLMENT');
  assert.equal(response.data[0].fulfillmentStatus, 'PENDING');
  assert.equal(response.data[0].totalItems, 1);
  assert.equal(response.summary.pending, 1);
  assert.equal(response.summary.picking, 0);
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
  assert.equal(order.publicOrderNumber, 'OM-H8LPW-XZ99F');
  assert.equal(order.status, 'READY_FOR_FULFILLMENT');
  assert.equal(order.timeline.length, 1);
});

test('lists customer orders using exact customer email matching', async () => {
  const newestOrder = createExistingOrder();
  const olderOrder = {
    ...createExistingOrder(),
    id: 'order-2',
    orderNumber: 'ORD-202606-00002',
    publicOrderNumber: 'OM-PLM8Q-ZX7TR',
    createdAt: new Date('2026-06-20T00:00:00.000Z'),
    updatedAt: new Date('2026-06-20T00:00:00.000Z'),
  };
  const otherCustomerOrder = {
    ...createExistingOrder(),
    id: 'order-3',
    orderNumber: 'ORD-202606-00003',
    publicOrderNumber: 'OM-RTY74-QW8ZX',
    customerEmail: 'other@example.com',
    createdAt: new Date('2026-06-10T00:00:00.000Z'),
    updatedAt: new Date('2026-06-10T00:00:00.000Z'),
  };

  const { service } = createOrderService({
    existingOrder: newestOrder,
    listOrders: [olderOrder, newestOrder, otherCustomerOrder],
  });

  const response = await service.listOrdersByCustomerEmail({
    email: 'JOHN@EXAMPLE.COM',
    page: 1,
    limit: 10,
  });

  assert.equal(response.data.length, 2);
  assert.equal(response.data[0].orderNumber, 'ORD-202607-00001');
  assert.equal(response.data[0].publicOrderNumber, 'OM-H8LPW-XZ99F');
  assert.equal(response.data[1].orderNumber, 'ORD-202606-00002');
  assert.equal(response.pagination.totalItems, 2);
  assert.equal(response.filters.email, 'john@example.com');
});

test('supports searching orders by public order number in HQ', async () => {
  const existingOrder = createExistingOrder();
  const { service } = createOrderService({ existingOrder, listOrders: [existingOrder] });
  const response = await service.listOrders({ page: 1, limit: 10, search: 'OM-H8LPW' });

  assert.equal(response.data.length, 1);
  assert.equal(response.data[0].publicOrderNumber, 'OM-H8LPW-XZ99F');
});

test('retrieves an order by public order number', async () => {
  const existingOrder = createExistingOrder();
  const { service } = createOrderService({ existingOrder, listOrders: [existingOrder] });
  const order = await service.getOrderByNumber('om-h8lpw-xz99f');

  assert.equal(order.orderNumber, 'ORD-202607-00001');
  assert.equal(order.publicOrderNumber, 'OM-H8LPW-XZ99F');
  assert.equal(order.payment.attemptNumber, 'PAY-202607-00001');
  assert.equal(order.items.length, 1);
});

test('tracks an order only when email and order number both match', async () => {
  const existingOrder = createExistingOrder();
  const { service } = createOrderService({ existingOrder, listOrders: [existingOrder] });
  const order = await service.trackOrder({
    email: 'john@example.com',
    orderNumber: 'OM-H8LPW-XZ99F',
  });

  assert.equal(order.orderNumber, 'ORD-202607-00001');
  assert.equal(order.publicOrderNumber, 'OM-H8LPW-XZ99F');

  await assert.rejects(
    service.trackOrder({
      email: 'other@example.com',
      orderNumber: 'OM-H8LPW-XZ99F',
    }),
    (error) => error.code === 'ORDER_NOT_FOUND',
  );
});

test('updates fulfillment status with a valid transition and synchronizes the business status', async () => {
  const existingOrder = createExistingOrder();
  const { service } = createOrderService({ existingOrder, listOrders: [existingOrder] });
  const order = await service.updateFulfillmentStatus({
    orderId: 'order-1',
    fulfillmentStatus: 'PICKING',
    updatedBy: 'Warehouse Admin',
    notes: 'Started picking.',
  });

  assert.equal(order.fulfillmentStatus, 'PICKING');
  assert.equal(order.fulfillmentStatusLabel, 'PICKING');
  assert.equal(order.status, 'PROCESSING');
  assert.equal(order.timeline.length, 2);
  assert.equal(order.timeline[0].eventName, 'PICKING_STARTED');
  assert.equal(order.timeline[0].updatedBy, 'Warehouse Admin');
  assert.equal(order.timeline[1].eventName, 'ORDER_STATUS_PROCESSING');
});

test('keeps the business status in processing while warehouse packing advances', async () => {
  const existingOrder = createExistingOrder({
    status: 'PROCESSING',
    fulfillmentStatus: 'PICKING',
  });
  const { service } = createOrderService({ existingOrder, listOrders: [existingOrder] });
  const order = await service.updateFulfillmentStatus({
    orderId: 'order-1',
    fulfillmentStatus: 'PACKING',
    updatedBy: 'Warehouse Admin',
    notes: 'Packing items now.',
  });

  assert.equal(order.fulfillmentStatus, 'PACKING');
  assert.equal(order.status, 'PROCESSING');
  assert.equal(order.timeline.length, 1);
  assert.equal(order.timeline[0].eventName, 'PACKING_STARTED');
});

test('stores shipment information when the order is shipped', async () => {
  const existingOrder = createExistingOrder({
    status: 'PROCESSING',
    fulfillmentStatus: 'READY_TO_SHIP',
  });
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
  assert.equal(order.status, 'SHIPPED');
  assert.equal(order.shipment.courier, 'JNE');
  assert.equal(order.shipment.service, 'REG');
  assert.equal(order.shipment.trackingNumber, 'JNE-123456789');
  assert.equal(order.timeline[0].eventName, 'ORDER_SHIPPED');
  assert.equal(order.timeline[1].eventName, 'ORDER_STATUS_SHIPPED');
});

test('synchronizes the business status to completed when the order is delivered', async () => {
  const existingOrder = createExistingOrder({
    status: 'SHIPPED',
    fulfillmentStatus: 'SHIPPED',
    shipmentCourier: 'JNE',
    shipmentService: 'REG',
    trackingNumber: 'JNE-123456789',
    shippingDate: new Date('2026-07-02T10:00:00.000Z'),
  });
  const { service } = createOrderService({ existingOrder, listOrders: [existingOrder] });
  const order = await service.updateFulfillmentStatus({
    orderId: 'order-1',
    fulfillmentStatus: 'DELIVERED',
    updatedBy: 'Warehouse Admin',
    notes: 'Delivered to customer.',
  });

  assert.equal(order.fulfillmentStatus, 'DELIVERED');
  assert.equal(order.status, 'COMPLETED');
  assert.equal(order.timeline[0].eventName, 'ORDER_DELIVERED');
  assert.equal(order.timeline[1].eventName, 'ORDER_STATUS_COMPLETED');
});

test('rejects shipped transition without shipment information', async () => {
  const existingOrder = createExistingOrder({
    status: 'PROCESSING',
    fulfillmentStatus: 'READY_TO_SHIP',
  });
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
      fulfillmentStatus: 'DELIVERED',
      updatedBy: 'Warehouse Admin',
    }),
    (error) => error.code === 'ORDER_FULFILLMENT_TRANSITION_INVALID',
  );
});

test('normalizes legacy fulfillment statuses into the new warehouse lifecycle', async () => {
  const existingOrder = createExistingOrder({
    fulfillmentStatus: 'PACKED',
  });
  const { service } = createOrderService({ existingOrder, listOrders: [existingOrder] });
  const order = await service.getOrderById('order-1');

  assert.equal(order.fulfillmentStatus, 'READY_TO_SHIP');
  assert.equal(order.fulfillmentStatusLabel, 'READY_TO_SHIP');
  assert.equal(order.status, 'PROCESSING');
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
