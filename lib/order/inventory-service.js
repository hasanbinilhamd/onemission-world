import { v4 as uuid } from 'uuid';
import { prisma } from '@/lib/prisma';
import {
  INVENTORY_MOVEMENT_TYPE,
  INVENTORY_PERFORMED_BY,
  INVENTORY_REFERENCE_TYPE,
} from '@/lib/inventory/movement-service';
import { notificationService, NOTIFICATION_EVENT_TYPE } from '@/lib/notifications';
import { OrderError } from './errors';

export const ORDER_INVENTORY_RESERVATION_RESULT = {
  COMMITTED: 'COMMITTED',
  SKIPPED: 'SKIPPED',
};

const ORDER_INVENTORY_MOVEMENT_TYPE = INVENTORY_MOVEMENT_TYPE.SALE;
const STOCK_MOVEMENT_ITEM_TYPE = 'PRODUCT';

function normalizeQuantity(value) {
  return Number(value || 0);
}

function buildReservationMovementId({ orderId, orderItemId }) {
  return `order-reservation-${orderId}-${orderItemId}`;
}

function buildReservationMovementDate(nowFactory) {
  return nowFactory().toISOString().split('T')[0];
}

function logSaleMovementCreated({
  orderId = '',
  orderNumber = '',
  publicOrderNumber = '',
  inventoryId = '',
  productId = '',
  quantityChanged = 0,
  previousQuantity = 0,
  newQuantity = 0,
}) {
  console.info('[OrderInventoryService]', {
    eventName: 'INVENTORY_MOVEMENT_CREATED',
    movementType: INVENTORY_MOVEMENT_TYPE.SALE,
    referenceType: INVENTORY_REFERENCE_TYPE.ORDER,
    referenceId: orderId,
    referenceNumber: publicOrderNumber,
    performedBy: INVENTORY_PERFORMED_BY.SYSTEM,
    orderId,
    orderNumber,
    publicOrderNumber,
    inventoryId,
    productId,
    quantityChanged,
    previousQuantity,
    newQuantity,
    timestamp: new Date().toISOString(),
  });

  console.info('[OrderInventoryService]', {
    eventName: 'SALE_MOVEMENT_CREATED',
    orderId,
    orderNumber,
    publicOrderNumber,
    inventoryId,
    productId,
    quantityChanged,
    previousQuantity,
    newQuantity,
    timestamp: new Date().toISOString(),
  });
}

export class OrderInventoryService {
  constructor({
    prismaClient = prisma,
    idGenerator = uuid,
    nowFactory = () => new Date(),
  } = {}) {
    this.prisma = prismaClient;
    this.idGenerator = idGenerator;
    this.nowFactory = nowFactory;
  }

  async getOrderReservationSnapshot(orderId) {
    if (!orderId) {
      throw new OrderError({
        message: 'orderId is required for inventory reservation.',
        statusCode: 400,
        code: 'ORDER_INVENTORY_ORDER_ID_REQUIRED',
      });
    }

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
      },
    });

    if (!order) {
      throw new OrderError({
        message: 'Order was not found for inventory reservation.',
        statusCode: 404,
        code: 'ORDER_NOT_FOUND',
      });
    }

    return order;
  }

  async reserveForOrder(orderId) {
    const startedAt = Date.now();
    const order = await this.getOrderReservationSnapshot(orderId);
    let committedCount = 0;
    let skippedCount = 0;
    let transactionDurationMs = 0;

    for (const item of order.items || []) {
      const movementId = buildReservationMovementId({
        orderId: order.id,
        orderItemId: item.id,
      });

      const existingMovement = await this.prisma.stockMovement.findUnique({
        where: { id: movementId },
      });

      if (existingMovement) {
        skippedCount += 1;
        continue;
      }

      const inventory = await this.prisma.inventory.findUnique({
        where: { id: item.variantId },
      });

      if (!inventory) {
        throw new OrderError({
          message: 'Inventory variant was not found.',
          statusCode: 404,
          code: 'ORDER_INVENTORY_NOT_FOUND',
        });
      }

      if ((inventory.status || 'Active') !== 'Active') {
        throw new OrderError({
          message: 'Inventory variant is inactive.',
          statusCode: 400,
          code: 'ORDER_INVENTORY_INACTIVE',
        });
      }

      const quantity = normalizeQuantity(item.quantity);
      if (inventory.quantity < quantity) {
        throw new OrderError({
          message: 'Inventory is insufficient for order commit.',
          statusCode: 409,
          code: 'ORDER_INVENTORY_INSUFFICIENT',
        });
      }

      const nextQuantity = inventory.quantity - quantity;
      const transactionStartedAt = Date.now();

      try {
        await this.prisma.$transaction([
          this.prisma.inventory.update({
            where: { id: item.variantId },
            data: {
              quantity: nextQuantity,
            },
          }),
          this.prisma.stockMovement.create({
            data: {
              id: movementId,
              itemType: STOCK_MOVEMENT_ITEM_TYPE,
              inventoryId: item.variantId,
              productId: item.productId,
              color: inventory.color,
              size: inventory.size,
              movementDate: buildReservationMovementDate(this.nowFactory),
              movementType: ORDER_INVENTORY_MOVEMENT_TYPE,
              quantity,
              quantityChanged: quantity,
              previousQuantity: inventory.quantity,
              newQuantity: nextQuantity,
              notes: `Inventory deducted for order ${order.publicOrderNumber}.`,
              referenceType: INVENTORY_REFERENCE_TYPE.ORDER,
              referenceId: order.id,
              referenceNumber: order.publicOrderNumber,
              performedBy: INVENTORY_PERFORMED_BY.SYSTEM,
            },
          }),
        ]);
        logSaleMovementCreated({
          orderId: order.id,
          orderNumber: order.orderNumber,
          publicOrderNumber: order.publicOrderNumber,
          inventoryId: item.variantId,
          productId: item.productId,
          quantityChanged: quantity,
          previousQuantity: inventory.quantity,
          newQuantity: nextQuantity,
        });
        if (nextQuantity <= Number(inventory.threshold || 0)) {
          await notificationService.dispatch({
            type: nextQuantity <= 0 ? NOTIFICATION_EVENT_TYPE.OUT_OF_STOCK : NOTIFICATION_EVENT_TYPE.LOW_STOCK,
            payload: {
              inventoryId: item.variantId,
              referenceId: item.variantId,
              quantity: nextQuantity,
              productName: item.productName,
            },
            prismaClient: this.prisma,
          });
        }
        committedCount += 1;
        transactionDurationMs += Date.now() - transactionStartedAt;
      } catch (error) {
        const duplicatedMovement = await this.prisma.stockMovement.findUnique({
          where: { id: movementId },
        });

        if (duplicatedMovement) {
          skippedCount += 1;
          transactionDurationMs += Date.now() - transactionStartedAt;
          continue;
        }

        throw error;
      }
    }

    return {
      result: committedCount > 0
        ? ORDER_INVENTORY_RESERVATION_RESULT.COMMITTED
        : ORDER_INVENTORY_RESERVATION_RESULT.SKIPPED,
      orderId: order.id,
      orderNumber: order.orderNumber,
      committedCount,
      skippedCount,
      durationMs: Date.now() - startedAt,
      transactionDurationMs,
    };
  }
}
