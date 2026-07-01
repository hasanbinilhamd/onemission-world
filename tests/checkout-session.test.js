import test from 'node:test';
import assert from 'node:assert/strict';
import { CheckoutService } from '../lib/checkout/service.js';

function createCheckoutService({
  productStatus = 'Active',
  variantStatus = 'Active',
  variantQuantity = 10,
  shippingRates,
  expiresAt,
  sessionStatus = 'DRAFT',
  processingKey = null,
} = {}) {
  const customer = {
    id: 'customer-1',
    customerCode: 'CUS-0001',
    customerName: 'John Doe',
    email: 'john@example.com',
    phone: '+628123456789',
    status: 'Active',
  };

  const salesChannel = {
    id: 'channel-1',
    channelCode: 'SC-0001',
    channelName: 'Website',
    status: 'Active',
  };

  const product = {
    id: 'product-1',
    name: 'Toonhub Figurine',
    sku: 'OM-FIG-001',
    sellingPrice: 250000,
    status: productStatus,
    imageUrl: 'https://example.com/product.png',
  };

  const variant = {
    id: 'variant-1',
    productId: 'product-1',
    color: 'Onyx',
    size: 'Default',
    quantity: variantQuantity,
    status: variantStatus,
  };

  const sessionStore = {
    current: {
      id: 'checkout-1',
      checkoutNumber: 'CHK-202607-00001',
      status: sessionStatus,
      customerId: customer.id,
      customerCode: customer.customerCode,
      customerName: customer.customerName,
      customerEmail: customer.email,
      customerPhone: customer.phone,
      salesChannelId: salesChannel.id,
      salesChannelCode: salesChannel.channelCode,
      salesChannelName: salesChannel.channelName,
      currency: 'IDR',
      subtotal: 500000,
      shippingCost: 18000,
      discount: 0,
      tax: 0,
      grandTotal: 518000,
      recipientName: 'John Doe',
      phone: '+628123456789',
      originDistrict: '1391',
      destinationDistrict: '1376',
      courier: 'JNE',
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
      processingKey,
      processingStartedAt: processingKey ? new Date('2026-07-01T00:00:00.000Z') : null,
      expiresAt: expiresAt || new Date('2026-07-02T00:00:00.000Z'),
      createdAt: new Date('2026-07-01T00:00:00.000Z'),
      updatedAt: new Date('2026-07-01T00:00:00.000Z'),
      items: [{
        id: 'item-1',
        productId: 'product-1',
        variantId: 'variant-1',
        productName: 'Toonhub Figurine',
        variantName: 'Onyx / Default',
        productImage: 'https://example.com/product.png',
        weight: 500,
        sku: 'OM-FIG-001',
        qty: 2,
        price: 250000,
        currency: 'IDR',
        subtotal: 500000,
      }],
    },
    updateCalls: [],
  };

  const prismaClient = {
    customer: {
      findUnique: async ({ where }) => (where.id === customer.id ? customer : null),
    },
    salesChannel: {
      findUnique: async ({ where }) => (where.id === salesChannel.id ? salesChannel : null),
    },
    product: {
      findUnique: async ({ where }) => (where.id === product.id ? product : null),
    },
    inventory: {
      findUnique: async ({ where }) => (where.id === variant.id ? variant : null),
    },
    checkoutSession: {
      findMany: async () => [],
      create: async ({ data }) => ({
        ...data,
        createdAt: new Date('2026-07-01T00:00:00.000Z'),
        updatedAt: new Date('2026-07-01T00:00:00.000Z'),
        items: data.items.create,
      }),
      findUnique: async ({ where }) => (where.id === sessionStore.current?.id ? sessionStore.current : null),
      update: async ({ where, data }) => {
        sessionStore.updateCalls.push({ where, data });
        sessionStore.current = { ...sessionStore.current, ...data };
        return sessionStore.current;
      },
      updateMany: async ({ where, data }) => {
        if (
          sessionStore.current
          && where.id === sessionStore.current.id
          && sessionStore.current.status === where.status
          && sessionStore.current.processingKey === where.processingKey
        ) {
          sessionStore.current = { ...sessionStore.current, ...data };
          return { count: 1 };
        }

        return { count: 0 };
      },
    },
  };

  const shipping = {
    getProvinces: async () => [{ id: '9', name: 'Jawa Barat' }],
    getCities: async () => [{ id: '23', province_id: '9', name: 'Bandung', postal_code: '40111', type: 'Kota' }],
    getDistricts: async () => [{ id: '1376', city_id: '23', name: 'Coblong', postal_code: '40135' }],
    getShippingCost: async () => shippingRates || [{
      courier: 'JNE',
      service: 'REG',
      description: 'JNE Regular Service',
      estimated_delivery: '2-3 Days',
      cost: 18000,
    }],
  };

  const service = new CheckoutService({
    prismaClient,
    shipping,
    idGenerator: () => 'generated-id',
    nowFactory: () => new Date('2026-07-01T00:00:00.000Z'),
  });

  return { service, sessionStore };
}

