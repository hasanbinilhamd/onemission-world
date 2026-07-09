import test from 'node:test';
import assert from 'node:assert/strict';
import { OrderService } from '../lib/order/service.js';

function createOrderRecord() {
  return {
    id: 'order-1',
    orderNumber: 'ORD-202607-00001',
    publicOrderNumber: 'OM-H8LPW-XZ99F',
    customerEmail: 'john@example.com',
    customerName: 'John Doe',
    shippingCost: 18000,
    grandTotal: 518000,
    streetAddress: 'Example Street 123',
    districtName: 'Coblong',
    cityName: 'Bandung',
    provinceName: 'Jawa Barat',
    postalCode: '40135',
    courier: 'jne',
    courierService: 'REG',
    createdAt: new Date('2026-07-08T10:00:00.000Z'),
    paymentAttempt: {
      status: 'PAID',
    },
    items: [
      {
        productName: 'Toonhub Figurine',
        variantName: 'Onyx / Default',
        quantity: 2,
        price: 250000,
        subtotal: 500000,
      },
    ],
    orderConfirmationEmailSentAt: null,
  };
}

test('marks order confirmation email as sent after successful delivery', async () => {
  const updates = [];
  const emailCalls = [];
  const service = new OrderService({
    prismaClient: {
      order: {
        update: async ({ where, data }) => {
          updates.push({ where, data });
          return { id: where.id, ...data };
        },
      },
    },
    paymentAttempt: {},
    eventPublisher: {},
    orderEmail: {
      sendOrderConfirmationEmail: async (input) => {
        emailCalls.push(input);
        return { skipped: false };
      },
    },
  });

  const order = createOrderRecord();
  const result = await service.sendOrderConfirmationEmailIfNeeded(order);

  assert.equal(result.status, 'SENT');
  assert.equal(emailCalls.length, 1);
  assert.equal(updates.length, 1);
  assert.equal(updates[0].where.id, 'order-1');
  assert.ok(order.orderConfirmationEmailSentAt instanceof Date);
});

test('never throws when order confirmation email delivery fails', async () => {
  const service = new OrderService({
    prismaClient: {
      order: {
        update: async () => {
          throw new Error('Update should not be called when email fails');
        },
      },
    },
    paymentAttempt: {},
    eventPublisher: {},
    orderEmail: {
      sendOrderConfirmationEmail: async () => {
        throw new Error('SMTP unavailable');
      },
    },
  });

  const result = await service.sendOrderConfirmationEmailIfNeeded(createOrderRecord());

  assert.equal(result.status, 'FAILED');
  assert.equal(result.reason, 'SMTP unavailable');
});

test('skips order confirmation email when it was already sent', async () => {
  const service = new OrderService({
    prismaClient: { order: { update: async () => ({}) } },
    paymentAttempt: {},
    eventPublisher: {},
    orderEmail: {
      sendOrderConfirmationEmail: async () => {
        throw new Error('Email should not be sent again');
      },
    },
  });

  const order = createOrderRecord();
  order.orderConfirmationEmailSentAt = new Date('2026-07-08T10:30:00.000Z');

  const result = await service.sendOrderConfirmationEmailIfNeeded(order);

  assert.equal(result.status, 'SKIPPED');
  assert.equal(result.reason, 'ALREADY_SENT');
});
