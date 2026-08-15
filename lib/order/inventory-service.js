import { v4 as uuid } from 'uuid';
import { prisma } from '@/lib/prisma';
import {
  INVENTORY_MOVEMENT_TYPE,
  INVENTORY_PERFORMED_BY,
  INVENTORY_REFERENCE_TYPE,
} from '@/lib/inventory/movement-service';
import { notificationService, NOTIFICATION_EVENT_TYPE } from '@/lib/notifications';
import { invalidateCommerceProductCache } from '@/lib/commerce';
import { OrderError } from './errors';

export const ORDER_INVENTORY_RESERVATION_RESULT = {
  COMMITTED: 'COMMITTED',
  SKIPPED: 'SKIPPED',
};

const ORDER_INVENTORY_MOVEMENT_TYPE = INVENTORY_MOVEMENT_TYPE.SALE;
const ORDER_INVENTORY_RELEASE_MOVEMENT_TYPE = INVENTORY_MOVEMENT_TYPE.RELEASED;
const ORDER_INVENTORY_RERESERVE_MOVEMENT_TYPE = INVENTORY_MOVEMENT_TYPE.RESERVED;
const STOCK_MOVEMENT_ITEM_TYPE = 'PRODUCT';

function normalizeQuantity(value) {
  return Number(value || 0);
}

function buildReservationMovementId({ orderId, orderItemId }) {
  return `order-reservation-${orderId}-${orderItemId}`;
}

function buildReleaseMovementId({ orderId, orderItemId }) {
  return `order-release-${orderId}-${orderItemId}`;
}

