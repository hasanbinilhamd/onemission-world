import { v4 as uuid } from 'uuid';
import { prisma } from '@/lib/prisma';

export const INVENTORY_MOVEMENT_TYPE = {
  SALE: 'SALE',
  MANUAL_ADJUSTMENT: 'MANUAL_ADJUSTMENT',
  INITIAL_STOCK: 'INITIAL_STOCK',
  PURCHASE_RECEIPT: 'PURCHASE_RECEIPT',
  RETURN: 'RETURN',
  DAMAGED: 'DAMAGED',
  RESERVED: 'RESERVED',
  RELEASED: 'RELEASED',
  STOCK_OPNAME: 'STOCK_OPNAME',
  MANUAL_IN: 'MANUAL_IN',
  MANUAL_OUT: 'MANUAL_OUT',
  OPENING: 'OPENING',
  ADJUSTMENT_IN: 'ADJUSTMENT_IN',
  ADJUSTMENT_OUT: 'ADJUSTMENT_OUT',
  PRODUCTION_IN: 'PRODUCTION_IN',
  PRODUCTION_OUT: 'PRODUCTION_OUT',
  PRODUCTION_RESULT: 'PRODUCTION_RESULT',
};

export const INVENTORY_REFERENCE_TYPE = {
  ORDER: 'ORDER',
  INVENTORY: 'INVENTORY',
  MANUAL: 'MANUAL',
  PRODUCTION_ORDER: 'PRODUCTION_ORDER',
  SEED: 'SEED',
  RAW_MATERIAL: 'RAW_MATERIAL',
};

export const INVENTORY_PERFORMED_BY = {
  SYSTEM: 'SYSTEM',
};

function buildMovementDate(nowFactory) {
  return nowFactory().toISOString().split('T')[0];
}

function logInventoryMovementCreated({
  movementType = '',
  inventoryId = '',
  productId = '',
  quantityChanged = 0,
  previousQuantity = 0,
  newQuantity = 0,
  referenceType = '',
  referenceId = '',
  referenceNumber = '',
  performedBy = '',
}) {
  const payload = {
    eventName: 'INVENTORY_MOVEMENT_CREATED',
    movementType,
    inventoryId,
    productId,
    quantityChanged,
    previousQuantity,
    newQuantity,
    referenceType,
    referenceId,
    referenceNumber,
    performedBy,
    timestamp: new Date().toISOString(),
  };

  console.info('[InventoryMovementService]', payload);

  if (movementType === INVENTORY_MOVEMENT_TYPE.SALE) {
    console.info('[InventoryMovementService]', {
      ...payload,
      eventName: 'SALE_MOVEMENT_CREATED',
    });
  }

  if (movementType === INVENTORY_MOVEMENT_TYPE.MANUAL_ADJUSTMENT) {
    console.info('[InventoryMovementService]', {
      ...payload,
      eventName: 'MANUAL_ADJUSTMENT_CREATED',
    });
  }
}

function normalizeInteger(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Math.trunc(parsed);
}

export class InventoryMovementService {
  constructor({
    prismaClient = prisma,
    idGenerator = uuid,
    nowFactory = () => new Date(),
  } = {}) {
    this.prisma = prismaClient;
    this.idGenerator = idGenerator;
    this.nowFactory = nowFactory;
  }

  async updateInventoryQuantity({
    inventoryId,
    nextQuantity,
    movementType,
    referenceType = '',
    referenceId = '',
    referenceNumber = '',
    performedBy = INVENTORY_PERFORMED_BY.SYSTEM,
    notes = '',
    movementId = '',
    inventoryData = {},
  }) {
    if (!inventoryId) {
      throw new Error('Inventory item is required.');
    }

    const normalizedNextQuantity = normalizeInteger(nextQuantity);
    if (normalizedNextQuantity === null) {
      throw new Error('Inventory quantity is invalid.');
    }

    if (normalizedNextQuantity < 0) {
      throw new Error('Inventory quantity cannot be negative.');
    }

    return this.prisma.$transaction(async (tx) => {
      const inventory = await tx.inventory.findUnique({ where: { id: inventoryId } });
      if (!inventory) {
        throw new Error('Inventory item not found.');
      }

      const previousQuantity = normalizeInteger(inventory.quantity) || 0;
      const quantityChanged = Math.abs(normalizedNextQuantity - previousQuantity);
      const updateData = {
        ...inventoryData,
        quantity: normalizedNextQuantity,
      };

      if (quantityChanged === 0) {
        const updatedInventory = await tx.inventory.update({
          where: { id: inventoryId },
          data: updateData,
        });

        return {
          inventory: updatedInventory,
          movement: null,
          quantityChanged: 0,
        };
      }

      const updatedInventory = await tx.inventory.update({
        where: { id: inventoryId },
        data: updateData,
      });

      const movement = await tx.stockMovement.create({
        data: {
          id: movementId || this.idGenerator(),
          itemType: 'PRODUCT',
          inventoryId: inventory.id,
          productId: inventory.productId,
          color: inventory.color,
          size: inventory.size,
          movementDate: buildMovementDate(this.nowFactory),
          movementType,
          quantity: quantityChanged,
          quantityChanged,
          previousQuantity,
          newQuantity: normalizedNextQuantity,
          notes,
          referenceType,
          referenceId,
          referenceNumber,
          performedBy,
        },
      });

      logInventoryMovementCreated({
        movementType,
        inventoryId: inventory.id,
        productId: inventory.productId,
        quantityChanged,
        previousQuantity,
        newQuantity: normalizedNextQuantity,
        referenceType,
        referenceId,
        referenceNumber,
        performedBy,
      });

      return {
        inventory: updatedInventory,
        movement,
        quantityChanged,
      };
    });
  }
}

export const inventoryMovementService = new InventoryMovementService();
