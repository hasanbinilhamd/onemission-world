import test from 'node:test';
import assert from 'node:assert/strict';
import {
  INVENTORY_MOVEMENT_TYPE,
  INVENTORY_REFERENCE_TYPE,
  InventoryMovementService,
} from '../lib/inventory/movement-service.js';

function createService({ quantity = 10 } = {}) {
  const store = {
    inventory: {
      id: 'inventory-1',
      productId: 'product-1',
      color: 'Black',
      size: 'L',
      quantity,
      threshold: 5,
      incoming: 0,
      status: 'Active',
    },
    movements: [],
  };

  const prismaClient = {
    inventory: {
      findUnique: async ({ where }) => (where.id === store.inventory.id ? { ...store.inventory } : null),
      update: async ({ where, data }) => {
        if (where.id !== store.inventory.id) {
          throw new Error('Inventory item not found.');
        }

        store.inventory = {
          ...store.inventory,
          ...data,
        };

        return { ...store.inventory };
      },
    },
    stockMovement: {
      create: async ({ data }) => {
        const movement = {
          ...data,
          createdAt: new Date('2026-07-09T00:00:00.000Z'),
          updatedAt: new Date('2026-07-09T00:00:00.000Z'),
        };
        store.movements.push(movement);
        return movement;
      },
    },
    $transaction: async (callback) => callback(prismaClient),
  };

  const service = new InventoryMovementService({
    prismaClient,
    idGenerator: () => 'movement-1',
    nowFactory: () => new Date('2026-07-09T10:00:00.000Z'),
  });

  return { service, store };
}

test('creates a manual adjustment movement for +1 inventory changes', async () => {
  const { service, store } = createService({ quantity: 10 });

  const result = await service.updateInventoryQuantity({
    inventoryId: 'inventory-1',
    nextQuantity: 11,
    movementType: INVENTORY_MOVEMENT_TYPE.MANUAL_ADJUSTMENT,
    referenceType: INVENTORY_REFERENCE_TYPE.INVENTORY,
    referenceId: 'inventory-1',
    referenceNumber: 'SM-202607-00001',
    performedBy: 'admin@onemission.id',
    notes: 'Manual inventory adjustment',
  });

  assert.equal(result.inventory.quantity, 11);
  assert.equal(store.movements.length, 1);
  assert.equal(store.movements[0].movementType, 'MANUAL_ADJUSTMENT');
  assert.equal(store.movements[0].quantityChanged, 1);
  assert.equal(store.movements[0].previousQuantity, 10);
  assert.equal(store.movements[0].newQuantity, 11);
});

test('creates a manual adjustment movement for set quantity changes', async () => {
  const { service, store } = createService({ quantity: 10 });

  const result = await service.updateInventoryQuantity({
    inventoryId: 'inventory-1',
    nextQuantity: 4,
    movementType: INVENTORY_MOVEMENT_TYPE.MANUAL_ADJUSTMENT,
    referenceType: INVENTORY_REFERENCE_TYPE.INVENTORY,
    referenceId: 'inventory-1',
    referenceNumber: 'SM-202607-00002',
    performedBy: 'admin@onemission.id',
    notes: 'Manual inventory adjustment',
  });

  assert.equal(result.inventory.quantity, 4);
  assert.equal(store.movements.length, 1);
  assert.equal(store.movements[0].quantityChanged, 6);
  assert.equal(store.movements[0].previousQuantity, 10);
  assert.equal(store.movements[0].newQuantity, 4);
});

test('does not create a movement when quantity does not change', async () => {
  const { service, store } = createService({ quantity: 10 });

  const result = await service.updateInventoryQuantity({
    inventoryId: 'inventory-1',
    nextQuantity: 10,
    movementType: INVENTORY_MOVEMENT_TYPE.MANUAL_ADJUSTMENT,
    referenceType: INVENTORY_REFERENCE_TYPE.INVENTORY,
    referenceId: 'inventory-1',
    referenceNumber: 'SM-202607-00003',
    performedBy: 'admin@onemission.id',
    notes: 'Manual inventory adjustment',
  });

  assert.equal(result.inventory.quantity, 10);
  assert.equal(result.movement, null);
  assert.equal(store.movements.length, 0);
});

test('rejects negative inventory changes', async () => {
  const { service } = createService({ quantity: 10 });

  await assert.rejects(
    service.updateInventoryQuantity({
      inventoryId: 'inventory-1',
      nextQuantity: -1,
      movementType: INVENTORY_MOVEMENT_TYPE.MANUAL_ADJUSTMENT,
    }),
    /cannot be negative/i,
  );
});
