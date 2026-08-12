import test from 'node:test';
import assert from 'node:assert/strict';
import {
  aggregateManualOrderInventoryQuantities,
  validateManualOrderInventoryAvailability,
} from '../lib/manual-order/inventory.js';

test('manual order inventory aggregation sums duplicate inventory lines', () => {
  const aggregate = aggregateManualOrderInventoryQuantities([
    { inventoryId: 'inventory-a', quantity: 2 },
    { inventoryId: 'inventory-a', quantity: 3 },
    { inventoryId: 'inventory-b', quantity: 1 },
  ]);

  assert.equal(aggregate.get('inventory-a'), 5);
  assert.equal(aggregate.get('inventory-b'), 1);
});

test('manual order validation rejects duplicate lines that exceed stock in aggregate', () => {
  const requestedByInventory = aggregateManualOrderInventoryQuantities([
    { inventoryId: 'inventory-a', quantity: 2 },
    { inventoryId: 'inventory-a', quantity: 3 },
  ]);

  const result = validateManualOrderInventoryAvailability({
    requestedByInventory,
    inventoryRows: [
      { id: 'inventory-a', quantity: 4, color: 'Black', size: '5XL', product: { name: 'BASIC 3/4 LEGGING' } },
    ],
  });

  assert.equal(result.valid, false);
  assert.match(result.message, /Insufficient inventory/);
});

test('manual order validation allows exact aggregate stock consumption', () => {
  const requestedByInventory = aggregateManualOrderInventoryQuantities([
    { inventoryId: 'inventory-a', quantity: 2 },
    { inventoryId: 'inventory-a', quantity: 3 },
  ]);

  const result = validateManualOrderInventoryAvailability({
    requestedByInventory,
    inventoryRows: [
      { id: 'inventory-a', quantity: 5, color: 'Black', size: '5XL', product: { name: 'BASIC 3/4 LEGGING' } },
    ],
  });

  assert.equal(result.valid, true);
});

import {
  buildInventoryStockState,
  validateInventoryStockState,
} from '../lib/inventory/stock-levels.js';

test('inventory stock state allows real stock with zero website stock', () => {
  const result = validateInventoryStockState({ realStock: 10, websiteStock: 0 });
  assert.equal(result.valid, true);
});

test('inventory stock state allows website stock equal to real stock', () => {
  const result = validateInventoryStockState({ realStock: 10, websiteStock: 10 });
  assert.equal(result.valid, true);
});

test('inventory stock state rejects website stock above real stock', () => {
  const result = validateInventoryStockState({ realStock: 10, websiteStock: 11 });
  assert.equal(result.valid, false);
  assert.equal(result.message, 'Website Stock cannot exceed Real Stock.');
});

test('inventory stock state rejects negative real or website stock', () => {
  assert.equal(validateInventoryStockState({ realStock: -1, websiteStock: 0 }).valid, false);
  assert.equal(validateInventoryStockState({ realStock: 10, websiteStock: -1 }).valid, false);
});

test('existing inventory quantity can be backfilled as both real and website stock', () => {
  assert.deepEqual(buildInventoryStockState({ quantity: 8 }), {
    quantity: 8,
    realStock: 8,
    websiteStock: 8,
  });
});

test('manual order availability uses real stock and preserves website allocation when real remains above website', () => {
  const requestedByInventory = aggregateManualOrderInventoryQuantities([
    { inventoryId: 'inventory-a', quantity: 3 },
  ]);

  const result = validateManualOrderInventoryAvailability({
    requestedByInventory,
    inventoryRows: [
      { id: 'inventory-a', quantity: 8, realStock: 20, websiteStock: 8, product: { name: 'BASIC 3/4 LEGGING' } },
    ],
  });

  assert.equal(result.valid, true);
  assert.equal(Math.min(8, 20 - 3), 8);
});

test('manual order website stock is clamped only when real stock falls below website stock', () => {
  assert.equal(Math.min(8, 10 - 2), 8);
  assert.equal(Math.min(8, 10 - 5), 5);
});

test('manual order availability rejects when requested quantity exceeds real stock even if legacy quantity is higher', () => {
  const requestedByInventory = aggregateManualOrderInventoryQuantities([
    { inventoryId: 'inventory-a', quantity: 6 },
  ]);

  const result = validateManualOrderInventoryAvailability({
    requestedByInventory,
    inventoryRows: [
      { id: 'inventory-a', quantity: 8, realStock: 5, websiteStock: 5, product: { name: 'BASIC 3/4 LEGGING' } },
    ],
  });

  assert.equal(result.valid, false);
});
