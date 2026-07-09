import test from 'node:test';
import assert from 'node:assert/strict';
import { generateCustomerCode } from '../lib/customer-auth/customer-number.js';

test('generates a unique public customer number using the OMC format', async () => {
  const lookups = [];
  const prismaClient = {
    customer: {
      findFirst: async ({ where }) => {
        lookups.push(where.customerCode);
        return null;
      },
    },
  };

  const customerCode = await generateCustomerCode(prismaClient);

  assert.match(customerCode, /^OMC-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{10}$/);
  assert.equal(lookups.length, 1);
  assert.equal(lookups[0], customerCode);
});

test('retries customer number generation on collisions', async () => {
  let callCount = 0;
  const prismaClient = {
    customer: {
      findFirst: async () => {
        callCount += 1;
        return callCount === 1 ? { id: 'existing-customer' } : null;
      },
    },
  };

  const customerCode = await generateCustomerCode(prismaClient);

  assert.match(customerCode, /^OMC-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{10}$/);
  assert.equal(callCount, 2);
});
