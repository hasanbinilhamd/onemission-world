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