function buildReReserveMovementId({ orderId, orderItemId }) {
  return `order-rereserve-${orderId}-${orderItemId}`;
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
      if (Number(inventory.websiteStock ?? inventory.quantity ?? 0) < quantity || Number(inventory.realStock ?? inventory.quantity ?? 0) < quantity) {
        throw new OrderError({
          message: 'Website inventory is insufficient for order commit.',
          statusCode: 409,
          code: 'ORDER_INVENTORY_INSUFFICIENT',
        });
      }

      const transactionStartedAt = Date.now();
      let movementForLog = null;

      try {
        await this.prisma.$transaction(async (tx) => {
          const [deductionResult] = await tx.$queryRaw`
            UPDATE "Inventory"
            SET
              "realStock" = "realStock" - ${quantity},
              "websiteStock" = "websiteStock" - ${quantity},
              "quantity" = "websiteStock" - ${quantity}
            WHERE "id" = ${item.variantId}
              AND "realStock" >= ${quantity}
              AND "websiteStock" >= ${quantity}
            RETURNING "id", "realStock" + ${quantity} AS "previousRealStock", "realStock" AS "newRealStock", "websiteStock" AS "newWebsiteStock"
          `;

          if (!deductionResult) {
            throw new OrderError({
              message: 'Website inventory is insufficient for order commit.',
              statusCode: 409,
              code: 'ORDER_INVENTORY_INSUFFICIENT',
            });
          }

          movementForLog = {
            previousQuantity: Number(deductionResult.previousRealStock || 0),
            newQuantity: Number(deductionResult.newRealStock || 0),
            websiteStock: Number(deductionResult.newWebsiteStock || 0),
          };

          await tx.stockMovement.create({
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
              previousQuantity: movementForLog.previousQuantity,
              newQuantity: movementForLog.newQuantity,
              notes: `Inventory deducted for order ${order.publicOrderNumber}.`,
              referenceType: INVENTORY_REFERENCE_TYPE.ORDER,
              referenceId: order.id,
              referenceNumber: order.publicOrderNumber,
              performedBy: INVENTORY_PERFORMED_BY.SYSTEM,
            },
          });
        });
        logSaleMovementCreated({
          orderId: order.id,
          orderNumber: order.orderNumber,
          publicOrderNumber: order.publicOrderNumber,
          inventoryId: item.variantId,
          productId: item.productId,
          quantityChanged: quantity,
          previousQuantity: movementForLog.previousQuantity,
          newQuantity: movementForLog.newQuantity,
        });
        if (movementForLog.websiteStock <= Number(inventory.threshold || 0)) {
          await notificationService.dispatch({
            type: movementForLog.websiteStock <= 0 ? NOTIFICATION_EVENT_TYPE.OUT_OF_STOCK : NOTIFICATION_EVENT_TYPE.LOW_STOCK,
            payload: {
              inventoryId: item.variantId,
              referenceId: item.variantId,
              quantity: movementForLog.websiteStock,
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

    if (committedCount > 0) {
      await invalidateCommerceProductCache();
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

  async releaseForOrder(orderId, { prismaClient = this.prisma } = {}) {
    const client = prismaClient;
    const order = await client.order.findUnique({ where: { id: orderId }, include: { items: true } });
    if (!order) {
      throw new OrderError({ message: 'Order was not found for inventory release.', statusCode: 404, code: 'ORDER_NOT_FOUND' });
    }

    let releasedCount = 0;
    let skippedCount = 0;

    const execute = async (tx) => {
      for (const item of order.items || []) {
        const saleMovementId = buildReservationMovementId({ orderId: order.id, orderItemId: item.id });
        const releaseMovementId = buildReleaseMovementId({ orderId: order.id, orderItemId: item.id });
        const saleMovement = await tx.stockMovement.findUnique({ where: { id: saleMovementId } });
        if (!saleMovement) {
          skippedCount += 1;
          continue;
        }
        const existingRelease = await tx.stockMovement.findUnique({ where: { id: releaseMovementId } });
        if (existingRelease) {
          skippedCount += 1;
          continue;
        }

        const inventory = await tx.inventory.findUnique({ where: { id: item.variantId } });
        if (!inventory) {
          throw new OrderError({ message: 'Inventory variant was not found for cancellation release.', statusCode: 404, code: 'ORDER_INVENTORY_NOT_FOUND' });
        }

        const quantity = normalizeQuantity(item.quantity);
        const [updateResult] = await tx.$queryRaw`
          UPDATE "Inventory"
          SET
            "realStock" = "realStock" + ${quantity},
            "websiteStock" = "websiteStock" + ${quantity},
            "quantity" = "websiteStock" + ${quantity}
          WHERE "id" = ${item.variantId}
          RETURNING "id", "realStock" - ${quantity} AS "previousRealStock", "realStock" AS "newRealStock"
        `;

        if (!updateResult) {
          throw new OrderError({ message: 'Inventory could not be released for cancellation.', statusCode: 409, code: 'ORDER_INVENTORY_RELEASE_FAILED' });
        }

        await tx.stockMovement.create({
          data: {
            id: releaseMovementId,
            itemType: STOCK_MOVEMENT_ITEM_TYPE,
            inventoryId: item.variantId,
            productId: item.productId,
            color: inventory.color,
            size: inventory.size,
            movementDate: buildReservationMovementDate(this.nowFactory),
            movementType: ORDER_INVENTORY_RELEASE_MOVEMENT_TYPE,
            quantity,
            quantityChanged: quantity,
            previousQuantity: Number(updateResult.previousRealStock || 0),
            newQuantity: Number(updateResult.newRealStock || 0),
            notes: `Inventory released after cancellation for order ${order.publicOrderNumber}.`,
            referenceType: INVENTORY_REFERENCE_TYPE.ORDER,
            referenceId: order.id,
            referenceNumber: order.publicOrderNumber,
            performedBy: INVENTORY_PERFORMED_BY.SYSTEM,
          },
        });
        releasedCount += 1;
      }
    };

    if (typeof client.$transaction === 'function') {
      await client.$transaction(execute);
    } else {
      await execute(client);
    }

    if (releasedCount > 0) await invalidateCommerceProductCache();
    return { orderId: order.id, releasedCount, skippedCount };
  }

  async reReserveReleasedInventoryForOrder(orderId, { prismaClient = this.prisma } = {}) {
    const client = prismaClient;
    const order = await client.order.findUnique({ where: { id: orderId }, include: { items: true } });
    if (!order) {
      throw new OrderError({ message: 'Order was not found for inventory re-reservation.', statusCode: 404, code: 'ORDER_NOT_FOUND' });
    }

    let committedCount = 0;
    let skippedCount = 0;

    const execute = async (tx) => {
      for (const item of order.items || []) {
        const releaseMovementId = buildReleaseMovementId({ orderId: order.id, orderItemId: item.id });
        const reReserveMovementId = buildReReserveMovementId({ orderId: order.id, orderItemId: item.id });
        const releaseMovement = await tx.stockMovement.findUnique({ where: { id: releaseMovementId } });
        if (!releaseMovement) {
          skippedCount += 1;
          continue;
        }
        const existingReReserve = await tx.stockMovement.findUnique({ where: { id: reReserveMovementId } });
        if (existingReReserve) {
          skippedCount += 1;
          continue;
        }

        const inventory = await tx.inventory.findUnique({ where: { id: item.variantId } });
        if (!inventory) {
          throw new OrderError({ message: 'Inventory variant was not found for cancellation restore.', statusCode: 404, code: 'ORDER_INVENTORY_NOT_FOUND' });
        }
        if ((inventory.status || 'Active') !== 'Active') {
          throw new OrderError({ message: 'Inventory variant is inactive.', statusCode: 400, code: 'ORDER_INVENTORY_INACTIVE' });
        }

        const quantity = normalizeQuantity(item.quantity);
        const [deductionResult] = await tx.$queryRaw`
          UPDATE "Inventory"
          SET
            "realStock" = "realStock" - ${quantity},
            "websiteStock" = "websiteStock" - ${quantity},
            "quantity" = "websiteStock" - ${quantity}
          WHERE "id" = ${item.variantId}
            AND "realStock" >= ${quantity}
            AND "websiteStock" >= ${quantity}
          RETURNING "id", "realStock" + ${quantity} AS "previousRealStock", "realStock" AS "newRealStock"
        `;

        if (!deductionResult) {
          throw new OrderError({ message: 'Inventory is insufficient to restore cancelled order.', statusCode: 409, code: 'ORDER_INVENTORY_RESTORE_INSUFFICIENT' });
        }

        await tx.stockMovement.create({
          data: {
            id: reReserveMovementId,
            itemType: STOCK_MOVEMENT_ITEM_TYPE,
            inventoryId: item.variantId,
            productId: item.productId,
            color: inventory.color,
            size: inventory.size,
            movementDate: buildReservationMovementDate(this.nowFactory),
            movementType: ORDER_INVENTORY_RERESERVE_MOVEMENT_TYPE,
            quantity,
            quantityChanged: quantity,
            previousQuantity: Number(deductionResult.previousRealStock || 0),
            newQuantity: Number(deductionResult.newRealStock || 0),
            notes: `Inventory re-reserved after cancellation rejection for order ${order.publicOrderNumber}.`,
            referenceType: INVENTORY_REFERENCE_TYPE.ORDER,
            referenceId: order.id,
            referenceNumber: order.publicOrderNumber,
            performedBy: INVENTORY_PERFORMED_BY.SYSTEM,
          },
        });
        committedCount += 1;
      }
    };

    if (typeof client.$transaction === 'function') {
      await client.$transaction(execute);
    } else {
      await execute(client);
    }

    if (committedCount > 0) await invalidateCommerceProductCache();
    return { orderId: order.id, committedCount, skippedCount };
  }
}