const validPayload = {
  customerId: 'customer-1',
  salesChannelId: 'channel-1',
  currency: 'IDR',
  discount: 0,
  tax: 0,
  courier: 'jne',
  items: [
    {
      productId: 'product-1',
      variantId: 'variant-1',
      qty: 2,
      weight: 500,
    },
  ],
  shipping: {
    originDistrict: '1391',
    destinationDistrict: '1376',
    weight: 1000,
    cost: 18000,
    service: 'REG',
    description: 'JNE Regular Service',
    estimatedDelivery: '2-3 Days',
  },
  address: {
    recipientName: 'John Doe',
    phone: '+628123456789',
    provinceId: '9',
    cityId: '23',
    districtId: '1376',
    postalCode: '40135',
    streetAddress: 'Example Street 123',
  },
};

test('rejects inactive product during checkout validation', async () => {
  const { service } = createCheckoutService({ productStatus: 'Inactive' });

  await assert.rejects(
    service.createCheckoutSession(validPayload),
    (error) => error.code === 'CHECKOUT_PRODUCT_INACTIVE',
  );
});

test('rejects inactive variant during checkout validation', async () => {
  const { service } = createCheckoutService({ variantStatus: 'Inactive' });

  await assert.rejects(
    service.createCheckoutSession(validPayload),
    (error) => error.code === 'CHECKOUT_VARIANT_INACTIVE',
  );
});

test('rejects insufficient inventory during checkout validation', async () => {
  const { service } = createCheckoutService({ variantQuantity: 1 });

  await assert.rejects(
    service.createCheckoutSession(validPayload),
    (error) => error.code === 'CHECKOUT_INSUFFICIENT_INVENTORY',
  );
});

test('rejects invalid shipping during checkout validation', async () => {
  const { service } = createCheckoutService({
    shippingRates: [{
      courier: 'JNE',
      service: 'YES',
      description: 'JNE Yakin Esok Sampai',
      estimated_delivery: '1 Day',
      cost: 30000,
    }],
  });

  await assert.rejects(
    service.createCheckoutSession(validPayload),
    (error) => error.code === 'CHECKOUT_SHIPPING_RATE_INVALID',
  );
});

test('rejects expired checkout sessions during retrieval and payment preparation', async () => {
  const { service, sessionStore } = createCheckoutService({
    expiresAt: new Date('2026-06-30T00:00:00.000Z'),
  });

  await assert.rejects(
    service.getCheckoutSessionById('checkout-1'),
    (error) => error.code === 'CHECKOUT_SESSION_EXPIRED',
  );

  await assert.rejects(
    service.getCheckoutSessionForPayment('checkout-1'),
    (error) => error.code === 'CHECKOUT_SESSION_EXPIRED',
  );

  assert.equal(sessionStore.updateCalls[0].data.status, 'EXPIRED');
});

test('rejects invalid checkout status before continuing', async () => {
  const { service } = createCheckoutService({ sessionStatus: 'CANCELLED' });

  await assert.rejects(
    service.getCheckoutSessionForPayment('checkout-1'),
    (error) => error.code === 'CHECKOUT_INVALID_STATUS',
  );
});

test('prevents double processing and preserves idempotency', async () => {
  const { service } = createCheckoutService();

  const firstLock = await service.beginCheckoutProcessing('checkout-1', 'processing-key-1');
  assert.equal(firstLock.processingKey, 'processing-key-1');

  const repeatedLock = await service.beginCheckoutProcessing('checkout-1', 'processing-key-1');
  assert.equal(repeatedLock.processingKey, 'processing-key-1');

  await assert.rejects(
    service.beginCheckoutProcessing('checkout-1', 'processing-key-2'),
    (error) => error.code === 'CHECKOUT_ALREADY_PROCESSING',
  );
});

test('stores immutable product, shipping, and price snapshots', async () => {
  const { service } = createCheckoutService();
  const session = await service.createCheckoutSession(validPayload);

  assert.equal(session.items[0].productName, 'Toonhub Figurine');
  assert.equal(session.items[0].productImage, 'https://example.com/product.png');
  assert.equal(session.items[0].weight, 500);
  assert.equal(session.items[0].currency, 'IDR');
  assert.equal(session.items[0].quantity, 2);
  assert.equal(session.shipping.recipientName, 'John Doe');
  assert.equal(session.shipping.phone, '+628123456789');
  assert.equal(session.shipping.address.province, 'Jawa Barat');
  assert.equal(session.customer.customerName, 'John Doe');
  assert.equal(session.salesChannel.channelName, 'Website');
  assert.equal(session.totals.subtotal, 500000);
  assert.equal(session.totals.shipping, 18000);
  assert.equal(session.totals.grandTotal, 518000);
  assert.equal(session.currency, 'IDR');
});

test('returns immutable snapshots when retrieving checkout session', async () => {
  const { service } = createCheckoutService();
  const session = await service.getCheckoutSessionById('checkout-1');

  assert.equal(session.items[0].productName, 'Toonhub Figurine');
  assert.equal(session.items[0].price, 250000);
  assert.equal(session.shipping.address.streetAddress, 'Example Street 123');
  assert.equal(session.totals.shippingCost, 18000);
});
