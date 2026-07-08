import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildInventoryVariantRows,
  ensureInventoryRowsForProduct,
  normalizeInventoryDimensionValues,
  repairAllProductInventoryRows,
} from '../lib/inventory/lifecycle.js';

test('normalizes inventory dimension values by trimming and removing duplicates', () => {
  const values = normalizeInventoryDimensionValues([' Black ', 'White', 'Black', '', null, 'White']);

  assert.deepEqual(values, ['Black', 'White']);
});

test('builds every color and size combination for a product', () => {
  const rows = buildInventoryVariantRows({
    productId: 'product-1',
    colors: ['Black', 'White'],
    sizes: ['S', 'M', 'L'],
  });

  assert.equal(rows.length, 6);
  assert.deepEqual(
    rows.map((row) => `${row.color}-${row.size}`),
    ['Black-S', 'Black-M', 'Black-L', 'White-S', 'White-M', 'White-L'],
  );
  assert.equal(rows[0].quantity, 0);
  assert.equal(rows[0].threshold, 5);
  assert.equal(rows[0].incoming, 0);
});

test('creates inventory rows with skipDuplicates when ensuring a product inventory lifecycle', async () => {
  const createManyCalls = [];
  const prismaClient = {
    inventory: {
      createMany: async (input) => {
        createManyCalls.push(input);
        return { count: 2 };
      },
    },
  };

  const result = await ensureInventoryRowsForProduct(prismaClient, {
    productId: 'product-1',
    colors: ['Black'],
    sizes: ['S', 'M'],
  });

  assert.equal(result.created, 2);
  assert.equal(result.totalCandidates, 2);
  assert.equal(createManyCalls.length, 1);
  assert.equal(createManyCalls[0].skipDuplicates, true);
  assert.equal(createManyCalls[0].data.length, 2);
});

test('repairs inventory rows idempotently across multiple products using skipDuplicates', async () => {
  const createManyCalls = [];
  const prismaClient = {
    inventory: {
      createMany: async (input) => {
        createManyCalls.push(input);
        return { count: 3 };
      },
    },
  };

  const result = await repairAllProductInventoryRows(prismaClient, {
    products: [
      { id: 'product-1', colors: ['Black'], sizes: ['S', 'M'] },
      { id: 'product-2', colors: ['White'], sizes: ['L'] },
    ],
  });

  assert.equal(result.created, 3);
  assert.equal(result.repaired, 2);
  assert.equal(result.totalCandidates, 3);
  assert.equal(createManyCalls.length, 1);
  assert.equal(createManyCalls[0].skipDuplicates, true);
});
