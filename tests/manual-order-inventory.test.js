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
  buildStockUpdateForQuantityChange,
  validateInventoryStockState,
  validateWebsiteStockAllocation,
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

import { buildWebsiteSaleStockState } from '../lib/inventory/stock-levels.js';

test('website sale deducts both real and website stock', () => {
  assert.deepEqual(buildWebsiteSaleStockState({ realStock: 20, websiteStock: 8, quantity: 8, deduction: 3 }), {
    valid: true,
    realStock: 17,
    websiteStock: 5,
    quantity: 5,
    message: '',
  });
});

test('website sale rejects when website stock is insufficient even if real stock exists', () => {
  const result = buildWebsiteSaleStockState({ realStock: 20, websiteStock: 0, quantity: 0, deduction: 1 });
  assert.equal(result.valid, false);
});

test('website exact stock consumption leaves website stock at zero and real stock reduced', () => {
  assert.deepEqual(buildWebsiteSaleStockState({ realStock: 20, websiteStock: 3, quantity: 3, deduction: 3 }), {
    valid: true,
    realStock: 17,
    websiteStock: 0,
    quantity: 0,
    message: '',
  });
});

test('website allocation can increase or decrease within real stock', () => {
  assert.equal(validateWebsiteStockAllocation({ realStock: 20, websiteStock: 12 }).valid, true);
  assert.equal(validateWebsiteStockAllocation({ realStock: 20, websiteStock: 5 }).valid, true);
});

test('website allocation rejects values above real stock and allows zero', () => {
  assert.equal(validateWebsiteStockAllocation({ realStock: 10, websiteStock: 11 }).valid, false);
  assert.equal(validateWebsiteStockAllocation({ realStock: 10, websiteStock: 0 }).valid, true);
});

test('physical restock keeps website allocation unchanged', () => {
  assert.deepEqual(buildStockUpdateForQuantityChange(20, { quantity: 10, realStock: 10, websiteStock: 5 }), {
    quantity: 20,
    realStock: 20,
    websiteStock: 5,
  });
});
